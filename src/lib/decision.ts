// Decision logic "Mine / Lease to AI / Switch off" per MWh (docs/PLAN.md §2).
// Pure functions: no UI, network or clock.

export type Decision = "mine" | "lease" | "off";

export const DEFAULT_THRESHOLD_USD_PER_MWH = 5;

/** Preference order when values are equal (if there is no current decision). */
const TIE_ORDER: Decision[] = ["mine", "lease", "off"];
const EPS = 1e-9;

export interface LeaseTerms {
  /** Contract rate, $/MWh. */
  rateUsdPerMwh: number;
  /** "All-in rate": electricity is already included, do not subtract it. */
  includesPower: boolean;
  /** Overhead, $/MWh. */
  overheadUsdPerMwh: number;
}

export interface DecisionInput {
  /** $ per PH/s per day. */
  hashpriceUsdPerPhDay: number;
  /** Electricity price, $/MWh (can be negative). */
  powerPriceUsdPerMwh: number;
  /** Site power draw, MW. */
  mw: number;
  /** Fleet hashrate, PH/s. */
  phs: number;
  /** AI lease terms; if absent, the "Lease" option is unavailable. */
  lease?: LeaseTerms | null;
  /** Payment for load reduction when switched off, $/MWh. */
  curtailmentUsdPerMwh?: number;
  /** "Keep as is" threshold, $/MWh. */
  thresholdUsdPerMwh?: number;
  /** The decision currently in effect at the site. */
  current?: Decision | null;
}

export interface DecisionOutcome {
  ok: true;
  /** Option values, $/MWh. lease = null if no rate is set. */
  options: { mine: number; lease: number | null; off: number };
  phsPerMw: number;
  /** Gross mining revenue, $/MWh (before subtracting electricity). */
  miningRevenue: number;
  /** Best option by value. */
  best: Decision;
  /** Final decision (may differ from best if "keep as is"). */
  chosen: Decision;
  keepAsIs: boolean;
  /** Gap between the best option and the next one, $/MWh. */
  marginToNext: number;
  /** The decision differs from the current one. */
  changed: boolean;
  thresholdUsdPerMwh: number;
  /** Value of the chosen option, $/MWh. */
  chosenUsdPerMwh: number;
  /** Gain of the chosen option vs "mine" = (chosen − mine) × MW, $/h. */
  gainVsMiningPerHour: number;
  /** Profit of the chosen option, $/h. */
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

/** Gross mining revenue, $/MWh: hashprice × (PH/s per MW) / 24. */
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

  // Best option: the maximum; on a tie, the current decision, then TIE_ORDER.
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
