import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMockSnapshot, mockAgentSnapshot, mockSeedSites, type MockState } from "../data/mock";
import type { MarketSnapshot } from "../types";
import { runCycle, type CycleDeps } from "./cycle";
import { createFileStore, hourlyRows, lastDecided, type AgentStore } from "./store";
import type { AlertState, DecisionRecord, RunRecord } from "./types";

function memoryStore(): AgentStore & { decisions: DecisionRecord[]; runs: RunRecord[] } {
  const s = {
    decisions: [] as DecisionRecord[],
    runs: [] as RunRecord[],
    alerts: {} as AlertState,
    readDecisions: () => [...s.decisions],
    appendDecisions: (rows: DecisionRecord[]) => void s.decisions.push(...rows),
    readRuns: () => [...s.runs],
    appendRun: (r: RunRecord) => void s.runs.push(r),
    readAlerts: () => ({ ...s.alerts }),
    writeAlerts: (a: AlertState) => void (s.alerts = a),
  };
  return s;
}

const NOW = new Date(Date.UTC(2026, 10, 8, 14, 1, 0));

function deps(store: AgentStore, snapshot: () => Promise<MarketSnapshot>, extra: Partial<CycleDeps> = {}): CycleDeps {
  let paid = 0;
  return {
    mode: "mock",
    store,
    loadSites: mockSeedSites,
    getSnapshot: async () => {
      paid += 1;
      return snapshot();
    },
    spend: () => ({ spentUsd: paid * 0.01, limitUsd: 1, paidRequests: paid }),
    now: () => NOW,
    ...extra,
  };
}

const snap = (state: MockState) => async () => buildMockSnapshot(state);

describe("runCycle", () => {
  it("records a decision for each site with receipts and counts purchased requests", async () => {
    const store = memoryStore();
    const { run, decisions } = await runCycle(deps(store, snap("default")));
    expect(run.ok).toBe(true);
    expect(run.sites).toBe(3);
    expect(run.decided).toBe(3);
    expect(run.paidRequests).toBe(1);
    expect(run.hour).toBe("2026-11-08T14:00:00.000Z");
    const byId = Object.fromEntries(decisions.map((d) => [d.siteId, d]));
    expect(byId.houston.decision).toBe("lease");
    expect(byId["north-ridge"].decision).toBe("off");
    expect(byId.garage.decision).toBe("mine");
    expect(byId.houston.receipts.map((r) => r.service)).toEqual(["MINING_HASHPRICE_VERIFY", "GRID_POWER_PRICE"]);
    expect(store.decisions).toHaveLength(3);
    expect(store.runs).toHaveLength(1);
  });

  it("first decision is not a change; a change vs. the previous hour triggers an alert", async () => {
    const store = memoryStore();
    const first = await runCycle(deps(store, snap("default")));
    expect(first.messages).toHaveLength(0);
    // Previous hour: Houston was mining → now Lease to AI.
    store.decisions = store.decisions.map((d) => (d.siteId === "houston" ? { ...d, decision: "mine" } : d));
    const second = await runCycle(deps(store, snap("default"), { now: () => new Date(NOW.getTime() + 3600_000) }));
    const change = second.messages.find((m) => m.kind === "change");
    expect(change?.siteId).toBe("houston");
    expect(change?.text.split("\n")[0]).toBe("🔄 Houston Hub: Mine → Lease to AI");
    expect(second.run.changes).toEqual([{ siteId: "houston", siteName: "Houston Hub", from: "mine", to: "lease" }]);
    // The journal and the alert carry the reason for the change.
    const rec = second.decisions.find((d) => d.siteId === "houston")!;
    expect(rec.why).toMatch(/Lease to AI now beats Mine by \$\d/);
    expect(change?.text.split("\n")[1]).toBe(`Why: ${rec.why}`);
  });

  it("provider failure: site paused, one alert, the rest decided", async () => {
    const store = memoryStore();
    await runCycle(deps(store, snap("default")));
    const a = await runCycle(deps(store, snap("provider-error")));
    const north = a.decisions.find((d) => d.siteId === "north-ridge")!;
    expect(north.status).toBe("paused");
    expect(north.pauseKind).toBe("provider");
    expect(a.run.decided).toBe(2);
    expect(a.messages.map((m) => m.text)).toEqual(["⚠️ North Ridge: grid price unavailable. Last call (14:00): Switch off. Retrying in 10 min."]);
    const b = await runCycle(deps(store, snap("provider-error")));
    expect(b.messages).toHaveLength(0);
  });

  it("limit reached: all hours paused, one alert per day", async () => {
    const store = memoryStore();
    const a = await runCycle(deps(store, snap("limit")));
    expect(a.run.decided).toBe(0);
    expect(a.run.limitReached).toBe(true);
    expect(a.decisions.every((d) => d.reason === "Paused · daily limit")).toBe(true);
    expect(a.messages.map((m) => m.kind)).toEqual(["limit"]);
    const b = await runCycle(deps(store, snap("limit")));
    expect(b.messages).toHaveLength(0);
  });

  it("Telegraph unavailable: no decisions; when it returns, a message and decisions again", async () => {
    const store = memoryStore();
    const down = await runCycle(deps(store, snap("error")));
    expect(down.run.ok).toBe(false);
    expect(down.run.decided).toBe(0);
    expect(down.messages.map((m) => m.kind)).toEqual(["network"]);
    const back = await runCycle(deps(store, snap("default")));
    expect(back.run.decided).toBe(3);
    expect(back.messages.map((m) => m.kind)).toEqual(["network-back"]);
  });

  it("an exception while building the snapshot does not crash the cycle: pause with a reason", async () => {
    const store = memoryStore();
    const r = await runCycle(
      deps(store, async () => {
        throw new Error("mempool.space → 503");
      }),
    );
    expect(r.run.ok).toBe(false);
    expect(r.run.error).toContain("mempool.space → 503");
    expect(r.decisions.every((d) => d.status === "paused")).toBe(true);
  });

  it("passes messages to notify and records how many went out", async () => {
    const store = memoryStore();
    const sent: string[] = [];
    const r = await runCycle(deps(store, snap("limit"), { notify: async (ms) => (ms.forEach((m) => sent.push(m.kind)), ms.length) }));
    expect(sent).toEqual(["limit"]);
    expect(r.run.notified).toBe(1);
  });
});

