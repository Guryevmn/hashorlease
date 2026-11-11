// Data source interface. Screens work only through it:
// in E0 it is backed by a mock, in E1 by the real Telegraph client with the same response shapes.

import type { AgentStatus } from "../agent/types";
import type {
  AddSiteResult,
  FeedEntry,
  FeedPeriod,
  HourPoint,
  NodeOption,
  Overview,
  Site,
  SiteInput,
  SiteReport,
  Sourced,
  SpendSettings,
  SpendState,
} from "../types";

/** Lightweight status for the header and global banners. */
export interface AppStatus {
  /** Current source time, ISO. */
  now: string;
  spentUsd: number;
  limitUsd: number;
  limitReached: boolean;
  networkDown: boolean;
  /** Time of the last successful refresh, if the network is unavailable. */
  lastGoodAt?: string;
  /** The data is made up (mock): for the "Demo data" banner. */
  demo: boolean;
}

export interface AddSiteEstimate {
  requestsPerDay: number;
  costPerDayUsd: number;
  wouldExceedLimit: boolean;
  limitUsd: number;
}

export interface DataSource {
  getStatus(): Promise<AppStatus>;
  getOverview(): Promise<Overview>;
  getSiteReport(id: string): Promise<SiteReport | null>;
  /** A site without market data (for editing even when market data is unavailable). */
  getSite(id: string): Promise<Site | null>;
  /** The last 24 hours, oldest to newest. */
  getSiteHistory(id: string): Promise<HourPoint[]>;
  getFeed(period: FeedPeriod, siteId: string | "all"): Promise<FeedEntry[]>;
  getSpend(): Promise<SpendState>;
  updateSpendSettings(settings: SpendSettings): Promise<SpendState>;
  searchNodes(query: string): Promise<NodeOption[]>;
  estimateAddSite(input: Pick<SiteInput, "kind">): Promise<AddSiteEstimate>;
  addSite(input: SiteInput): Promise<AddSiteResult>;
  updateSite(id: string, input: SiteInput): Promise<AddSiteResult>;
  deleteSite(id: string): Promise<void>;
  /** Demo only: restore the made-up sites if the list is empty. Not implemented in live mode. */
  loadDemoSites?(): Promise<void>;
  /** Paid refresh for a site (price is refreshCostUsd). */
  refreshSite(id: string): Promise<void>;
  /** How much "Refresh now" costs, $. */
  refreshCostUsd: number;
  /** Hourly agent state (null: could not be determined). */
  getAgentStatus(): Promise<AgentStatus | null>;
  /** The spend limit is set on the server (.env) and can't be changed from the UI. */
  serverLimit: boolean;
  /** Paid reference lease rate (≈ $0.01). Absent: the reference is not implemented in this mode. */
  fetchLeaseGuide?(): Promise<Sourced<string> | null>;
}

export const REFRESH_COST_USD = 0.02;
export const GUIDE_COST_USD = 0.01;
