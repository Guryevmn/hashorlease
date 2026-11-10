// Как показывать выигрыш по площадке: крупно $/ч, рядом мелко $/МВт·ч.
// Если сумма меньше $1 в час (копеечные площадки), крупно показываем $/день, иначе смысл теряется.

import type { Decision, DecisionOutcome } from "./decision";
import { signedUsd, usd } from "./format";

export const SMALL_GAIN_PER_HOUR_USD = 1;

export interface GainText {
  /** Крупная строка, например «Earning +$47.81 /h» или «Earning +$0.63 /day». */
  big: string;
  /** Мелкая строка рядом, $/МВт·ч, например «+$2.19 /MWh». */
  small: string;
}

/** Выигрыш в час: для «майнить» — прибыль, для остальных — против «майнить». */
export function gainPerHour(r: DecisionOutcome): number {
  return r.chosen === "mine" ? r.profitPerHour : r.gainVsMiningPerHour;
}

export function gainPerMwh(r: DecisionOutcome): number {
  return r.chosen === "mine" ? r.options.mine : r.chosenUsdPerMwh - r.options.mine;
}

export function gainText(r: DecisionOutcome): GainText {
  const hourly = gainPerHour(r);
  const perDay = Math.abs(hourly) < SMALL_GAIN_PER_HOUR_USD;
  const unit = perDay ? "/day" : "/h";
  const amount = perDay ? hourly * 24 : hourly;
  const digits = perDay || r.chosen === "mine" ? 2 : 0;
  const small = `${signedUsd(gainPerMwh(r))} /MWh${r.chosen === "mine" ? "" : " vs. mining"}`;

  const chosen: Decision = r.chosen;
  if (chosen === "mine") return { big: `Earning ${signedUsd(amount, digits)} ${unit}`, small };
  if (chosen === "off") {
    return hourly > 0.005
      ? { big: `Saves ${usd(amount, digits)} ${unit} vs. mining`, small }
      : { big: "Nothing to save", small: "" };
  }
  return { big: `${signedUsd(amount, digits)} ${unit} more than mining`, small };
}