describe("failures around the cycle", () => {
  it("Telegram send failed: the alert is retried in the next cycle", async () => {
    const store = memoryStore();
    const failing = { notify: async () => { throw new Error("telegram down"); } };
    const a = await runCycle(deps(store, snap("limit"), failing));
    expect(a.messages.map((m) => m.kind)).toEqual(["limit"]);
    const b = await runCycle(deps(store, snap("limit")));
    expect(b.messages.map((m) => m.kind)).toEqual(["limit"]);
  });

  it("spend ledger is unreadable: the cycle is still recorded", async () => {
    const store = memoryStore();
    const r = await runCycle(deps(store, snap("default"), { spend: () => { throw new Error("bad ledger"); } }));
    expect(r.run.decided).toBe(3);
    expect(store.runs).toHaveLength(1);
  });

  it("sites are unreadable: pause with a reason, no crash", async () => {
    const store = memoryStore();
    const r = await runCycle(deps(store, snap("default"), { loadSites: () => { throw new Error("sites.json is damaged"); } }));
    expect(r.run.ok).toBe(false);
    expect(r.run.error).toContain("damaged");
  });
});

describe("agent file store", () => {
  it("writes and reads jsonl, skips broken lines, takes the latest entry of the hour", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hol-agent-"));
    const store = createFileStore(dir);
    await runCycle(deps(store, async () => mockAgentSnapshot("default", NOW)));
    await runCycle(deps(store, async () => mockAgentSnapshot("provider-error", NOW)));
    const rows = store.readDecisions();
    expect(rows).toHaveLength(6);
    const hourly = hourlyRows(rows);
    expect(hourly).toHaveLength(3);
    expect(hourly.find((r) => r.siteId === "north-ridge")!.status).toBe("paused");
    expect(lastDecided(rows, "north-ridge")!.status).toBe("ok");
    expect(store.readRuns()).toHaveLength(2);
    expect(store.readAlerts().providerDown).toEqual(["north-ridge"]);
  });
});
