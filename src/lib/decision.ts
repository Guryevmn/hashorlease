// Логика решения «Mine / Lease to AI / Switch off» на МВт·ч (docs/PLAN.md §2).
// Чистые функции: без UI, сети и времени.

export type Decision = "mine" | "lease" | "off";

export const DEFAULT_THRESHOLD_USD_PER_MWH = 5;

/** Порядок предпочтения при равенстве значений (если нет текущего решения). */
const TIE_ORDER: Decision[] = ["mine", "lease", "off"];
const EPS = 1e-9;

export interface LeaseTerms {
  /** Ставка контракта, $/МВт·ч. */
  rateUsdPerMwh: number;
  /** «Ставка за всё»: электричество уже включено, не вычитать. */
  includesPower: boolean;
  /** Накладные, $/МВт·ч. */
  overheadUsdPerMwh: number;
}

export interface DecisionInput {
  /** $ за PH/s в день. */
  hashpriceUsdPerPhDay: number;
  /** Цена электричества, $/МВт·ч (может быть отрицательной). */
  powerPriceUsdPerMwh: number;
  /** Потребление площадки, МВт. */
  mw: number;
  /** Хешрейт флота, PH/s. */
  phs: number;
  /** Условия ИИ-аренды; нет — вариант «Lease» недоступен. */
  lease?: LeaseTerms | null;
  /** Оплата за снижение нагрузки при выключении, $/МВт·ч. */
  curtailmentUsdPerMwh?: number;
  /** Порог «оставить как есть», $/МВт·ч. */
  thresholdUsdPerMwh?: number;
  /** Решение, которое сейчас действует на площадке. */
  current?: Decision | null;
}

export interface DecisionOutcome {
  ok: true;
  /** Значения вариантов, $/МВт·ч. lease = null, если ставка не задана. */
  options: { mine: number; lease: number | null; off: number };
  phsPerMw: number;
  /** Валовый доход от майнинга, $/МВт·ч (до вычета электричества). */
  miningRevenue: number;
  /** Лучший по значению вариант. */
  best: Decision;
  /** Итоговое решение (может отличаться от best, если «keep as is»). */
  chosen: Decision;
  keepAsIs: boolean;
  /** Отрыв лучшего варианта от следующего, $/МВт·ч. */
  marginToNext: number;
  /** Решение отличается от текущего. */
  changed: boolean;
  thresholdUsdPerMwh: number;
  /** Значение выбранного варианта, $/МВт·ч. */
  chosenUsdPerMwh: number;
  /** Выигрыш выбранного против «майнить» = (chosen − mine) × МВт, $/ч. */
  gainVsMiningPerHour: number;
  /** Прибыль выбранного варианта, $/ч. */
  profitPerHour: number;
}

export type DecisionResult = DecisionOutcome | { ok: false; errors: string[] };

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export function validateInput(input: DecisionInput): string[] {
  const errors: string[] = [];
  if (!isNum(input.mw) || input.mw <= 0) errors.push("Power draw must be greater than 0");
  if (!isNum(input.phs) || input.phs <= 0) errors.push("Mining power must be greater than 0");
  if (!isNum(input.hashpriceUsdPerPhDay) || input.hashpriceUsdPerPhDay < 0)
    errors.push("Mining income must be a number ≥ 0");
  if (!isNum(input.powerPriceUsdPerMwh)) errors.push("Power price must be a number");
  if (input.thresholdUsdPerMwh !== undefined && (!isNum(input.thresholdUsdPerMwh) || input.thresholdUsdPerMwh < 0))
    errors.push("Threshold must be a number ≥ 0");
  if (input.curtailmentUsdPerMwh !== undefined && !isNum(input.curtailmentUsdPerMwh))
    errors.push("Curtailment payment must be a number");
  if (input.lease) {
    if (!isNum(input.lease.rateUsdPerMwh) || input.lease.rateUsdPerMwh < 0)
      errors.push("Lease rate must be a number ≥ 0");
    if (!isNum(input.lease.overheadUsdPerMwh) || input.lease.overheadUsdPerMwh < 0)
      errors.push("Overhead must be a number ≥ 0");
  }
  return errors;
}

/** Валовый доход от майнинга, $/МВт·ч: hashprice × (PH/s на МВт) / 24. */
export function miningRevenuePerMwh(hashprice: number, phs: number, mw: number): number {
  return (hashprice * (phs / mw)) / 24;
}

export function decide(input: DecisionInput): DecisionResult {
  const errors = validateInput(input);
  if (errors.length > 0) return { ok: false, errors };

  const threshold = input.thresholdUsdPerMwh ?? DEFAULT_THRESHOLD_USD_PER_MWH;
  const phsPerMw = input.phs / input.mw;
  const miningRevenue = miningRevenuePerMwh(input.hashpriceUsdPerPhDay, input.phs, input.mw);
  const power = input.powerPriceUsdPerMwh;

  const mine = miningRevenue - power;
  const lease = input.lease
    ? input.lease.rateUsdPerMwh - (input.lease.includesPower ? 0 : power) - input.lease.overheadUsdPerMwh
    : null;
  const off = input.curtailmentUsdPerMwh ?? 0;
  const options = { mine, lease, off };

  const available = TIE_ORDER.filter((d) => options[d] !== null);
  const valueOf = (d: Decision) => options[d] as number;
  const current = input.current && available.includes(input.current) ? input.current : null;

  // Лучший вариант: максимум; при равенстве — текущее решение, затем порядок TIE_ORDER.
  const best = available.reduce((a, b) => {
    const diff = valueOf(b) - valueOf(a);
    if (diff > EPS) return b;
    if (diff < -EPS) return a;
    return b === current ? b : a;
  });
  const others = available.filter((d) => d !== best).map(valueOf);
  const marginToNext = valueOf(best) - Math.max(...others);

  let chosen = best;
  let keepAsIs = false;
  if (current && current !== best && valueOf(best) - valueOf(current) < threshold - EPS) {
    chosen = current;
    keepAsIs = true;
  } else if (marginToNext < threshold - EPS) {
    keepAsIs = true;
  }

  const chosenUsdPerMwh = valueOf(chosen);
  return {
    ok: true,
    options,
    phsPerMw,
    miningRevenue,
    best,
    chosen,
    keepAsIs,
    marginToNext,
    changed: current !== null && chosen !== current,
    thresholdUsdPerMwh: threshold,
    chosenUsdPerMwh,
    gainVsMiningPerHour: (chosenUsdPerMwh - mine) * input.mw,
    profitPerHour: chosenUsdPerMwh * input.mw,
  };
}

export const DECISION_LABEL: Record<Decision, string> = {
  mine: "Mine",
  lease: "Lease to AI",
  off: "Switch off",
};
