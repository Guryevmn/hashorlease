import { describe, expect, it } from "vitest";
import { hashpriceUsdPerPhDay } from "./market";

describe("hashpriceUsdPerPhDay", () => {
  it("считает $ за PH/s в день: 144 блока × награда × курс / хешрейт", () => {
    // 144 × 3.152 BTC × $74 358 / 969 000 PH/s ≈ $34.8
    expect(hashpriceUsdPerPhDay({ btcUsd: 74358, hashratePhs: 969_000, avgRewardBtc: 3.152 })).toBeCloseTo(34.83, 1);
  });

  it("растёт вместе с курсом и падает с хешрейтом", () => {
    const base = { btcUsd: 70000, hashratePhs: 900_000, avgRewardBtc: 3.2 };
    expect(hashpriceUsdPerPhDay({ ...base, btcUsd: 80000 })).toBeGreaterThan(hashpriceUsdPerPhDay(base));
    expect(hashpriceUsdPerPhDay({ ...base, hashratePhs: 1_000_000 })).toBeLessThan(hashpriceUsdPerPhDay(base));
  });
});
