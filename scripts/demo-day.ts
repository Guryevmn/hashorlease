// Demo day: one invented site, 24 simulated hours through the real agent cycle, "a day in minutes".
// Invented prices only: no network, no wallet, no Telegraph request, nothing sent to Telegram.
// The journal goes to data/agent/demo/ (its own folder, rewritten on every run), never to the live journal.
//
//   npm run demo:day                 # 24 simulated hours, 5 s each (2 minutes)
//   npm run demo:day -- --speed=1    # seconds per simulated hour; 0 = all at once

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DECISION_LABEL } from "@/lib/decision";
import { agentDir, createFileStore } from "@/lib/agent/store";
import { daySegments } from "@/lib/bot/messages";
import { DEMO_DAY, DEMO_DAY_HOURS, demoDaySite, demoSiteLine, runDemoHour } from "@/lib/demo/day";
import { usd } from "@/lib/format";
import type { DecisionRecord } from "@/lib/agent/types";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"] as const;
  }),
);
for (const k of args.keys()) {
  if (k !== "speed") {
    console.error(`Unknown option --${k}. Use --speed=<seconds per simulated hour> (default 5, 0 = all at once).`);
    process.exit(2);
  }
}
const speed = Number(args.get("speed") ?? "5");
if (!Number.isFinite(speed) || speed < 0 || speed > 60) {
  console.error("--speed must be a number of seconds from 0 to 60.");
  process.exit(2);
}

const dir = agentDir("demo");
for (const f of ["decisions.jsonl", "runs.jsonl", "alerts.json"]) if (existsSync(join(dir, f))) rmSync(join(dir, f));
const store = createFileStore(dir);
const site = demoDaySite();

console.log("Hash or Lease demo day · DEMO DATA: invented prices, no network, no money, no Telegraph receipts, nothing sent to Telegram");
console.log(`${site.name} · ${demoSiteLine(site)}`);
console.log(`${DEMO_DAY_HOURS} simulated hours${speed > 0 ? `, ${speed} s each` : ""} · journal: ${join("data", "agent", "demo")}/decisions.jsonl\n`);

const all: DecisionRecord[] = [];
for (let h = 0; h < DEMO_DAY_HOURS; h++) {
  const r = await runDemoHour(h, store);
  const d = r.decisions[0];
  all.push(d);
  const x = DEMO_DAY[h];
  const what = d.decision ? `${DECISION_LABEL[d.decision]}${d.keepAsIs ? " (keep as is)" : ""}` : `on hold: ${d.reason}`;
  console.log(`[demo ${d.hour.slice(11, 16)}] power ${usd(x.powerUsdPerMwh, 0).padStart(4)}/MWh · hashprice ${usd(x.hashprice)} · ${what} · ${d.why ?? ""}`);
  for (const m of r.messages) {
    console.log("\n  ── bot alert (demo, not sent to Telegram) ──");
    for (const line of m.text.split("\n")) console.log(`  ${line}`);
    console.log("");
  }
  if (speed > 0 && h < DEMO_DAY_HOURS - 1) await new Promise((res) => setTimeout(res, speed * 1000));
}

const changes = all.filter((d) => d.changed).length;
console.log(`\nDemo day done · ${changes} ${changes === 1 ? "change" : "changes"} of call`);
for (const s of daySegments(all)) console.log(`  ${s}`);
console.log(`Journal (mode "demo"): ${join("data", "agent", "demo")}/decisions.jsonl · on screen: /demo-day`);
