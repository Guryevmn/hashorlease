import { describe, expect, it } from "vitest";
import { groupByDay, groupPauses, pauseWhy, resolveFeed, shortChangeReason, summarizeFeed } from "./feed";
import { loadMarks, markKey, MARKS_KEY, saveMarks, withMarks } from "./marks";
import type { FeedEntry, FeedRow } from "./types";

const entry = (over: Partial<FeedEntry> = {}): FeedEntry => ({
  hour: "2026-11-08T14:00:00.000Z",
  siteId: "s1",
  siteName: "Site",
  advice: "lease",
  keepAsIs: false,
  options: { mine: 10, lease: 20, off: 0 },
  mw: 10,
  adviceGainUsd: 100,
  powerPrice: 30,
  receiptCount: 2,
  ...over,
});
const k = (e: FeedEntry) => markKey(e.siteId, e.hour);

describe("feed: operator marks", () => {
  it("nothing is counted as missed without a mark", () => {
    const [r] = resolveFeed([entry()], {});
    expect(r.status).toBe("not-marked");
    expect(r.missedUsd).toBe(0);
  });

  it("Did something else: missed (advice − done) × MW", () => {
    const e = entry();
    const [r] = resolveFeed([e], { [k(e)]: { kind: "other", actual: "mine" } });
    expect(r.status).toBe("other");
    expect(r.missedUsd).toBe(100); // (20 − 10) × 10
  });

  it("Followed and Skip give no missed gain; Skip does not count as marked", () => {
    const a = entry({ hour: "2026-11-08T13:00:00.000Z" });
    const b = entry({ hour: "2026-11-08T12:00:00.000Z" });
    const rows = resolveFeed([a, b], { [k(a)]: { kind: "followed" }, [k(b)]: { kind: "skip" } });
    expect(rows.map((r) => r.status)).toEqual(["followed", "skipped"]);
    const s = summarizeFeed(rows);
    expect(s).toMatchObject({ markedHours: 1, followedHours: 1, skippedHours: 1, missedUsd: 0, gainedUsd: 100 });
  });

  it("\"keep as is\" hours are never counted as missed", () => {
    const e = entry({ keepAsIs: true });
    expect(resolveFeed([e], { [k(e)]: { kind: "other", actual: "mine" } })[0].missedUsd).toBe(0);
  });

  it("limit pauses are not marked and not counted", () => {
    const e = entry({ advice: null, options: null });
    const rows = resolveFeed([e], { [k(e)]: { kind: "followed" } });
    expect(rows[0].status).toBe("paused");
    expect(summarizeFeed(rows).totalHours).toBe(0);
  });

  it("advice \"Off\" and action \"Mine\": missed equals what mining at a loss cost", () => {
    const e = entry({ advice: "off", options: { mine: -12, lease: null, off: 0 } });
    expect(resolveFeed([e], { [k(e)]: { kind: "other", actual: "mine" } })[0].missedUsd).toBe(120);
  });

  it("grouping by day: a day without marks is flagged as not marked", () => {
    const a = entry({ hour: "2026-11-08T13:00:00.000Z" });
    const b = entry({ hour: "2026-11-07T13:00:00.000Z" });
    const days = groupByDay(resolveFeed([a, b], { [k(a)]: { kind: "other", actual: "off" } }));
    expect(days.map((d) => [d.day, d.marked, d.missedUsd])).toEqual([
      ["2026-11-08", true, 200],
      ["2026-11-07", false, 0],
    ]);
  });
});

