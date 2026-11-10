import { describe, expect, it } from "vitest";
import { createMockDataSource, type KeyValueStore, type MockState } from "./mock";
import { resolveFeed, summarizeFeed } from "../feed";
import { markKey } from "../marks";
import type { SiteInput } from "../types";

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}
const mk = (state?: MockState) =>
  createMockDataSource({ state, latencyMs: 0, storage: memoryStore() });

describe("mock DataSource: три площадки из docs/screens.md", () => {
  it("решения и суммы совпадают с примером", async () => {
    const o = await mk().getOverview();
    const by = Object.fromEntries(o.reports.map((r) => [r.site.id, r]));
    const h = by["houston"].result!;
    const n = by["north-ridge"].result!;
    const g = by["garage"].result!;
    if (!h.ok || !n.ok || !g.ok) throw new Error("invalid");

    expect(h.chosen).toBe("lease");
    expect(h.changed).toBe(true);
    expect(by["houston"].previousDecision).toBe("mine");
    expect(Math.round(h.gainVsMiningPerHour)).toBe(136);

    expect(n.chosen).toBe("off");
    expect(Math.round(n.gainVsMiningPerHour)).toBe(119);

    expect(g.chosen).toBe("mine");
    expect(g.keepAsIs).toBe(true);
    expect(g.profitPerHour).toBeCloseTo(0.03, 2);

    expect(Math.round(o.totalGainPerHour)).toBe(255);
  });

  it("чеки: Verified у рыночных цифр, Your input у тарифа", async () => {
    const o = await mk().getOverview();
    const houston = o.reports.find((r) => r.site.id === "houston")!;
    const garage = o.reports.find((r) => r.site.id === "garage")!;
    expect(houston.inputs.power.receipt).toMatchObject({ status: "verified", service: "GRID_POWER_PRICE", provider: "m-1f3" });
    expect(garage.inputs.power.receipt.status).toBe("input");
    expect(houston.inputs.leaseRate?.receipt.status).toBe("input");
  });
});

describe("mock DataSource: состояния", () => {
  it("empty → нет площадок", async () => {
    expect((await mk("empty").getOverview()).reports).toHaveLength(0);
  });

  it("error → всё Stale, сеть недоступна", async () => {
    const o = await mk("error").getOverview();
    expect(o.snapshot.networkDown).toBe(true);
    expect(o.reports.every((r) => r.status === "stale")).toBe(true);
    await expect(mk("error").getSpend()).rejects.toThrow();
  });

  it("provider-error → North Ridge на паузе, остальные нет", async () => {
    const o = await mk("provider-error").getOverview();
    const north = o.reports.find((r) => r.site.id === "north-ridge")!;
    expect(north.status).toBe("paused");
    expect(north.result).toBeNull();
    expect(north.inputs.power.receipt.status).toBe("unavailable");
    expect(o.reports.find((r) => r.site.id === "houston")!.status).toBe("ok");
  });

  it("limit → лимит достигнут, карточки Stale, обновление запрещено", async () => {
    const ds = mk("limit");
    const s = await ds.getStatus();
    expect(s.limitReached).toBe(true);
    expect((await ds.getOverview()).reports.every((r) => r.status === "stale")).toBe(true);
    await expect(ds.refreshSite("houston")).rejects.toThrow();
    const raised = await ds.updateSpendSettings({ limitUsd: 2, stopAtLimit: true, alertAtPct: 80 });
    expect(raised.limitReached).toBe(false);
  });
});

describe("mock DataSource: лента и расходы", () => {
  it("лента за 24 ч: по строке на час, без выдуманных действий оператора", async () => {
    const feed = await mk().getFeed("24h", "houston");
    expect(feed).toHaveLength(24);
    expect(feed[0]).toMatchObject({ advice: "lease", keepAsIs: false });
    const rows = resolveFeed(feed, {});
    expect(rows.every((r) => r.status === "not-marked" && r.missedUsd === 0)).toBe(true);
    const s = summarizeFeed(rows);
    expect(s).toMatchObject({ totalHours: 24, markedHours: 0, missedUsd: 0 });
  });

  it("упущенная выгода считается только по отмеченным часам", async () => {
    const feed = await mk().getFeed("24h", "houston");
    const marks = {
      [markKey("houston", feed[0].hour)]: { kind: "other", actual: "mine" } as const,
      [markKey("houston", feed[1].hour)]: { kind: "followed" } as const,
    };
    const s = summarizeFeed(resolveFeed(feed, marks));
    expect(s.markedHours).toBe(2);
    expect(Math.round(s.missedUsd)).toBe(136);
  });

  it("в состоянии limit в ленте есть паузы", async () => {
    const feed = await mk("limit").getFeed("24h", "all");
    expect(feed.filter((e) => e.advice === null).length).toBe(9);
  });

  it("Try demo data возвращает выдуманные площадки после удаления всех", async () => {
    const ds = mk();
    for (const r of (await ds.getOverview()).reports) await ds.deleteSite(r.site.id);
    expect((await ds.getOverview()).reports).toHaveLength(0);
    await ds.loadDemoSites!();
    expect((await ds.getOverview()).reports).toHaveLength(3);
  });

  it("расходы: $0.42 из $1.00, прогноз $0.73", async () => {
    const sp = await mk().getSpend();
    expect(sp.spentUsd).toBe(0.42);
    expect(sp.limitUsd).toBe(1);
    expect(sp.forecastPerDayUsd).toBe(0.73);
    expect(sp.byService.reduce((s, b) => s + b.costUsd, 0)).toBeCloseTo(0.42, 9);
  });
});

describe("mock DataSource: добавление площадки", () => {
  const input: SiteInput = {
    name: "Test Site",
    kind: "grid",
    nodeId: "HB_WEST",
    nodeLabel: "ERCOT West hub (HB_WEST)",
    mw: 10,
    phs: 500,
    jPerTh: 20,
    lease: null,
    thresholdUsdPerMwh: 5,
  };

  it("добавляет и сохраняет", async () => {
    const ds = mk();
    const r = await ds.addSite(input);
    expect(r.ok).toBe(true);
    const o = await ds.getOverview();
    expect(o.reports).toHaveLength(4);
    expect(o.reports[3].result?.ok).toBe(true);
  });

  it("неизвестный узел и некорректный ввод отклоняются", async () => {
    const ds = mk();
    expect(await ds.addSite({ ...input, nodeId: "NOPE" })).toMatchObject({ ok: false, error: "node-not-found" });
    expect(await ds.addSite({ ...input, mw: 0 })).toMatchObject({ ok: false, error: "invalid" });
  });
});
