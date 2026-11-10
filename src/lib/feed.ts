// Лента «что было бы»: совет по часам + отметки оператора → упущенная выгода.
// Без отметки час не считается: что делал оператор, мы не знаем.

import type { Decision, DecisionOutcome } from "./decision";
import { markKey, type MarkMap } from "./marks";
import type { FeedEntry, FeedRow, Site } from "./types";

/** Запись ленты по итогу решения за час. */
export function entryFromOutcome(
  site: Pick<Site, "id" | "name" | "mw" | "kind">,
  hour: string,
  powerPrice: number,
  o: DecisionOutcome,
): FeedEntry {
  return {
    hour,
    siteId: site.id,
    siteName: site.name,
    advice: o.chosen,
    keepAsIs: o.keepAsIs,
    options: o.options,
    mw: site.mw,
    adviceGainUsd: o.gainVsMiningPerHour,
    powerPrice,
    receiptCount: site.kind === "tariff" ? 1 : 2,
  };
}

/** Упущено за час, $: совет против того, что оператор сделал. Близкие часы («keep as is») не считаются. */
function missedIfActual(e: FeedEntry, actual: Decision): number {
  if (!e.advice || !e.options || e.keepAsIs) return 0;
  const actualValue = e.options[actual];
  if (actualValue === null) return 0;
  return Math.max(0, (e.options[e.advice]! - actualValue) * e.mw);
}

export function resolveFeed(entries: FeedEntry[], marks: MarkMap): FeedRow[] {
  return entries.map((e): FeedRow => {
    if (!e.advice) return { ...e, mark: null, status: "paused", missedUsd: 0 };
    const mark = marks[markKey(e.siteId, e.hour)] ?? null;
    if (!mark) return { ...e, mark, status: "not-marked", missedUsd: 0 };
    if (mark.kind === "skip") return { ...e, mark, status: "skipped", missedUsd: 0 };
    if (mark.kind === "followed" || mark.actual === e.advice) return { ...e, mark, status: "followed", missedUsd: 0 };
    return { ...e, mark, status: "other", missedUsd: missedIfActual(e, mark.actual) };
  });
}

export interface FeedSummary {
  /** Часы с советом (без пауз). */
  totalHours: number;
  /** Отмечено «Followed» или «Did something else». */
  markedHours: number;
  followedHours: number;
  skippedHours: number;
  /** Упущено по отмеченным часам, $. */
  missedUsd: number;
  /** Выиграно за счёт того, что следовали совету, $. */
  gainedUsd: number;
}

export function summarizeFeed(rows: FeedRow[]): FeedSummary {
  const counted = rows.filter((r) => r.status !== "paused");
  const followed = counted.filter((r) => r.status === "followed");
  const other = counted.filter((r) => r.status === "other");
  return {
    totalHours: counted.length,
    markedHours: followed.length + other.length,
    followedHours: followed.length,
    skippedHours: counted.filter((r) => r.status === "skipped").length,
    missedUsd: other.reduce((s, r) => s + r.missedUsd, 0),
    gainedUsd: followed.reduce((s, r) => s + Math.max(0, r.adviceGainUsd), 0),
  };
}

export interface FeedDay {
  /** YYYY-MM-DD (UTC). */
  day: string;
  entries: FeedRow[];
  /** Есть ли в дне отмеченные часы (иначе «Not marked»). */
  marked: boolean;
  missedUsd: number;
}

export function groupByDay(rows: FeedRow[]): FeedDay[] {
  const days = new Map<string, FeedDay>();
  for (const e of rows) {
    const day = e.hour.slice(0, 10);
    const d = days.get(day) ?? { day, entries: [], marked: false, missedUsd: 0 };
    d.entries.push(e);
    d.missedUsd += e.missedUsd;
    if (e.status === "followed" || e.status === "other") d.marked = true;
    days.set(day, d);
  }
  return [...days.values()];
}
