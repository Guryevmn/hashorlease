import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DecisionRecord } from "../agent/types";
import { changeReasonText, onlyChanges, resolveFeed } from "../feed";
import { entryFromRecord } from "./live";

// Two real calls from the live journal: Silesia Farm, Nov 15, 2026 (off → lease at 08:00, lease → off at 13:00 UTC).
const base: DecisionRecord = {
  at: "2026-11-15T08:01:00.030Z",
  hour: "2026-11-15T08:00:00.000Z",
  mode: "live",
  siteId: "silesia",
  siteName: "Silesia Farm",
  mw: 12,
  status: "ok",
  decision: "lease",
  keepAsIs: false,
  changed: true,
  previous: "off",
  why: "power price fell from $123.79 to $54.00/MWh; Lease to AI now beats Switch off by $8.00/MWh",
  options: { mine: -1.81666666666667, lease: 8, off: 0 },
  chosenUsdPerMwh: 8,
  gainVsMiningPerHour: 117.8,
  profitPerHour: 96,
  hashprice: 31.31,
  powerPrice: 54,
  receipts: [],
};
const toOff: DecisionRecord = {
  ...base,
  at: "2026-11-15T13:00:59.985Z",
  hour: "2026-11-15T13:00:00.000Z",
  decision: "off",
  previous: "lease",
  why: "power price rose from $66.60 to $169.43/MWh; Switch off now beats Lease to AI by $107.43/MWh",
  options: { mine: -116.53, lease: -107.43, off: 0 },
  powerPrice: 169.43,
};

describe("feed: decision change from the agent journal", () => {
  it("a changed record carries what it was before and the reason", () => {
    const e = entryFromRecord(base);
    expect(e).toMatchObject({ advice: "lease", changedFrom: "off", recorded: true });
    expect(e.changeReason).toBe(base.why);
  });

  it("an unchanged record has no change fields", () => {
    const e = entryFromRecord({ ...base, changed: false, previous: "lease", why: "Lease to AI leads Mine by $9.82/MWh" });
    expect(e.changedFrom).toBeUndefined();
    expect(e.changeReason).toBeUndefined();
  });

  it("a change without a written reason is still shown as a change", () => {
    const e = entryFromRecord({ ...base, why: undefined });
    expect(e.changedFrom).toBe("off");
    expect(e.changeReason).toBeUndefined();
  });

  it("a paused hour is never a change", () => {
    const e = entryFromRecord({ ...base, status: "paused", decision: null, changed: false, reason: "Daily limit reached" });
    expect(e.changedFrom).toBeUndefined();
    expect(onlyChanges([e])).toHaveLength(0);
  });

  it("\"Changes only\" keeps exactly the two Nov 15 calls and survives marks", () => {
    const quiet = entryFromRecord({ ...base, hour: "2026-11-15T09:00:00.000Z", changed: false, previous: "lease", why: undefined });
    const rows = resolveFeed([entryFromRecord(toOff), quiet, entryFromRecord(base)], {});
    const changes = onlyChanges(rows);
    expect(changes.map((r) => [r.hour.slice(11, 16), r.changedFrom, r.advice])).toEqual([
      ["13:00", "lease", "off"],
      ["08:00", "off", "lease"],
    ]);
  });

  it("the reason starts with a capital letter, an empty one is dropped", () => {
    expect(changeReasonText(base.why)).toMatch(/^Power price fell from \$123\.79/);
    expect(changeReasonText("  ")).toBeNull();
    expect(changeReasonText(undefined)).toBeNull();
  });
});

// Reads the real journal (read only). Skipped on a checkout that has no data/ folder.
const journal = join(process.cwd(), "data/agent/live/decisions.jsonl");
describe.skipIf(!existsSync(journal))("feed: real journal data/agent/live/decisions.jsonl", () => {
  const records = (): DecisionRecord[] =>
    readFileSync(journal, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as DecisionRecord);

  it("every changed record in the journal becomes a change row with a reason and a different previous call", () => {
    const changed = records().filter((r) => r.changed);
    const rows = changed.map(entryFromRecord);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.changedFrom).toBeDefined();
      expect(r.changedFrom).not.toBe(r.advice);
      expect(r.changeReason).toBeTruthy();
    }
  });

  it("Silesia Farm, Nov 15: 08:00 Off → Lease and 13:00 Lease → Off", () => {
    const rows = onlyChanges(records().filter((r) => r.siteId === "silesia" && r.hour.startsWith("2026-11-15")).map(entryFromRecord));
    expect(rows.map((r) => [r.hour.slice(11, 16), r.changedFrom, r.advice])).toEqual([
      ["08:00", "off", "lease"],
      ["13:00", "lease", "off"],
    ]);
    expect(rows[0].changeReason).toMatch(/^power price fell from \$123\.79 to \$54\.00/);
  });
});
