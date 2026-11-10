import { describe, expect, it } from "vitest";
import { groupByDay, resolveFeed, summarizeFeed } from "./feed";
import { loadMarks, markKey, MARKS_KEY, saveMarks, withMarks } from "./marks";
import type { FeedEntry } from "./types";

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

describe("лента: отметки оператора", () => {
  it("без отметки упущенное не считается", () => {
    const [r] = resolveFeed([entry()], {});
    expect(r.status).toBe("not-marked");
    expect(r.missedUsd).toBe(0);
  });

  it("Did something else: упущено (совет − сделанное) × МВт", () => {
    const e = entry();
    const [r] = resolveFeed([e], { [k(e)]: { kind: "other", actual: "mine" } });
    expect(r.status).toBe("other");
    expect(r.missedUsd).toBe(100); // (20 − 10) × 10
  });

  it("Followed и Skip не дают упущенного; Skip не считается отмеченным", () => {
    const a = entry({ hour: "2026-11-08T13:00:00.000Z" });
    const b = entry({ hour: "2026-11-08T12:00:00.000Z" });
    const rows = resolveFeed([a, b], { [k(a)]: { kind: "followed" }, [k(b)]: { kind: "skip" } });
    expect(rows.map((r) => r.status)).toEqual(["followed", "skipped"]);
    const s = summarizeFeed(rows);
    expect(s).toMatchObject({ markedHours: 1, followedHours: 1, skippedHours: 1, missedUsd: 0, gainedUsd: 100 });
  });

  it("часы «keep as is» никогда не считаются упущенными", () => {
    const e = entry({ keepAsIs: true });
    expect(resolveFeed([e], { [k(e)]: { kind: "other", actual: "mine" } })[0].missedUsd).toBe(0);
  });

  it("паузы лимита не отмечаются и не входят в счёт", () => {
    const e = entry({ advice: null, options: null });
    const rows = resolveFeed([e], { [k(e)]: { kind: "followed" } });
    expect(rows[0].status).toBe("paused");
    expect(summarizeFeed(rows).totalHours).toBe(0);
  });

  it("совет «Off» и действие «Mine»: упущено столько, сколько стоило майнить в убыток", () => {
    const e = entry({ advice: "off", options: { mine: -12, lease: null, off: 0 } });
    expect(resolveFeed([e], { [k(e)]: { kind: "other", actual: "mine" } })[0].missedUsd).toBe(120);
  });

  it("группировка по дням: день без отметок помечен как не отмеченный", () => {
    const a = entry({ hour: "2026-11-08T13:00:00.000Z" });
    const b = entry({ hour: "2026-11-07T13:00:00.000Z" });
    const days = groupByDay(resolveFeed([a, b], { [k(a)]: { kind: "other", actual: "off" } }));
    expect(days.map((d) => [d.day, d.marked, d.missedUsd])).toEqual([
      ["2026-11-08", true, 200],
      ["2026-11-07", false, 0],
    ]);
  });
});

describe("хранение отметок", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (x: string) => m.get(x) ?? null, setItem: (x: string, v: string) => void m.set(x, v) };
  };

  it("сохраняет и читает, снятие отметки удаляет её", () => {
    const st = mem();
    const e = entry();
    saveMarks(st, withMarks({}, { [k(e)]: { kind: "followed" } }));
    expect(loadMarks(st)).toEqual({ [k(e)]: { kind: "followed" } });
    saveMarks(st, withMarks(loadMarks(st), { [k(e)]: null }));
    expect(loadMarks(st)).toEqual({});
  });

  it("повреждённые данные не ломают приложение", () => {
    const st = mem();
    st.setItem(MARKS_KEY, "{oops");
    expect(loadMarks(st)).toEqual({});
    st.setItem(MARKS_KEY, JSON.stringify({ a: { kind: "other", actual: "dance" }, b: { kind: "skip" } }));
    expect(loadMarks(st)).toEqual({ b: { kind: "skip" } });
  });
});
