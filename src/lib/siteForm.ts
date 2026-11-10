// Проверка полей формы «Add site» (значения приходят строками из полей ввода).

import { DEFAULT_THRESHOLD_USD_PER_MWH } from "./decision";
import type { SiteInput } from "./types";

export interface SiteFormValues {
  kind: "grid" | "tariff";
  name: string;
  nodeId: string;
  /** Тариф в $/МВт·ч (форма пересчитывает из $/кВт·ч). */
  tariffUsdPerMwh: string;
  mw: string;
  phs: string;
  jPerTh: string;
  hasLease: boolean;
  leaseRate: string;
  overhead: string;
  includesPower?: boolean;
  threshold: string;
}

export type SiteFormErrors = Partial<Record<keyof SiteFormValues, string>>;

export const MIN_REALISTIC_J_PER_TH = 8;
export const MAX_REALISTIC_J_PER_TH = 200;
export const MAX_NAME_LENGTH = 60;

function num(s: string): number {
  return s.trim() === "" ? Number.NaN : Number(s.replace(",", "."));
}

export function validateSiteInput(v: SiteFormValues): SiteFormErrors {
  const e: SiteFormErrors = {};
  if (!v.name.trim()) e.name = "Give the site a name";
  else if (v.name.trim().length > MAX_NAME_LENGTH) e.name = `Keep the name under ${MAX_NAME_LENGTH} characters`;
  if (v.kind === "grid" && !v.nodeId.trim()) e.nodeId = "Pick a node, hub or region";
  if (v.kind === "tariff") {
    const t = num(v.tariffUsdPerMwh);
    if (!Number.isFinite(t) || t <= 0) e.tariffUsdPerMwh = "Rate must be greater than 0";
  }

  const mw = num(v.mw);
  if (!Number.isFinite(mw) || mw <= 0) e.mw = "Power draw must be greater than 0";
  const phs = num(v.phs);
  if (!Number.isFinite(phs) || phs <= 0) e.phs = "Fleet hashrate must be greater than 0";
  const j = num(v.jPerTh);
  if (!Number.isFinite(j) || j <= 0) e.jPerTh = "Efficiency must be greater than 0";
  else if (j < MIN_REALISTIC_J_PER_TH) e.jPerTh = `Efficiency looks off: ${j} J/TH is below any known miner`;
  else if (j > MAX_REALISTIC_J_PER_TH) e.jPerTh = `Efficiency looks off: ${j} J/TH is far above any known miner`;

  if (v.hasLease) {
    const r = num(v.leaseRate);
    if (!Number.isFinite(r) || r < 0) e.leaseRate = "Lease rate must be 0 or more";
    const o = num(v.overhead);
    if (!Number.isFinite(o) || o < 0) e.overhead = "Overhead must be 0 or more";
  }

  const t = num(v.threshold);
  if (!Number.isFinite(t) || t < 0) e.threshold = "Threshold must be 0 or more";
  return e;
}

/** Подсказка, если три числа флота не сходятся (MW ≈ PH/s × J/TH ÷ 1000). Не блокирует отправку. */
export function fleetConsistencyHint(v: Pick<SiteFormValues, "mw" | "phs" | "jPerTh">): string | null {
  const mw = num(v.mw);
  const phs = num(v.phs);
  const j = num(v.jPerTh);
  if (![mw, phs, j].every((x) => Number.isFinite(x) && x > 0)) return null;
  const expected = (phs * j) / 1000;
  if (Math.abs(expected - mw) / mw > 0.25) {
    return `Numbers don't add up: ${phs} PH/s at ${j} J/TH draws about ${formatMw(expected)} MW, not ${mw} MW.`;
  }
  return null;
}

function formatMw(x: number): string {
  return x >= 1 ? x.toFixed(1) : x.toFixed(3);
}

export function phsPerMwOf(v: Pick<SiteFormValues, "mw" | "phs">): number | null {
  const mw = num(v.mw);
  const phs = num(v.phs);
  return Number.isFinite(mw) && Number.isFinite(phs) && mw > 0 && phs > 0 ? phs / mw : null;
}

export function emptyFormValues(): SiteFormValues {
  return {
    kind: "grid",
    name: "",
    nodeId: "",
    tariffUsdPerMwh: "",
    mw: "",
    phs: "",
    jPerTh: "",
    hasLease: false,
    leaseRate: "",
    overhead: "",
    includesPower: false,
    threshold: String(DEFAULT_THRESHOLD_USD_PER_MWH),
  };
}

export function toSiteInput(v: SiteFormValues, nodeLabel: string): SiteInput {
  return {
    name: v.name.trim(),
    kind: v.kind,
    nodeId: v.kind === "grid" ? v.nodeId : undefined,
    nodeLabel: v.kind === "grid" ? nodeLabel : `Fixed rate $${(num(v.tariffUsdPerMwh) / 1000).toFixed(3)}/kWh`,
    tariffUsdPerMwh: v.kind === "tariff" ? num(v.tariffUsdPerMwh) : undefined,
    mw: num(v.mw),
    phs: num(v.phs),
    jPerTh: num(v.jPerTh),
    lease: v.hasLease
      ? { rateUsdPerMwh: num(v.leaseRate), includesPower: !!v.includesPower, overheadUsdPerMwh: num(v.overhead) }
      : null,
    thresholdUsdPerMwh: num(v.threshold),
  };
}

/** Значения формы из готовой площадки (для Edit site). */
export function formValuesOf(site: SiteInput): SiteFormValues {
  return {
    kind: site.kind,
    name: site.name,
    nodeId: site.nodeId ?? "",
    tariffUsdPerMwh: site.tariffUsdPerMwh !== undefined ? String(site.tariffUsdPerMwh) : "",
    mw: String(site.mw),
    phs: String(site.phs),
    jPerTh: String(site.jPerTh),
    hasLease: !!site.lease,
    leaseRate: site.lease ? String(site.lease.rateUsdPerMwh) : "",
    overhead: site.lease ? String(site.lease.overheadUsdPerMwh) : "",
    includesPower: site.lease?.includesPower ?? false,
    threshold: String(site.thresholdUsdPerMwh),
  };
}

/** Ошибки по уже собранной площадке (та же проверка, что и в форме). */
export function siteInputErrors(input: SiteInput): SiteFormErrors {
  return validateSiteInput(formValuesOf(input));
}

/**
 * Площадка из тела запроса к API: берём только известные поля нужных типов, остальное отбрасываем.
 * null — тело совсем не похоже на площадку.
 */
export function sanitizeSiteInput(body: unknown): SiteInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.kind !== "grid" && b.kind !== "tariff") return null;
  const n = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" ? num(x) : Number.NaN);
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  const lease = b.lease && typeof b.lease === "object" ? (b.lease as Record<string, unknown>) : null;
  return {
    kind: b.kind,
    name: str(b.name).trim(),
    nodeId: b.kind === "grid" ? str(b.nodeId).trim() : undefined,
    nodeLabel: str(b.nodeLabel).slice(0, 120),
    tariffUsdPerMwh: b.kind === "tariff" ? n(b.tariffUsdPerMwh) : undefined,
    mw: n(b.mw),
    phs: n(b.phs),
    jPerTh: n(b.jPerTh),
    lease: lease
      ? { rateUsdPerMwh: n(lease.rateUsdPerMwh), includesPower: lease.includesPower === true, overheadUsdPerMwh: n(lease.overheadUsdPerMwh) }
      : null,
    thresholdUsdPerMwh: n(b.thresholdUsdPerMwh),
    paused: b.paused === true ? true : undefined,
  };
}
