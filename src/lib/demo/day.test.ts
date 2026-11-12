import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCycle } from "../agent/cycle";
import { agentDir, createFileStore, createMemoryStore } from "../agent/store";
import { buildMockSnapshot } from "../data/mock";
import { daySegments, demoDayReplay } from "../bot/messages";
import { DEMO_DAY, DEMO_DAY_START, DEMO_NODE_ID, demoBreakEvenPower, demoDaySite, demoDaySnapshot, demoSiteLine, simulateDemoDay } from "./day";

const at = (h: number) => new Date(DEMO_DAY_START + h * 3600_000).toISOString();

describe("demo day profile", () => {
  it("has 24 hours with numbers of a plausible order of magnitude", () => {
    expect(DEMO_DAY).toHaveLength(24);
    for (const x of DEMO_DAY) {
      // Real cached series, 11 Oct – 12 Nov 2026: power from about −$14 to $966/MWh; live hashprice $34.48–35.53.
      expect(x.powerUsdPerMwh).toBeGreaterThan(0);
      expect(x.powerUsdPerMwh).toBeLessThan(320);
      expect(x.hashprice).toBeGreaterThan(34);
      expect(x.hashprice).toBeLessThan(36);
    }
    // Day shape: the night is cheaper than the evening peak, and the midday dip is the cheapest stretch.
    expect(DEMO_DAY[2].powerUsdPerMwh).toBeLessThan(DEMO_DAY[18].powerUsdPerMwh);
    expect(Math.min(...DEMO_DAY.map((x) => x.powerUsdPerMwh))).toBe(DEMO_DAY[12].powerUsdPerMwh);
  });

  it("marks every number as demo: no receipt hash, no proof link, no cost", () => {
    for (let h = 0; h < 24; h++) {
      const s = demoDaySnapshot(h);
      for (const r of [s.hashprice.receipt, s.power[DEMO_NODE_ID].realTime.receipt]) {
        expect(r.status).toBe("demo");
        expect(r.hash).toBeUndefined();
        expect(r.proofUrl).toBeUndefined();
        expect(r.costUsd).toBe(0);
        expect(r.source).toMatch(/^Demo day: invented/);
      }
    }
    expect(demoDaySite().name).toContain("(demo)");
    expect(() => demoDaySnapshot(24)).toThrow();
  });
});

