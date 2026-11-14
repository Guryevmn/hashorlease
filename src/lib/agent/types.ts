// Hourly agent records (data/agent/<mode>/*.jsonl). Types only: read by the server, the browser and the bot.

import type { Decision } from "../decision";
import type { ReceiptStatus } from "../types";

/** "demo" — the simulated demo day (invented prices, src/lib/demo/day.ts); its journal lives in its own folder. */
export type AgentMode = "live" | "mock" | "demo";

export interface RecordedReceipt {
  /** What the figure is: "Mining income", "Power price". */
  label: string;
  status: ReceiptStatus;
  service?: string;
  provider?: string;
  fetchedAt?: string;
  costUsd?: number;
  hash?: string;
  proofUrl?: string;
}

/** Decision for one site in one cycle. */
export interface DecisionRecord {
  /** When recorded, ISO. */
  at: string;
  /** Start of the hour the decision is for, ISO. */
  hour: string;
  mode: AgentMode;
  siteId: string;
  siteName: string;
  mw: number;
  status: "ok" | "paused";
  /** Why paused (for the feed and the bot). */
  reason?: string;
  /** Why this call, in one line: what moved and by how much (for the journal, the bot and the demo day). */
  why?: string;
  /** Pause type, for alerts. */
  pauseKind?: "limit" | "network" | "provider" | "site-paused" | "invalid";
  decision: Decision | null;
  keepAsIs: boolean;
  /** Decision differs from the previous recorded one. */
  changed: boolean;
  previous: Decision | null;
  options: { mine: number; lease: number | null; off: number } | null;
  chosenUsdPerMwh: number | null;
  gainVsMiningPerHour: number | null;
  profitPerHour: number | null;
  hashprice: number | null;
  powerPrice: number | null;
  receipts: RecordedReceipt[];
}

/** Result of one agent cycle. */
export interface RunRecord {
  at: string;
  hour: string;
  mode: AgentMode;
  ok: boolean;
  sites: number;
  decided: number;
  paused: number;
  changes: { siteId: string; siteName: string; from: Decision; to: Decision }[];
  /** How many paid Telegraph requests were made in the cycle. */
  paidRequests: number;
  spentTodayUsd: number;
  limitUsd: number;
  limitReached: boolean;
  /** How many messages were sent to Telegram (0 = bot not configured). */
  notified: number;
  error?: string;
  durationMs: number;
}

/** Alert state between cycles, so the same thing is not sent every hour. */
export interface AlertState {
  /** Day (YYYY-MM-DD) for which the limit warning was already sent. */
  limitAlertDay?: string;
  networkDown?: boolean;
  /** Consecutive cycles that failed on the network; the alert goes out on the second one (the first is retried quietly in 10 min). */
  networkFails?: number;
  /** Sites for which a provider failure was already reported. */
  providerDown?: string[];
}

export interface AgentStatus {
  mode: AgentMode;
  lastRun: RunRecord | null;
  runsToday: number;
  paidRequestsToday: number;
  /** Schedule: every hour at hh:01 UTC. */
  schedule: string;
}
