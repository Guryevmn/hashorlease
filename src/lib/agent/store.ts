// Хранилище агента на диске: data/agent/<mode>/decisions.jsonl, runs.jsonl, alerts.json. Не в git.

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentMode, AgentStatus, AlertState, DecisionRecord, RunRecord } from "./types";

export interface AgentStore {
  readDecisions(): DecisionRecord[];
  appendDecisions(rows: DecisionRecord[]): void;
  readRuns(): RunRecord[];
  appendRun(run: RunRecord): void;
  readAlerts(): AlertState;
  writeAlerts(state: AlertState): void;
}

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  const out: T[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      /* битая строка (например, оборванная запись) — пропускаем */
    }
  }
  return out;
}

export function agentDir(mode: AgentMode, root = join(process.cwd(), "data")): string {
  return join(root, "agent", mode);
}

export function createFileStore(dir: string): AgentStore {
  const f = (name: string) => join(dir, name);
  const ensure = () => existsSync(dir) || mkdirSync(dir, { recursive: true });
  return {
    readDecisions: () => readJsonl<DecisionRecord>(f("decisions.jsonl")),
    appendDecisions: (rows) => {
      if (rows.length === 0) return;
      ensure();
      appendFileSync(f("decisions.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    },
    readRuns: () => readJsonl<RunRecord>(f("runs.jsonl")),
    appendRun: (run) => {
      ensure();
      appendFileSync(f("runs.jsonl"), JSON.stringify(run) + "\n");
    },
    readAlerts: () => {
      try {
        return existsSync(f("alerts.json")) ? (JSON.parse(readFileSync(f("alerts.json"), "utf8")) as AlertState) : {};
      } catch {
        return {};
      }
    },
    writeAlerts: (state) => {
      ensure();
      writeFileSync(f("alerts.json.tmp"), JSON.stringify(state));
      renameSync(f("alerts.json.tmp"), f("alerts.json"));
    },
  };
}

/** Последнее записанное решение по каждой площадке (одна запись на площадку). */
export function latestBySite(rows: DecisionRecord[]): Map<string, DecisionRecord> {
  const m = new Map<string, DecisionRecord>();
  for (const r of rows) {
    const prev = m.get(r.siteId);
    if (!prev || r.at >= prev.at) m.set(r.siteId, r);
  }
  return m;
}

/** Последнее решение по площадке, которое не было паузой. */
export function lastDecided(rows: DecisionRecord[], siteId: string): DecisionRecord | null {
  let best: DecisionRecord | null = null;
  for (const r of rows) if (r.siteId === siteId && r.status === "ok" && (!best || r.at >= best.at)) best = r;
  return best;
}

/** Одна запись на площадку и час — самая поздняя (повтор цикла через 10 минут перекрывает первую попытку). */
export function hourlyRows(rows: DecisionRecord[]): DecisionRecord[] {
  const m = new Map<string, DecisionRecord>();
  for (const r of rows) {
    const k = `${r.siteId}|${r.hour}`;
    const prev = m.get(k);
    if (!prev || r.at >= prev.at) m.set(k, r);
  }
  return [...m.values()];
}

export function agentStatus(mode: AgentMode, store: AgentStore, now = new Date()): AgentStatus {
  const runs = store.readRuns();
  const day = now.toISOString().slice(0, 10);
  const today = runs.filter((r) => r.at.startsWith(day));
  return {
    mode,
    lastRun: runs.length ? runs[runs.length - 1] : null,
    runsToday: today.length,
    paidRequestsToday: today.reduce((s, r) => s + r.paidRequests, 0),
    schedule: "every hour at hh:01 UTC",
  };
}
