// Интерфейс источника данных. Экраны работают только через него:
// в Э0 подставлен mock, в Э1 — реальный клиент Telegraph с той же формой ответов.

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

/** Лёгкий статус для шапки и глобальных плашек. */
export interface AppStatus {
  /** Текущее время источника, ISO. */
  now: string;
  spentUsd: number;
  limitUsd: number;
  limitReached: boolean;
  networkDown: boolean;
  /** Время последнего удачного обновления, если сеть недоступна. */
  lastGoodAt?: string;
  /** Данные выдуманные (mock) — для плашки «Demo data». */
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
  /** Площадка без рыночных данных (для правки, даже когда данные рынка недоступны). */
  getSite(id: string): Promise<Site | null>;
  /** Последние 24 часа, от старых к новым. */
  getSiteHistory(id: string): Promise<HourPoint[]>;
  getFeed(period: FeedPeriod, siteId: string | "all"): Promise<FeedEntry[]>;
  getSpend(): Promise<SpendState>;
  updateSpendSettings(settings: SpendSettings): Promise<SpendState>;
  searchNodes(query: string): Promise<NodeOption[]>;
  estimateAddSite(input: Pick<SiteInput, "kind">): Promise<AddSiteEstimate>;
  addSite(input: SiteInput): Promise<AddSiteResult>;
  updateSite(id: string, input: SiteInput): Promise<AddSiteResult>;
  deleteSite(id: string): Promise<void>;
  /** Только демо: вернуть выдуманные площадки, если список пуст. В живом режиме не реализуется. */
  loadDemoSites?(): Promise<void>;
  /** Платное обновление по площадке (цена — refreshCostUsd). */
  refreshSite(id: string): Promise<void>;
  /** Сколько стоит «Refresh now», $. */
  refreshCostUsd: number;
  /** Состояние ежечасного агента (null — не удалось узнать). */
  getAgentStatus(): Promise<AgentStatus | null>;
  /** Лимит трат задаётся на сервере (.env) и из интерфейса не меняется. */
  serverLimit: boolean;
  /** Платный ориентир ставки аренды (≈ $0.01). Нет — в этом режиме ориентир не реализован. */
  fetchLeaseGuide?(): Promise<Sourced<string> | null>;
}

export const REFRESH_COST_USD = 0.02;
export const GUIDE_COST_USD = 0.01;
