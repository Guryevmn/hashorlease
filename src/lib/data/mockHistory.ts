// Made-up hourly history of prices and decisions (deterministic).
// Needed for the "what would have happened" feed and the mini chart. The current hour (i = 0) matches the market snapshot.

import { decide, type Decision, type DecisionOutcome } from "../decision";
import { entryFromOutcome } from "../feed";
import type { FeedEntry, HourPoint, Site } from "../types";

export const MOCK_HASHPRICE = 38.5;
/** Made-up real-time prices by node, $/MWh. */
export const MOCK_POWER_RT: Record<string, number> = {
  HB_HOUSTON: 32.4,
  HB_NORTH: 74.1,
  HB_WEST: 28.1,
};
export const MOCK_POWER_DA: Record<string, number> = {
  HB_HOUSTON: 29.8,
  HB_NORTH: 58.0,
  HB_WEST: 30.2,
};

/** Start of the "current" hour in mock: Nov 8, 2026, 14:00 UTC. */
export const MOCK_HOUR_START = Date.UTC(2026, 10, 8, 14, 0, 0);
export const MAX_HISTORY_HOURS = 720;
const HOUR_MS = 3600_000;

const HASHPRICE_HEAD = [MOCK_HASHPRICE, 41.0, 45.0, 45.5, 44.8];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hashpriceAt(i: number): number {
  if (i < HASHPRICE_HEAD.length) return HASHPRICE_HEAD[i];
  return Math.round((41.5 + 3.5 * Math.sin(0.5 * i + 1.0)) * 100) / 100;
}

export function powerAt(site: Site, i: number): number {
  if (site.kind === "tariff") return site.tariffUsdPerMwh ?? 0;
  const base = (site.nodeId && MOCK_POWER_RT[site.nodeId]) || 40;
  if (i === 0) return base;
  const phase = (hashString(site.id) % 628) / 100;
  return Math.round(base * (1 + 0.35 * Math.sin(0.7 * i + phase)) * 100) / 100;
}

export interface HistoryHour {
  /** How many hours ago (0 = current). */
  i: number;
  hour: string;
  power: number;
  hashprice: number;
  outcome: DecisionOutcome;
}

const cache = new Map<string, HistoryHour[]>();

function siteKey(site: Site): string {
  return JSON.stringify([site.id, site.kind, site.nodeId, site.tariffUsdPerMwh, site.mw, site.phs, site.lease, site.thresholdUsdPerMwh]);
}

/** History from oldest to newest hour, MAX_HISTORY_HOURS entries, the last one being the current hour. */
export function simulateHistory(site: Site): HistoryHour[] {
  const key = siteKey(site);
  const hit = cache.get(key);
  if (hit) return hit;

  const out: HistoryHour[] = [];
  let current: Decision | null = null;
  for (let i = MAX_HISTORY_HOURS - 1; i >= 0; i--) {
    const power = powerAt(site, i);
    const hashprice = hashpriceAt(i);
    const r = decide({
      hashpriceUsdPerPhDay: hashprice,
      powerPriceUsdPerMwh: power,
      mw: site.mw,
      phs: site.phs,
      lease: site.lease ?? null,
      thresholdUsdPerMwh: site.thresholdUsdPerMwh,
      current,
    });
    if (!r.ok) throw new Error("mock history: invalid site " + site.id);
    out.push({
      i,
      hour: new Date(MOCK_HOUR_START - i * HOUR_MS).toISOString(),
      power,
      hashprice,
      outcome: r,
    });
    current = r.chosen;
  }
  cache.set(key, out);
  return out;
}

/** Decision for the hour before the current one: for the "Changed from …" badge. */
export function previousDecisionOf(site: Site): Decision | null {
  const h = simulateHistory(site);
  return h.length >= 2 ? h[h.length - 2].outcome.chosen : null;
}

export function siteHistory24(site: Site): HourPoint[] {
  return simulateHistory(site)
    .slice(-24)
    .map((h) => ({
      hour: h.hour,
      powerPrice: h.power,
      decision: h.outcome.chosen,
      keepAsIs: h.outcome.keepAsIs,
    }));
}

export function feedEntries(site: Site, hours: number, pausedHours: number[] = []): FeedEntry[] {
  const hist = simulateHistory(site).slice(-hours);
  const entries = hist.map((h): FeedEntry => {
    if (pausedHours.includes(h.i)) {
      return { hour: h.hour, siteId: site.id, siteName: site.name, advice: null, keepAsIs: false, options: null, mw: site.mw, adviceGainUsd: 0, powerPrice: h.power, receiptCount: 0 };
    }
    return entryFromOutcome(site, h.hour, h.power, h.outcome);
  });
  return entries.reverse(); // newest first
}
