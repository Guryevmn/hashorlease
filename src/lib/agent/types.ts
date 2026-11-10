// Записи ежечасного агента (data/agent/<mode>/*.jsonl). Только типы: их читают и сервер, и браузер, и бот.

import type { Decision } from "../decision";
import type { ReceiptStatus } from "../types";

export type AgentMode = "live" | "mock";

export interface RecordedReceipt {
  /** Что за цифра: "Mining income", "Power price". */
  label: string;
  status: ReceiptStatus;
  service?: string;
  provider?: string;
  fetchedAt?: string;
  costUsd?: number;
  hash?: string;
  proofUrl?: string;
}

/** Решение по одной площадке за один цикл. */
export interface DecisionRecord {
  /** Когда записано, ISO. */
  at: string;
  /** Начало часа, на который решение, ISO. */
  hour: string;
  mode: AgentMode;
  siteId: string;
  siteName: string;
  mw: number;
  status: "ok" | "paused";
  /** Почему на паузе (для ленты и бота). */
  reason?: string;
  /** Тип паузы — для оповещений. */
  pauseKind?: "limit" | "network" | "provider" | "site-paused" | "invalid";
  decision: Decision | null;
  keepAsIs: boolean;
  /** Решение отличается от предыдущего записанного. */
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

/** Итог одного цикла агента. */
export interface RunRecord {
  at: string;
  hour: string;
  mode: AgentMode;
  ok: boolean;
  sites: number;
  decided: number;
  paused: number;
  changes: { siteId: string; siteName: string; from: Decision; to: Decision }[];
  /** Сколько платных запросов Telegraph сделано за цикл. */
  paidRequests: number;
  spentTodayUsd: number;
  limitUsd: number;
  limitReached: boolean;
  /** Сколько сообщений отправлено в Telegram (0 — бот не настроен). */
  notified: number;
  error?: string;
  durationMs: number;
}

/** Состояние оповещений между циклами: чтобы не слать одно и то же каждый час. */
export interface AlertState {
  /** День (YYYY-MM-DD), за который уже предупредили о лимите. */
  limitAlertDay?: string;
  networkDown?: boolean;
  /** Площадки, по которым уже сообщили о сбое поставщика. */
  providerDown?: string[];
}

export interface AgentStatus {
  mode: AgentMode;
  lastRun: RunRecord | null;
  runsToday: number;
  paidRequestsToday: number;
  /** Расписание: каждый час в hh:01 UTC. */
  schedule: string;
}
