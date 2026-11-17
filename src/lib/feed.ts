// "What would have been" feed: hourly advice + operator marks → missed gain.
// An hour without a mark is not counted: we do not know what the operator did.

import type { Decision, DecisionOutcome } from "./decision";
import { markKey, type MarkMap } from "./marks";
import type { FeedEntry, FeedRow, Site } from "./types";

/** Feed entry for an hour's decision outcome. */
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

/** Missed in an hour, $: advice vs what the operator did. Near-tie hours ("keep as is") are not counted. */
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
  /** Hours with advice (excluding pauses). */
  totalHours: number;
  /** Marked "Followed" or "Did something else". */
  markedHours: number;
  followedHours: number;
  skippedHours: number;
  /** Missed across marked hours, $. */
  missedUsd: number;
  /** Gained by following the advice, $. */
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
  /** Whether the day has marked hours (otherwise "Not marked"). */
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

/** Rows where the call differs from the previous hour's (paused hours have no call, so they never count). */
export function onlyChanges<T extends FeedEntry>(rows: T[]): T[] {
  return rows.filter((r) => r.advice !== null && r.changedFrom !== undefined);
}

/** Reason as a sentence: the agent writes it in lower case, the quiet line wants a capital. */
export function changeReasonText(reason: string | undefined): string | null {
  const t = reason?.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : null;
}

/**
 * Reason that fits one line of an hour row: only what moved, as "Power fell $43.74 → $32.40/MWh".
 * The full sentence (with "… now beats … by …") stays for the opened row.
 */
export function shortChangeReason(reason: string | undefined): string | null {
  const first = reason?.split(";")[0].trim();
  if (!first) return null;
  const m = first.match(/^(power price|mining income) (rose|fell) from (\S+) to (\S+)\/MWh$/i);
  if (m) return `${m[1].toLowerCase() === "power price" ? "Power" : "Income"} ${m[2].toLowerCase()} ${m[3]} → ${m[4]}/MWh`;
  if (/^the site's numbers changed$/i.test(first)) return "Site numbers changed";
  return changeReasonText(first);
}