describe("demo day simulation", () => {
  it("the call changes during the day: Lease → Mine at 11:00, Mine → Lease at 16:00", async () => {
    const day = await simulateDemoDay();
    expect(day.decisions).toHaveLength(24);
    expect(day.decisions.every((r) => r.status === "ok" && r.mode === "demo")).toBe(true);
    const changes = day.decisions.filter((r) => r.changed).map((r) => [r.hour, r.previous, r.decision]);
    expect(changes).toEqual([
      [at(11), "lease", "mine"],
      [at(16), "mine", "lease"],
    ]);
    expect(day.runs).toHaveLength(24);
    expect(day.runs.every((r) => r.ok && r.paidRequests === 0 && r.spentTodayUsd === 0 && r.notified === 0)).toBe(true);
    expect(day.runs[16].changes).toEqual([{ siteId: "demo-solar-ridge", siteName: "Solar Ridge (demo)", from: "mine", to: "lease" }]);
  });

  it("boundary hours: a gap under the $5 threshold does not flip the call", async () => {
    const d = (await simulateDemoDay()).decisions;
    // 10:00 — mining is already ahead, but by about $2: stay on the lease.
    expect(d[10]).toMatchObject({ decision: "lease", keepAsIs: true, changed: false });
    expect(d[10].options!.mine).toBeGreaterThan(d[10].options!.lease!);
    expect(d[10].options!.mine - d[10].options!.lease!).toBeLessThan(5);
    // 11:00 — the gap passes the threshold: switch.
    expect(d[11]).toMatchObject({ decision: "mine", keepAsIs: false, changed: true });
    expect(d[11].options!.mine - d[11].options!.lease!).toBeGreaterThan(5);
    // 14:00 — mining still leads, narrowly; 15:00 — the lease is ahead by under $5: keep mining.
    expect(d[14]).toMatchObject({ decision: "mine", keepAsIs: true, changed: false });
    expect(d[15]).toMatchObject({ decision: "mine", keepAsIs: true, changed: false });
    expect(d[15].options!.lease!).toBeGreaterThan(d[15].options!.mine);
    // 16:00 — the evening ramp: back to the lease. The first hour of the day is never a "change".
    expect(d[16]).toMatchObject({ decision: "lease", keepAsIs: false, changed: true });
    expect(d[0]).toMatchObject({ decision: "lease", changed: false, previous: null });
    // The break-even power price sits between the midday dip and the rest of the day.
    const be = demoBreakEvenPower(DEMO_DAY[12]);
    expect(be).toBeGreaterThan(DEMO_DAY[12].powerUsdPerMwh + 5);
    expect(be).toBeLessThan(DEMO_DAY[16].powerUsdPerMwh - 5);
  });

  it("the journal records a reason for every hour, and what moved for every change", async () => {
    const d = (await simulateDemoDay()).decisions;
    for (const r of d) expect(r.why && r.why.length).toBeGreaterThan(10);
    expect(d[11].why).toBe("power price fell from $28.00 to $21.00/MWh; Mine now beats Lease to AI by $9.11/MWh");
    expect(d[16].why).toBe("power price rose from $33.00 to $124.00/MWh; Lease to AI now beats Mine by $93.50/MWh");
    expect(d[10].why).toBe("Mine is ahead by only $2.06/MWh, below the $5.00 threshold: keep Lease to AI");
    expect(d[18].why).toBe("Lease to AI leads Switch off by $67.00/MWh");
    // Same record shape as the live journal: receipts are listed, but none is a paid or verified one.
    for (const r of d) {
      expect(r.receipts.map((x) => x.label)).toEqual(["Mining income", "Power price"]);
      expect(r.receipts.every((x) => x.status === "demo" && !x.hash && !x.proofUrl)).toBe(true);
    }
  });

  it("is deterministic, and the sample journal in docs/demo-day/ is exactly this day", async () => {
    const day = await simulateDemoDay();
    expect(day).toEqual(await simulateDemoDay());
    const sample = readFileSync(join(process.cwd(), "docs", "demo-day", "decisions.jsonl"), "utf8");
    expect(sample).toBe(day.decisions.map((r) => JSON.stringify(r)).join("\n") + "\n");
  });
});

describe("demo day in the bot", () => {
  it("sends a marked alert with the reason when the call changes", async () => {
    const day = await simulateDemoDay();
    expect(day.alerts.map((a) => [a.h, a.message.kind])).toEqual([
      [11, "change"],
      [16, "change"],
    ]);
    expect(day.alerts[1].message.text.split("\n")).toEqual([
      "🧪 Demo data · simulated 16:00 UTC",
      "🔄 Solar Ridge (demo): Mine → Lease to AI",
      "Why: power price rose from $33.00 to $124.00/MWh; Lease to AI now beats Mine by $93.50/MWh",
      "+$1,402/h vs. mining · $67.00/MWh",
      "Power $124.00 · Hashprice $35.10/PH/day",
      "Demo data · no Telegraph receipts",
    ]);
    for (const a of day.alerts) {
      expect(a.message.text).not.toMatch(/Receipts: \d/);
      expect(a.message.buttons).toEqual([]);
    }
    const linked = await simulateDemoDay({ appUrl: "https://hol.example" });
    expect(linked.alerts[0].message.buttons).toEqual([{ text: "Open demo day", url: "https://hol.example/demo-day" }]);
  });

  it("/demo replays the day: intro, both changes, the day at a glance", async () => {
    const day = await simulateDemoDay();
    expect(daySegments(day.decisions)).toEqual(["00:00–11:00 ⚡ Lease to AI", "11:00–16:00 ⛏ Mine", "16:00–24:00 ⚡ Lease to AI"]);
    const replay = demoDayReplay({ siteName: day.site.name, siteLine: demoSiteLine(day.site), decisions: day.decisions, appUrl: null });
    expect(replay.map((m) => m.kind)).toEqual(["demo", "change", "change", "demo"]);
    expect(replay[0].text).toContain("🧪 Demo day — invented prices, no Telegraph requests, no receipts.");
    expect(replay[0].text).toContain("The call changes 2 times");
    expect(replay[3].text).toContain("11:00–16:00 ⛏ Mine");
    for (const m of replay) expect(m.text.startsWith("🧪")).toBe(true);
  });
});

