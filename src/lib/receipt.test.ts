import { describe, expect, it } from "vitest";
import { receiptSummary, receiptTitle } from "./receipt";
import type { Receipt } from "./types";

const base: Receipt = { status: "verified", network: "testnet", service: "CRYPTO_PRICE_USD", costUsd: 0.01 };

describe("receipt sheet copy", () => {
  it("lifts the bought BTC price out of the source line; the rest is a quiet note", () => {
    const s = receiptSummary({ ...base, source: "BTC $64,547 via Telegraph; hashrate 983 EH/s and rewards from mempool.space" });
    expect(s).toEqual({ label: "BTC price", value: "$64,547", note: "Hashrate 983 EH/s and rewards from mempool.space" });
  });
  it("shows no number when Telegraph was unavailable (the price came from a free source)", () => {
    const s = receiptSummary({ ...base, status: "unavailable", source: "Telegraph unavailable (timeout) — BTC price from mempool.space" });
    expect(s.value).toBeNull();
    expect(s.note).toContain("Telegraph unavailable");
  });
  it("other services keep their source as the note and get a readable label", () => {
    expect(receiptSummary({ ...base, service: "WEB_SEARCH_GENERAL", source: "Web search returned 8 sources" })).toEqual({
      label: "Lease-rate web search",
      value: null,
      note: "Web search returned 8 sources",
    });
    expect(receiptSummary({ status: "public", network: "testnet", service: "Day-ahead price" }).label).toBe("Power price");
  });
  it("keeps the full status sentence for screen readers", () => {
    expect(receiptTitle("verified")).toBe("Verified by a Telegraph receipt");
    expect(receiptTitle("input")).toBe("Your input");
  });
});
