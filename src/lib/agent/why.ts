// One-line reason for an hourly call: what moved since the previous call and by how much.
// Pure function: the journal, the bot and the demo day all show the same text.

import { DECISION_LABEL, type Decision, type DecisionOutcome } from "../decision";
import { usd } from "../format";
import type { DecisionRecord } from "./types";

type Previous = Pick<DecisionRecord, "decision" | "options" | "powerPrice">;

function runnerUp(o: DecisionOutcome, than: Decision): Decision | null {
  const rest = (["mine", "lease", "off"] as Decision[]).filter((d) => d !== than && o.options[d] !== null);
  if (rest.length === 0) return null;
  return rest.reduce((a, b) => ((o.options[b] as number) > (o.options[a] as number) ? b : a));
}

/** What moved between the two hours: the power price or the mining income (whichever moved more, $/MWh). */
function driver(o: DecisionOutcome, power: number | null, prev: Previous): string | null {
  if (power === null || prev.powerPrice === null || !prev.options) return null;
  const dPower = power - prev.powerPrice;
  const prevRevenue = prev.options.mine + prev.powerPrice;
  const dRevenue = o.miningRevenue - prevRevenue;
  if (Math.abs(dPower) < 0.005 && Math.abs(dRevenue) < 0.005) return null;
  if (Math.abs(dPower) >= Math.abs(dRevenue)) {
    return `power price ${dPower > 0 ? "rose" : "fell"} from ${usd(prev.powerPrice)} to ${usd(power)}/MWh`;
  }
  return `mining income ${dRevenue > 0 ? "rose" : "fell"} from ${usd(prevRevenue)} to ${usd(o.miningRevenue)}/MWh`;
}

export function whyText(o: DecisionOutcome, power: number | null, prev: Previous | null): string {
  const chosen = DECISION_LABEL[o.chosen];
  const value = (d: Decision) => o.options[d] as number;

  if (prev?.decision && prev.decision !== o.chosen) {
    const was = prev.decision;
    const moved = driver(o, power, prev) ?? "the site's numbers changed";
    const lead = o.options[was] === null ? "" : `; ${chosen} now beats ${DECISION_LABEL[was]} by ${usd(value(o.chosen) - value(was))}/MWh`;
    return `${moved}${lead}`;
  }
  if (o.keepAsIs && o.best !== o.chosen) {
    return `${DECISION_LABEL[o.best]} is ahead by only ${usd(value(o.best) - value(o.chosen))}/MWh, below the ${usd(o.thresholdUsdPerMwh)} threshold: keep ${chosen}`;
  }
  const second = runnerUp(o, o.chosen);
  if (!second) return `${chosen} is the only option`;
  return `${chosen} leads ${DECISION_LABEL[second]} by ${o.keepAsIs ? "only " : ""}${usd(value(o.chosen) - value(second))}/MWh`;
}
