import { describe, expect, it } from "vitest";
import { decide } from "./decision";
import { gainText } from "./gain";

function out(p: Parameters<typeof decide>[0]) {
  const r = decide(p);
  if (!r.ok) throw new Error("invalid");
  return r;
}

describe("выигрыш: крупно $/ч, мелко $/МВт·ч", () => {
  it("Houston → Lease: +$136 /h more than mining", () => {
    const g = gainText(out({ hashpriceUsdPerPhDay: 38.5, powerPriceUsdPerMwh: 32.4, mw: 20, phs: 1000, lease: { rateUsdPerMwh: 95, includesPower: false, overheadUsdPerMwh: 8 }, thresholdUsdPerMwh: 5 }));
    expect(g.big).toBe("+$136 /h more than mining");
    expect(g.small).toBe("+$6.79 /MWh vs. mining");
  });

  it("North Ridge → Off: Saves $119 /h", () => {
    const g = gainText(out({ hashpriceUsdPerPhDay: 38.5, powerPriceUsdPerMwh: 74.1, mw: 12, phs: 480, lease: { rateUsdPerMwh: 70, includesPower: false, overheadUsdPerMwh: 8 }, thresholdUsdPerMwh: 5 }));
    expect(g.big).toBe("Saves $119 /h vs. mining");
  });

  it("копеечная площадка (< $1/ч): крупно $/день", () => {
    const g = gainText(out({ hashpriceUsdPerPhDay: 38.5, powerPriceUsdPerMwh: 40, mw: 0.015, phs: 0.3945, thresholdUsdPerMwh: 5 }));
    expect(g.big).toMatch(/^Earning \+\$0\.\d\d \/day$/);
    expect(g.small).toBe("+$2.19 /MWh");
  });

  it("майнинг от $1/ч показывается в $/ч", () => {
    const g = gainText(out({ hashpriceUsdPerPhDay: 38.5, powerPriceUsdPerMwh: 32.4, mw: 20, phs: 1000, thresholdUsdPerMwh: 5 }));
    expect(g.big).toMatch(/^Earning \+\$\d+\.\d\d \/h$/);
  });
});