describe("demo data stays out of the real journal", () => {
  it("writes only to data/agent/demo/ and leaves the live and mock journals untouched", async () => {
    const root = mkdtempSync(join(tmpdir(), "hol-demo-"));
    const liveLine = JSON.stringify({ at: "2026-11-12T02:01:00.043Z", hour: "2026-11-12T02:00:00.000Z", mode: "live", siteId: "leipzig", status: "ok", decision: "lease" }) + "\n";
    for (const mode of ["live", "mock"] as const) {
      mkdirSync(agentDir(mode, root), { recursive: true });
      writeFileSync(join(agentDir(mode, root), "decisions.jsonl"), liveLine);
      writeFileSync(join(agentDir(mode, root), "runs.jsonl"), "");
    }
    await simulateDemoDay({ store: createFileStore(agentDir("demo", root)) });

    expect(agentDir("demo", root)).not.toBe(agentDir("live", root));
    for (const mode of ["live", "mock"] as const) {
      expect(readFileSync(join(agentDir(mode, root), "decisions.jsonl"), "utf8")).toBe(liveLine);
      expect(readFileSync(join(agentDir(mode, root), "runs.jsonl"), "utf8")).toBe("");
    }
    const demo = createFileStore(agentDir("demo", root)).readDecisions();
    expect(demo).toHaveLength(24);
    expect(demo.every((r) => r.mode === "demo" && r.siteId === "demo-solar-ridge")).toBe(true);
    expect(createFileStore(agentDir("live", root)).readDecisions().some((r) => r.siteId === "demo-solar-ridge")).toBe(false);
  });

  it("a demo number never backs a call outside demo mode", async () => {
    for (const mode of ["live", "mock"] as const) {
      const store = createMemoryStore();
      const r = await runCycle({
        mode,
        store,
        loadSites: () => [demoDaySite()],
        getSnapshot: async () => demoDaySnapshot(11),
        spend: () => ({ spentUsd: 0, limitUsd: 1, paidRequests: 0 }),
        now: () => new Date(DEMO_DAY_START + 11 * 3600_000 + 60_000),
      });
      expect(r.run.decided).toBe(0);
      expect(r.decisions).toHaveLength(1);
      expect(r.decisions[0]).toMatchObject({ status: "paused", decision: null, mode });
      expect(r.messages.some((m) => m.kind === "change")).toBe(false);
    }
  });

  it("a demo power price next to a verified hashprice is refused too", async () => {
    const snapshot = { ...buildMockSnapshot("default"), power: demoDaySnapshot(11).power };
    const r = await runCycle({
      mode: "live",
      store: createMemoryStore(),
      loadSites: () => [demoDaySite()],
      getSnapshot: async () => snapshot,
      spend: () => ({ spentUsd: 0, limitUsd: 1, paidRequests: 0 }),
    });
    expect(r.decisions[0]).toMatchObject({ status: "paused", decision: null, pauseKind: "invalid", reason: "Paused · demo number can't back a real call" });
  });
});
