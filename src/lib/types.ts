// Shared data types. The real Telegraph client (E1) must return the same shapes;
// screens do not depend on the data source.

import type { Decision, DecisionResult } from "./decision";

/**
 * Status of the receipt on a number. "public" — a number from a free public source (not Telegraph):
 * no payment receipt, only a link to the source.
 */
export type ReceiptStatus = "verified" | "stale" | "unavailable" | "input" | "public";

/**
 * Telegraph receipt. The exact format will be known after the first paid request (E1),
 * so all fields except the status are optional.
 */
export interface Receipt {
  status: ReceiptStatus;
  service?: string;
  /** Miner/supplier, e.g. "m-1f3". */
  provider?: string;
  /** ISO time of receipt. */
  fetchedAt?: string;
  costUsd?: number;
  /** Short receipt hash, e.g. "0x55f8…e138". */
  hash?: string;
  proofUrl?: string;
  /** Data source, e.g. "ERCOT, real-time LMP". */
  source?: string;
  network: "testnet" | "mainnet";
}

export interface Sourced<T> {
  value: T;
  receipt: Receipt;
}

export interface PowerQuote {
  /** Real-time, $/MWh. null — the supplier did not respond and there is no last value. */
  realTime: Sourced<number | null>;
  dayAhead?: number;
}

/** Market numbers "now" together with receipts. */
export interface MarketSnapshot {
  asOf: string;
  hashprice: Sourced<number | null>;
  /** Key — node id, e.g. "HB_HOUSTON". */
  power: Record<string, PowerQuote>;
  /** Lease rate reference (WEB_SEARCH), a hint only. */
  leaseGuide: Sourced<string> | null;
  /** Telegraph is unavailable: all numbers are the last known ones. */
  networkDown: boolean;
  /** Time of the last successful refresh when networkDown. */
  lastGoodAt?: string;
  /** Paid request not made: daily limit exhausted. */
  limitReached?: boolean;
}

export interface Site {
  id: string;
  name: string;
  kind: "grid" | "tariff";
  /** For grid: node id ("HB_HOUSTON"). */
  nodeId?: string;
  nodeLabel: string;
  /** For tariff: tariff, $/MWh. */
  tariffUsdPerMwh?: number;
  mw: number;
  phs: number;
  jPerTh: number;
  lease?: { rateUsdPerMwh: number; includesPower: boolean; overheadUsdPerMwh: number } | null;
  thresholdUsdPerMwh: number;
  /** Decision in effect before the current hour. */
  lastDecision?: Decision | null;
  /** Added with "Add anyway (paused)": no requests are made. */
  paused?: boolean;
}

export type SiteInput = Omit<Site, "id" | "lastDecision">;

export type ReportStatus = "ok" | "stale" | "paused";

export interface SiteReport {
  site: Site;
  status: ReportStatus;
  /** Reason for the pause, UI text. */
  pausedReason?: string;
  asOf: string;
  inputs: {
    hashprice: Sourced<number | null>;
    power: Sourced<number | null>;
    powerDayAhead?: number;
    leaseRate: Sourced<number> | null;
    overhead: Sourced<number> | null;
    leaseGuide: Sourced<string> | null;
  };
  /** null — no decision is issued (paused). */
  result: DecisionResult | null;
  previousDecision: Decision | null;
}

export interface Overview {
  snapshot: MarketSnapshot;
  reports: SiteReport[];
  /** Total gain vs "mine everywhere", $/h. */
  totalGainPerHour: number;
}

// ---- Costs ----

export type RequestStatus = "paid" | "failed" | "blocked";

export interface SpendLogEntry {
  at: string;
  service: string;
  siteName: string;
  provider?: string;
  costUsd: number;
  status: RequestStatus;
  hash?: string;
  proofUrl?: string;
}

export interface SpendState {
  limitUsd: number;
  stopAtLimit: boolean;
  alertAtPct: number;
  spentUsd: number;
  limitReached: boolean;
  forecastPerDayUsd: number;
  forecastNote: string;
  byService: { service: string; requests: number; costUsd: number }[];
  log: SpendLogEntry[];
}

export interface SpendSettings {
  limitUsd: number;
  stopAtLimit: boolean;
  alertAtPct: number;
}

// ---- "What would have been" feed ----

/** Operator mark for an hour: what they actually did. No mark — missed gain is not counted. */
export type Mark = { kind: "followed" } | { kind: "other"; actual: Decision } | { kind: "skip" };

/** Advice for one hour at one site (without an operator mark). */
export interface FeedEntry {
  /** ISO start of the hour. */
  hour: string;
  siteId: string;
  siteName: string;
  /** null — the hour is paused (limit, no data), no advice. */
  advice: Decision | null;
  /** Why the hour is paused, UI text. */
  pauseReason?: string;
  /** Decision recorded by the hourly agent (not recomputed from price history). */
  recorded?: boolean;
  keepAsIs: boolean;
  /** Option values for the hour, $/MWh; needed to compute the missed gain from a mark. */
  options: { mine: number; lease: number | null; off: number } | null;
  /** Site power draw, MW. */
  mw: number;
  /** What the advice yielded vs "mine", $/h. */
  adviceGainUsd: number;
  /** Electricity price in that hour, $/MWh. */
  powerPrice: number;
  receiptCount: number;
}

export type FeedStatus = "paused" | "not-marked" | "followed" | "other" | "skipped";

/** Feed row taking the operator mark into account. */
export interface FeedRow extends FeedEntry {
  mark: Mark | null;
  status: FeedStatus;
  /** Missed, $ per hour; only for marked hours. */
  missedUsd: number;
}

export type FeedPeriod = "24h" | "7d" | "30d";

export interface HourPoint {
  hour: string;
  powerPrice: number;
  decision: Decision | null;
  keepAsIs: boolean;
}

// ---- Node search and adding a site ----

export interface NodeOption {
  id: string;
  label: string;
}

export type AddSiteResult =
  | { ok: true; site: Site }
  | { ok: false; error: "node-not-found" | "network" | "invalid"; message: string };
