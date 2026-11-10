// Ежечасный агент Hash or Lease: без открытого браузера раз в час (hh:01 UTC) пересчитывает решения по всем площадкам,
// сам платит за данные Telegraph (x402, тестовая сеть) в пределах DAILY_SPEND_LIMIT_USD и пишет историю в data/agent/<mode>/.
//
//   npm run agent                         # цикл сразу, дальше каждый час; Ctrl+C — стоп
//   npm run agent -- --once               # один цикл и выход
//   npm run agent -- --mode=mock          # выдуманные данные, без сети и денег
//   npm run agent -- --mode=mock --state=provider-error   # сымитировать сбой (provider-error | error | limit)
//   npm run agent -- --once --fresh       # live: не брать снимок из кэша (30 мин), купить новый — для проверки лимита и сбоев

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseMockState } from "@/lib/data/mock";
import { DECISION_LABEL } from "@/lib/decision";
import { BOT_TOKEN_VAR, botToken, runOnce } from "@/lib/agent/runner";
import { agentDir } from "@/lib/agent/store";
import type { AgentMode } from "@/lib/agent/types";
import type { CycleResult } from "@/lib/agent/cycle";

if (existsSync(".env")) process.loadEnvFile(".env"); // переменные из командной строки важнее файла

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"] as const;
  }),
);
const known = new Set(["once", "mode", "state", "fresh"]);
for (const k of args.keys()) {
  if (!known.has(k)) {
    console.error(`Unknown option --${k}. Use --once, --fresh, --mode=mock|live, --state=provider-error|error|limit (mock only).`);
    process.exit(2);
  }
}

const modeArg = args.get("mode") ?? (process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "mock");
if (modeArg !== "live" && modeArg !== "mock") {
  console.error(`--mode must be "live" or "mock", got "${modeArg}"`);
  process.exit(2);
}
const mode: AgentMode = modeArg;
const state = parseMockState(args.get("state"));
const SIMULATED = ["provider-error", "error", "limit"];
if (args.has("state") && (mode !== "mock" || !SIMULATED.includes(state))) {
  console.error(`--state works only with --mode=mock and must be one of: ${SIMULATED.join(", ")}.`);
  process.exit(2);
}
const once = args.has("once");
const fresh = args.has("fresh");
if (fresh && (mode !== "live" || !once)) {
  console.error("--fresh works only with --mode=live --once (a looping agent must reuse the shared cache).");
  process.exit(2);
}

const ts = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
const log = (line: string) => console.log(`[${ts()}] ${line}`);

// Один агент на режим: второй процесс не запускаем, чтобы не платить дважды.
const dir = agentDir(mode);
const lock = join(dir, "agent.pid");
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
if (!once) {
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    if (pid && pid !== process.pid && alive(pid)) {
      console.error(`Agent (${mode}) is already running, pid ${pid}. Stop it first or use --once.`);
      process.exit(1);
    }
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(lock, String(process.pid));
  const release = () => {
    try {
      if (existsSync(lock) && readFileSync(lock, "utf8") === String(process.pid)) unlinkSync(lock);
    } catch {
      /* ничего */
    }
  };
  process.on("exit", release);
  for (const sig of ["SIGINT", "SIGTERM"] as const)
    process.on(sig, () => {
      log("stopping");
      process.exit(0);
    });
}

function report(r: CycleResult) {
  const { run } = r;
  log(
    `${run.mode} cycle for ${run.hour.slice(11, 16)} UTC · ${run.sites} sites · ${run.decided} decided · ${run.paused} paused · ` +
      `paid requests ${run.paidRequests} · spent today $${run.spentTodayUsd.toFixed(2)} of $${run.limitUsd.toFixed(2)}` +
      (run.error ? ` · ${run.error}` : ""),
  );
  for (const d of r.decisions) {
    const what = d.decision ? `${DECISION_LABEL[d.decision]}${d.keepAsIs ? " (keep as is)" : ""}${d.changed ? ` ← was ${DECISION_LABEL[d.previous!]}` : ""}` : `on hold: ${d.reason}`;
    const paid = d.receipts.filter((x) => x.status === "verified" && (x.costUsd ?? 0) > 0);
    const proof = paid.map((x) => `${x.service} ${x.hash ?? ""}`.trim()).join(", ");
    log(`  ${d.siteName}: ${what}${proof ? ` · receipt ${proof}` : ""}`);
  }
  log(`  saved to ${join("data", "agent", mode)}/ · alerts: ${r.messages.length} (${run.notified} sent to Telegram)`);
}

async function cycle(): Promise<CycleResult | null> {
  try {
    const r = await runOnce({ mode, state, log, fresh });
    report(r);
    return r;
  } catch (e) {
    log(`cycle failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Следующий запуск: hh:01 UTC; если в цикле был сбой — повтор через 10 минут. */
function nextDelay(r: CycleResult | null, now = new Date()): number {
  const next = new Date(now);
  next.setUTCMinutes(1, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCHours(next.getUTCHours() + 1);
  const hourly = next.getTime() - now.getTime();
  // Сбой цикла или пауза хотя бы одной площадки (поставщик цены) — повтор через 10 минут; кэш снимка общий, лишней оплаты нет.
  const failed = !r || r.run.error !== undefined || r.decisions.some((d) => d.pauseKind === "provider" || d.pauseKind === "network");
  const limitOnly = r?.run.limitReached;
  return failed && !limitOnly ? Math.min(hourly, 10 * 60_000) : hourly;
}

log(
  `Hash or Lease agent · mode ${mode}${mode === "mock" ? ` (demo data, no network, no money${state !== "default" ? `, simulating ${state}` : ""})` : " (Telegraph testnet, Sepolia USDC)"}` +
    ` · Telegram alerts ${botToken() ? "on" : `off (no ${BOT_TOKEN_VAR} in .env)`}`,
);
if (mode === "live") log(`daily spend limit $${Number(process.env.DAILY_SPEND_LIMIT_USD ?? "0.5").toFixed(2)} (DAILY_SPEND_LIMIT_USD)`);

const first = await cycle();
if (once) process.exit(first ? 0 : 1);

let last = first;
for (;;) {
  const delay = nextDelay(last);
  log(`next cycle at ${new Date(Date.now() + delay).toISOString().slice(11, 16)} UTC`);
  await new Promise((r) => setTimeout(r, delay));
  last = await cycle();
}
