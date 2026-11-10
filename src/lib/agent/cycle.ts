// Один цикл ежечасного агента: снимок рынка → решение по каждой площадке → запись на диск → оповещения.
// Правило: нет свежего чека Telegraph — нет решения (час записывается как пауза с причиной).
// Зависимости передаются снаружи, поэтому цикл одинаково работает в mock, в живом режиме и в тестах.

import { buildSiteReport } from "../report";
import type { MarketSnapshot, Receipt, Site, SiteReport } from "../types";
import { changeAlert, limitAlert, networkAlert, networkBackAlert, providerAlert, type BotMessage } from "../bot/messages";
import { lastDecided, type AgentStore } from "./store";
import type { AgentMode, AlertState, DecisionRecord, RecordedReceipt, RunRecord } from "./types";

export interface SpendInfo {
  spentUsd: number;
  limitUsd: number;
  /** Всего платных запросов в журнале (разница до/после цикла = купленное агентом). */
  paidRequests: number;
}

export interface CycleDeps {
  mode: AgentMode;
  store: AgentStore;
  loadSites: () => Site[];
  getSnapshot: () => Promise<MarketSnapshot>;
  spend: () => SpendInfo;
  now?: () => Date;
  /** Отправка оповещений; возвращает, сколько сообщений ушло. Нет — оповещения только в лог. */
  notify?: (messages: BotMessage[]) => Promise<number>;
  appUrl?: string | null;
  log?: (line: string) => void;
}

export interface CycleResult {
  run: RunRecord;
  decisions: DecisionRecord[];
  messages: BotMessage[];
}

const hourOf = (d: Date) => {
  const h = new Date(d);
  h.setUTCMinutes(0, 0, 0);
  return h.toISOString();
};

function recordReceipt(label: string, r: Receipt): RecordedReceipt {
  return {
    label,
    status: r.status,
    service: r.service,
    provider: r.provider,
    fetchedAt: r.fetchedAt,
    costUsd: r.costUsd,
    hash: r.hash,
    proofUrl: r.proofUrl,
  };
}

function receiptsOf(rep: SiteReport): RecordedReceipt[] {
  return [recordReceipt("Mining income", rep.inputs.hashprice.receipt), recordReceipt("Power price", rep.inputs.power.receipt)];
}

function pausedRecord(base: Omit<DecisionRecord, "status" | "decision" | "keepAsIs" | "changed" | "options" | "chosenUsdPerMwh" | "gainVsMiningPerHour" | "profitPerHour">, reason: string, kind: DecisionRecord["pauseKind"]): DecisionRecord {
  return {
    ...base,
    status: "paused",
    reason,
    pauseKind: kind,
    decision: null,
    keepAsIs: false,
    changed: false,
    options: null,
    chosenUsdPerMwh: null,
    gainVsMiningPerHour: null,
    profitPerHour: null,
  };
}

/** Почему решения в этом часе выдавать нельзя совсем (для всех площадок), или null. */
function globalPause(s: MarketSnapshot): { kind: "limit" | "network"; reason: string } | null {
  const network = { kind: "network" as const, reason: "Paused · no fresh Telegraph receipt (Telegraph unavailable)" };
  // Сеть упала, а в кэше старый снимок: старый чек свежим не считаем.
  if (s.networkDown) return network;
  if (s.hashprice.receipt.status === "verified") return null;
  if (s.limitReached || (s.hashprice.receipt.status === "stale" && /limit/i.test(s.hashprice.receipt.source ?? ""))) {
    return { kind: "limit", reason: "Paused · daily limit" };
  }
  return network;
}

