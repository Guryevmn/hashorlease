import { describe, expect, it } from "vitest";
import { createMockDataSource, type KeyValueStore } from "./data/mock";
import { usd } from "./format";
import { paidReceiptsOf } from "./report";
import {
  addSiteCostNote,
  emptyFormValues,
  EXAMPLE_MINERS,
  fleetConsistencyHint,
  firstInvalidField,
  toSiteInput,
  validateSiteInput,
} from "./siteForm";
import type { SiteInput } from "./types";

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("miner fields on the new-place form (tester bug 1)", () => {
  it("start empty, not with 1000/20/20: the grey text must not pass for real values", () => {
    const v = emptyFormValues();
    expect([v.phs, v.mw, v.jPerTh]).toEqual(["", "", ""]);
  });

  it("an empty form is rejected with an error on each miner field, and the first one gets the focus", () => {
    const v = { ...emptyFormValues(), kind: "tariff" as const, tariffUsdPerMwh: "40", name: "Garage" };
    const errors = validateSiteInput(v);
    expect(errors.phs).toBeTruthy();
    expect(errors.mw).toBeTruthy();
    expect(errors.jPerTh).toBeTruthy();
    expect(firstInvalidField(errors)).toBe("phs");
  });

  it("\"Fill with example\" gives numbers that pass validation and add up (PH/s × J/TH ÷ 1000 = MW)", () => {
    const v = { ...emptyFormValues(), kind: "tariff" as const, tariffUsdPerMwh: "40", name: "Garage", ...EXAMPLE_MINERS };
    expect(validateSiteInput(v)).toEqual({});
    expect(fleetConsistencyHint(v)).toBeNull();
    expect(toSiteInput(v, "").phs).toBe(1000);
  });
});

describe("paid requests: form text vs the result (tester bug 2)", () => {
  const tariffSite: SiteInput = {
    name: "Garage test",
    kind: "tariff",
    nodeLabel: "Fixed rate $0.040/kWh",
    tariffUsdPerMwh: 40,
    mw: 20,
    phs: 1000,
    jPerTh: 20,
    lease: null,
    thresholdUsdPerMwh: 5,
  };

  it("a fixed rate still costs 1 paid request for the Bitcoin price, and the form says so", async () => {
    const ds = createMockDataSource({ latencyMs: 0, storage: memoryStore() });
    const added = await ds.addSite(tariffSite);
    if (!added.ok) throw new Error("not added");
    const report = (await ds.getSiteReport(added.site.id))!;

    // What the result shows: one paid request, and it is the shared Bitcoin price (mining income), not a power price.
    const paid = paidReceiptsOf(report);
    expect(paid).toHaveLength(1);
    expect(paid[0][0]).toBe("Mining income");
    const total = paid.reduce((s, [, rc]) => s + (rc.costUsd ?? 0), 0);

    // What the form says for the same kind of site.
    const est = await ds.estimateAddSite({ kind: "tariff" });
    const note = addSiteCostNote(est, false, usd);
    expect(note).toContain("1 shared paid request");
    expect(note).toContain(usd(total, 3));
    expect(note).not.toMatch(/makes no paid grid requests/);
  });

  it("a grid node in the demo adds its own hourly power requests on top: the form shows them", async () => {
    const ds = createMockDataSource({ latencyMs: 0, storage: memoryStore() });
    const est = await ds.estimateAddSite({ kind: "grid" });
    expect(est.requestsPerDay).toBe(24);
    expect(addSiteCostNote(est, false, usd)).toContain("~24 paid requests per day");
    const houston = (await ds.getSiteReport("houston"))!;
    expect(paidReceiptsOf(houston).map(([l]) => l)).toEqual(expect.arrayContaining(["Mining income", "Power price"]));
  });

  it("live: one Bitcoin price request per hour covers all places, for any site kind", () => {
    const note = addSiteCostNote({ requestsPerDay: 0, costPerDayUsd: 0 }, true, usd);
    expect(note).toContain("one paid Telegraph request per hour");
    expect(note).toContain("Bitcoin price");
  });
});
