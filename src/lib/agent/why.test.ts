import { describe, expect, it } from "vitest";
import { decide, type DecisionOutcome } from "../decision";
import { whyText } from "./why";

function outcome(power: number, hashprice: number, current: "mine" | "lease" | "off" | null, lease = true): DecisionOutcome {
  const r = decide({
    hashpriceUsdPerPhDay: hashprice,
    powerPriceUsdPerMwh: power,
    mw: 20,
    phs: 1000,
    lease: lease ? { rateUsdPerMwh: 60, includesPower: true, overheadUsdPerMwh: 10 } : null,
    current,
  });
  if (!r.ok) throw new Error("invalid");
  return r;
}

describe("whyText", () => {
  it("names the power price when it is what moved", () => {
    const before = outcome(20, 36, null); // mine 55 vs lease 50
    const now = outcome(80, 36, "mine");
    expect(now.chosen).toBe("lease");
    expect(whyText(now, 80, { decision: "mine", options: before.options, powerPrice: 20 })).toBe(
      "power price rose from $20.00 to $80.00/MWh; Lease to AI now beats Mine by $55.00/MWh",
    );
  });

  it("names mining income when the power price stood still", () => {
    const before = outcome(40, 24, null, false); // mine 10
    const now = outcome(40, 12, "mine", false); // mine −15 → off
    expect(now.chosen).toBe("off");
    expect(whyText(now, 40, { decision: "mine", options: before.options, powerPrice: 40 })).toBe(
      "mining income fell from $50.00 to $25.00/MWh; Switch off now beats Mine by $15.00/MWh",
    );
  });

  it("explains a first call and a kept call without a previous record", () => {
    expect(whyText(outcome(80, 36, null), 80, null)).toBe("Lease to AI leads Switch off by $50.00/MWh");
    const kept = outcome(22, 36, "lease"); // mine 53 vs lease 50: under the threshold
    expect(kept.chosen).toBe("lease");
    expect(whyText(kept, 22, { decision: "lease", options: kept.options, powerPrice: 22 })).toBe(
      "Mine is ahead by only $3.00/MWh, below the $5.00 threshold: keep Lease to AI",
    );
  });

  it("falls back when nothing measurable moved (the site was edited)", () => {
    const now = outcome(80, 36, "mine");
    expect(whyText(now, 80, { decision: "mine", options: now.options, powerPrice: 80 })).toBe(
      "the site's numbers changed; Lease to AI now beats Mine by $55.00/MWh",
    );
  });
});