describe("mark storage", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (x: string) => m.get(x) ?? null, setItem: (x: string, v: string) => void m.set(x, v) };
  };

  it("saves and reads, clearing a mark removes it", () => {
    const st = mem();
    const e = entry();
    saveMarks(st, withMarks({}, { [k(e)]: { kind: "followed" } }));
    expect(loadMarks(st)).toEqual({ [k(e)]: { kind: "followed" } });
    saveMarks(st, withMarks(loadMarks(st), { [k(e)]: null }));
    expect(loadMarks(st)).toEqual({});
  });

  it("corrupted data does not break the app", () => {
    const st = mem();
    st.setItem(MARKS_KEY, "{oops");
    expect(loadMarks(st)).toEqual({});
    st.setItem(MARKS_KEY, JSON.stringify({ a: { kind: "other", actual: "dance" }, b: { kind: "skip" } }));
    expect(loadMarks(st)).toEqual({ b: { kind: "skip" } });
  });
});

describe("feed: short change reason", () => {
  it("keeps only what moved, on one line", () => {
    expect(shortChangeReason("power price fell from $43.74 to $32.40/MWh; Lease to AI now beats Mine by $6.79/MWh")).toBe("Power fell $43.74 → $32.40/MWh");
    expect(shortChangeReason("mining income rose from $83.90 to $93.33/MWh; Mine now beats Lease to AI by $6.33/MWh")).toBe("Income rose $83.90 → $93.33/MWh");
    expect(shortChangeReason("power price rose from $1,020.00 to $1,124.00/MWh")).toBe("Power rose $1,020.00 → $1,124.00/MWh");
  });
  it("falls back to the first clause with a capital", () => {
    expect(shortChangeReason("the site's numbers changed; Lease to AI now beats Mine by $55.00/MWh")).toBe("Site numbers changed");
    expect(shortChangeReason("something else")).toBe("Something else");
    expect(shortChangeReason(undefined)).toBeNull();
    expect(shortChangeReason("  ")).toBeNull();
  });
});

describe("feed: pauses read as one block", () => {
  const paused = (hour: string, siteName: string): FeedRow => ({
    hour, siteId: siteName.toLowerCase(), siteName, advice: null, keepAsIs: false, options: null, mw: 1, adviceGainUsd: 0, powerPrice: 0,
    receiptCount: 0, pauseReason: "Paused · no fresh Telegraph receipt (Telegraph unavailable)", mark: null, status: "paused", missedUsd: 0,
  });
  const call = (hour: string): FeedRow => ({
    hour, siteId: "s", siteName: "Silesia Farm", advice: "off", keepAsIs: false, options: { mine: 1, lease: 2, off: 0 }, mw: 1,
    adviceGainUsd: 0, powerPrice: 0, receiptCount: 2, mark: null, status: "not-marked", missedUsd: 0,
  });
  it("strips the \"Paused ·\" prefix: the chip already says it", () => {
    expect(pauseWhy("Paused · no fresh Telegraph receipt (Telegraph unavailable)")).toBe("No fresh Telegraph receipt (Telegraph unavailable)");
    expect(pauseWhy(undefined)).toBe("No call this hour");
  });
  it("collapses 3 places × 2 hours into one run and says when decisions came back", () => {
    const rows = [call("2026-11-17T20:00:00Z"), ...["19", "18"].flatMap((h) => ["A", "B", "C"].map((s) => paused(`2026-11-17T${h}:00:00Z`, s)))];
    const items = groupPauses(rows);
    expect(items).toHaveLength(2);
    const run = items[1];
    expect(run.kind).toBe("pause");
    if (run.kind !== "pause") return;
    expect(run).toMatchObject({ from: "2026-11-17T18:00:00Z", to: "2026-11-17T19:00:00Z", hours: 2, sites: ["A", "B", "C"] });
    expect(run.rows).toHaveLength(6);
    expect(run.resumedAt).toBe("2026-11-17T20:00:00.000Z");
  });
  it("a run at the top of a day without a newer call above it has no \"back\" line", () => {
    const items = groupPauses([paused("2026-11-17T19:00:00Z", "A")]);
    expect(items[0].kind === "pause" && items[0].resumedAt).toBeNull();
    const withNewer = groupPauses([paused("2026-11-17T23:00:00Z", "A")], true);
    expect(withNewer[0].kind === "pause" && withNewer[0].resumedAt).toBe("2026-11-18T00:00:00.000Z");
  });
});