export async function runCycle(deps: CycleDeps): Promise<CycleResult> {
  const now = deps.now ?? (() => new Date());
  const started = now();
  const at = started.toISOString();
  const hour = hourOf(started);
  const log = deps.log ?? (() => {});
  const { store, mode } = deps;

  const safeSpend = (): SpendInfo => {
    try {
      return deps.spend();
    } catch (e) {
      log(`can't read spend ledger: ${e instanceof Error ? e.message : String(e)}`);
      return { spentUsd: 0, limitUsd: 0, paidRequests: 0 };
    }
  };
  const before = safeSpend();
  const history = store.readDecisions();
  const alerts: AlertState = store.readAlerts();
  const messages: BotMessage[] = [];
  const decisions: DecisionRecord[] = [];
  let error: string | undefined;

  let sites: Site[] = [];
  try {
    sites = deps.loadSites();
  } catch (e) {
    error = `Can't read sites: ${e instanceof Error ? e.message : String(e)}`;
  }

  let snapshot: MarketSnapshot | null = null;
  if (!error && sites.length > 0) {
    try {
      snapshot = await deps.getSnapshot();
    } catch (e) {
      error = `Can't build market snapshot: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const pause = snapshot
    ? globalPause(snapshot)
    : error && sites.length > 0
      ? { kind: "network" as const, reason: "Paused · market data sources unavailable", sources: true }
      : null;

  for (const site of sites) {
    const last = lastDecided(history, site.id);
    const base = {
      at,
      hour,
      mode,
      siteId: site.id,
      siteName: site.name,
      mw: site.mw,
      previous: last?.decision ?? null,
      hashprice: snapshot?.hashprice.value ?? null,
      powerPrice: null as number | null,
      receipts: [] as RecordedReceipt[],
    };

    if (pause || !snapshot) {
      decisions.push(pausedRecord(base, pause?.reason ?? "Paused", pause?.kind ?? "network"));
      continue;
    }

    const rep = buildSiteReport({ ...site, lastDecision: last?.decision ?? null }, snapshot);
    const withInputs = { ...base, powerPrice: rep.inputs.power.value, receipts: receiptsOf(rep) };
    if (!rep.result || !rep.result.ok) {
      const kind = site.paused ? "site-paused" : rep.inputs.power.value === null ? "provider" : "invalid";
      const reason = rep.pausedReason ?? (rep.result && !rep.result.ok ? rep.result.errors.join("; ") : "Paused");
      const rec = pausedRecord(withInputs, reason, kind);
      decisions.push(rec);
      if (kind === "provider" && !(alerts.providerDown ?? []).includes(site.id)) {
        messages.push(providerAlert(rec, last));
        alerts.providerDown = [...(alerts.providerDown ?? []), site.id];
      }
      continue;
    }

    alerts.providerDown = (alerts.providerDown ?? []).filter((id) => id !== site.id);
    const o = rep.result;
    const rec: DecisionRecord = {
      ...withInputs,
      status: "ok",
      decision: o.chosen,
      keepAsIs: o.keepAsIs,
      changed: last !== null && o.chosen !== last.decision,
      options: o.options,
      chosenUsdPerMwh: o.chosenUsdPerMwh,
      gainVsMiningPerHour: o.gainVsMiningPerHour,
      profitPerHour: o.profitPerHour,
    };
    decisions.push(rec);
    if (rec.changed) messages.push(changeAlert(rec, deps.appUrl ?? null));
  }

  // Оповещения о лимите и сети — по одному разу, пока состояние не сменится.
  const day = at.slice(0, 10);
  if (pause?.kind === "limit" && alerts.limitAlertDay !== day) {
    messages.push(limitAlert(before.limitUsd, deps.appUrl ?? null));
    alerts.limitAlertDay = day;
  }
  if (pause?.kind === "network" && !alerts.networkDown) {
    messages.push(networkAlert("sources" in pause ? "market data" : "Telegraph"));
    alerts.networkDown = true;
  } else if (!pause && snapshot && alerts.networkDown) {
    messages.push(networkBackAlert());
    alerts.networkDown = false;
  }

  store.appendDecisions(decisions);

  let notified = 0;
  let notifyFailed = false;
  if (messages.length > 0) {
    if (deps.notify) {
      try {
        notified = await deps.notify(messages);
      } catch (e) {
        notifyFailed = true;
        log(`notify failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      for (const m of messages) log(`alert (bot not configured, not sent): ${m.text.replace(/\n/g, " | ")}`);
    }
  }
  // Отправка упала — состояние оповещений не запоминаем: в следующем цикле попробуем снова.
  if (!notifyFailed) store.writeAlerts(alerts);

  const after = safeSpend();
  const decided = decisions.filter((d) => d.status === "ok");
  const run: RunRecord = {
    at,
    hour,
    mode,
    ok: !error && !pause,
    sites: sites.length,
    decided: decided.length,
    paused: decisions.length - decided.length,
    changes: decided.filter((d) => d.changed && d.previous && d.decision).map((d) => ({ siteId: d.siteId, siteName: d.siteName, from: d.previous!, to: d.decision! })),
    paidRequests: Math.max(0, after.paidRequests - before.paidRequests),
    spentTodayUsd: Math.round(after.spentUsd * 100) / 100,
    limitUsd: after.limitUsd,
    limitReached: pause?.kind === "limit",
    notified,
    error: error ?? (pause ? pause.reason : undefined),
    durationMs: now().getTime() - started.getTime(),
  };
  store.appendRun(run);
  return { run, decisions, messages };
}
