// Общие типы данных. Реальный клиент Telegraph (Э1) должен отдавать то же самое,
// экраны от источника данных не зависят.

import type { Decision, DecisionResult } from "./decision";

/**
 * Статус чека у цифры. "public" — цифра из бесплатного публичного источника (не Telegraph):
 * чека оплаты нет, есть только ссылка на источник.
 */
export type ReceiptStatus = "verified" | "stale" | "unavailable" | "input" | "public";

/**
 * Чек Telegraph. Точный формат станет известен после первого платного запроса (Э1),
 * поэтому все поля, кроме статуса, необязательные.
 */
export interface Receipt {
  status: ReceiptStatus;
  service?: string;
  /** Майнер/поставщик, например "m-1f3". */
  provider?: string;
  /** ISO-время получения. */
  fetchedAt?: string;
  costUsd?: number;
  /** Короткий хеш чека, например "0x55f8…e138". */
  hash?: string;
  proofUrl?: string;
  /** Источник данных, например "ERCOT, real-time LMP". */
  source?: string;
  network: "testnet" | "mainnet";
}

export interface Sourced<T> {
  value: T;
  receipt: Receipt;
}

export interface PowerQuote {
  /** Real-time, $/МВт·ч. null — поставщик не ответил и последнего значения нет. */
  realTime: Sourced<number | null>;
  dayAhead?: number;
}

/** Рыночные цифры «сейчас» вместе с чеками. */
export interface MarketSnapshot {
  asOf: string;
  hashprice: Sourced<number | null>;
  /** Ключ — id узла, например "HB_HOUSTON". */
  power: Record<string, PowerQuote>;
  /** Ориентир ставки аренды (WEB_SEARCH), только подсказка. */
  leaseGuide: Sourced<string> | null;
  /** Telegraph недоступен: все цифры — последние известные. */
  networkDown: boolean;
  /** Время последнего удачного обновления при networkDown. */
  lastGoodAt?: string;
  /** Платный запрос не сделан: дневной лимит исчерпан. */
  limitReached?: boolean;
}

export interface Site {
  id: string;
  name: string;
  kind: "grid" | "tariff";
  /** Для grid: id узла ("HB_HOUSTON"). */
  nodeId?: string;
  nodeLabel: string;
  /** Для tariff: тариф, $/МВт·ч. */
  tariffUsdPerMwh?: number;
  mw: number;
  phs: number;
  jPerTh: number;
  lease?: { rateUsdPerMwh: number; includesPower: boolean; overheadUsdPerMwh: number } | null;
  thresholdUsdPerMwh: number;
  /** Действующее решение до текущего часа. */
  lastDecision?: Decision | null;
  /** Добавлена с «Add anyway (paused)»: запросы не делаются. */
  paused?: boolean;
}

export type SiteInput = Omit<Site, "id" | "lastDecision">;

export type ReportStatus = "ok" | "stale" | "paused";

export interface SiteReport {
  site: Site;
  status: ReportStatus;
  /** Причина паузы, текст для интерфейса. */
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
  /** null — решение не выдаётся (пауза). */
  result: DecisionResult | null;
  previousDecision: Decision | null;
}

export interface Overview {
  snapshot: MarketSnapshot;
  reports: SiteReport[];
  /** Суммарный выигрыш против «майнить везде», $/ч. */
  totalGainPerHour: number;
}

// ---- Расходы ----

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

// ---- Лента «что было бы» ----

/** Отметка оператора по часу: что он реально сделал. Нет отметки — упущенную выгоду не считаем. */
export type Mark = { kind: "followed" } | { kind: "other"; actual: Decision } | { kind: "skip" };

/** Совет за один час по одной площадке (без отметки оператора). */
export interface FeedEntry {
  /** ISO начала часа. */
  hour: string;
  siteId: string;
  siteName: string;
  /** null — час на паузе (лимит, нет данных), совета нет. */
  advice: Decision | null;
  /** Почему час на паузе, текст для интерфейса. */
  pauseReason?: string;
  /** Решение записано ежечасным агентом (а не досчитано по истории цен). */
  recorded?: boolean;
  keepAsIs: boolean;
  /** Значения вариантов за час, $/МВт·ч; нужны, чтобы посчитать упущенное по отметке. */
  options: { mine: number; lease: number | null; off: number } | null;
  /** Потребление площадки, МВт. */
  mw: number;
  /** Что дал совет против «майнить», $/ч. */
  adviceGainUsd: number;
  /** Цена электричества в этот час, $/МВт·ч. */
  powerPrice: number;
  receiptCount: number;
}

export type FeedStatus = "paused" | "not-marked" | "followed" | "other" | "skipped";

/** Строка ленты с учётом отметки оператора. */
export interface FeedRow extends FeedEntry {
  mark: Mark | null;
  status: FeedStatus;
  /** Упущено, $ за час; только по отмеченным часам. */
  missedUsd: number;
}

export type FeedPeriod = "24h" | "7d" | "30d";

export interface HourPoint {
  hour: string;
  powerPrice: number;
  decision: Decision | null;
  keepAsIs: boolean;
}

// ---- Поиск узлов и добавление площадки ----

export interface NodeOption {
  id: string;
  label: string;
}

export type AddSiteResult =
  | { ok: true; site: Site }
  | { ok: false; error: "node-not-found" | "network" | "invalid"; message: string };
