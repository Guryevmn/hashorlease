import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractQuotedRate, formatQuotedRate, guideDue, guideFromLedger, LEASE_GUIDE_EVERY_MS, LEASE_GUIDE_INTENT, LEASE_GUIDE_RETRY_MS } from "./leaseGuide";
import type { LedgerRow } from "./telegraph";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

// A paid web-search row as the devnode returned it on 17.11: sources only, no answer, no stated rate.
function sourcesOnlyRow(at: string): LedgerRow {
  return {
    at,
    intent: LEASE_GUIDE_INTENT,
    params: { query: "q" },
    status: 200,
    cost_usd: 0.01,
    tx: null,
    signal_hash: "0xe10a235318d1da2583fabc762aa95cee46fc10cc08572d6676ec85a6884cf0ad",
    miner_name: "ChainSight",
    purpose: "All sites",
    rail: "escrow",
    receipt_hash: "0x3dfb11ea21d09f4cf8dd9d523a74046c1bc40728507ff8ded289c1a852e9abb5",
    body: {
      result: { answer: null, sources: ["https://a", "https://b", "https://c"], brief: null },
      findings: { items: [{ name: "answer", type: "string", value: "[1] Colocation market to reach $204.4 Billion by 2030, CAGR 14.4%" }] },
      timestamp: at,
    },
  };
}
const failedRow = (at: string): LedgerRow => ({ at, intent: LEASE_GUIDE_INTENT, params: {}, status: 400, cost_usd: 0, tx: null, signal_hash: null, body: { error: "invalid_params" } });

describe("extractQuotedRate", () => {
  it("takes only rates the text quotes, with their own unit", () => {
    expect(extractQuotedRate("Wholesale rates run $120 per kW per month in Virginia and $150/kW-month in Dallas.")).toEqual({ unit: "kW·month", low: 120, high: 150, mentions: 2 });
    expect(extractQuotedRate("Spot power was $95 per MWh.")).toEqual({ unit: "MWh", low: 95, high: 95, mentions: 1 });
    expect(extractQuotedRate("Leases of $70–100/MWh.")).toEqual({ unit: "MWh", low: 70, high: 100, mentions: 1 });
  });

  it("market-size figures, per-year/per-hour or period-less $/kW and implausible values are not rates", () => {
    expect(extractQuotedRate("Market to reach $204.4 Billion by 2030 at a CAGR of 14.4%")).toBeNull();
    expect(extractQuotedRate("Prices of $1,200 per kW per year")).toBeNull();
    expect(extractQuotedRate("$150 per kW")).toBeNull();
    expect(extractQuotedRate("$5000 per kW per month")).toBeNull();
    expect(extractQuotedRate("")).toBeNull();
  });

  it("does not mix units: the unit with more mentions wins", () => {
    const r = extractQuotedRate("$100/kW/month, $110/kW/month and $80/MWh");
    expect(r).toEqual({ unit: "kW·month", low: 100, high: 110, mentions: 2 });
    expect(formatQuotedRate(r!)).toBe("$100–$110 /kW·month");
  });
});

describe("guideFromLedger — honest on-screen guide", () => {
  it("no purchase yet: unavailable, no value, no receipt hash", () => {
    const g = guideFromLedger([], NOW);
    expect(g.value).toBe("Not available");
    expect(g.receipt.status).toBe("unavailable");
    expect(g.receipt.hash).toBeUndefined();
    expect(g.receipt.costUsd).toBe(0);
  });

  it("a failed attempt only: still unavailable, the reason names the status", () => {
    const g = guideFromLedger([failedRow(ago(1000))], NOW);
    expect(g.receipt.status).toBe("unavailable");
    expect(g.receipt.source).toContain("400");
  });

  it("paid answer with sources but no rate: says so, keeps the real receipt, shows no number", () => {
    const g = guideFromLedger([sourcesOnlyRow(ago(3600_000))], NOW);
    expect(g.value).toBe("No rate quoted in the search results");
    expect(g.value).not.toMatch(/\d/);
    expect(g.receipt.status).toBe("verified");
    expect(g.receipt.hash).toBe("0x3dfb…abb5");
    expect(g.receipt.costUsd).toBe(0.01);
    expect(g.receipt.proofUrl).toContain("/signal/0xe10a");
    expect(g.receipt.source).toContain("3 sources");
  });

  it("paid answer that quotes a rate: shows it as quoted, labelled an estimate", () => {
    const row = sourcesOnlyRow(ago(3600_000));
    (row.body as { findings: { items: { value: string }[] } }).findings.items[0].value = "AI hosting in Texas goes for $130-170 per kW per month.";
    const g = guideFromLedger([row], NOW);
    expect(g.value).toBe("$130–$170 /kW·month (quoted in 1 search result)");
    expect(g.receipt.status).toBe("verified");
    expect(g.receipt.source).toContain("not a quote");
  });

  it("a guide older than a day and a bit is marked stale, not fresh", () => {
    const g = guideFromLedger([sourcesOnlyRow(ago(30 * 3600_000))], NOW);
    expect(g.receipt.status).toBe("stale");
    expect(g.receipt.source).toContain("older than a day");
  });
});

describe("guideDue — once a day", () => {
  it("nothing bought: due", () => expect(guideDue([], NOW)).toBe(true));
  it("bought an hour ago: not due", () => expect(guideDue([sourcesOnlyRow(ago(3600_000))], NOW)).toBe(false));
  it("bought just under 24 h ago: not due; just over: due", () => {
    expect(guideDue([sourcesOnlyRow(ago(LEASE_GUIDE_EVERY_MS - 60_000))], NOW)).toBe(false);
    expect(guideDue([sourcesOnlyRow(ago(LEASE_GUIDE_EVERY_MS + 60_000))], NOW)).toBe(true);
  });
  it("a failed attempt is retried only after the pause, not every hourly cycle", () => {
    expect(guideDue([failedRow(ago(30 * 60_000))], NOW)).toBe(false);
    expect(guideDue([failedRow(ago(LEASE_GUIDE_RETRY_MS + 60_000))], NOW)).toBe(true);
  });
  it("other Telegraph purchases (the BTC price) do not count as the guide", () => {
    const btc: LedgerRow = { ...sourcesOnlyRow(ago(60_000)), intent: "CRYPTO_PRICE_USD" };
    expect(guideDue([btc], NOW)).toBe(true);
  });
});

// ---- the purchase itself: limit, rate and journal, with the real telegraph.ts and a fake network ----

async function loadInDir(rows: LedgerRow[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "hol-guide-"));
  mkdirSync(join(dir, "data"), { recursive: true });
  if (rows.length) writeFileSync(join(dir, "data", "ledger.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  vi.resetModules();
  return { dir, guide: await import("./leaseGuide"), tg: await import("./telegraph") };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("buyLeaseGuideIfDue", () => {
  it("not due: no network, no payment, no new journal line", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network must not be used")));
    vi.stubGlobal("fetch", fetchSpy);
    const { dir, guide } = await loadInDir([sourcesOnlyRow(new Date().toISOString())]);
    expect(await guide.buyLeaseGuideIfDue()).toBe("not-due");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(readFileSync(join(dir, "data", "ledger.jsonl"), "utf8").trim().split("\n")).toHaveLength(1);
  });

  it("the daily spend limit stops it: no network, nothing thrown to the caller, no journal line", async () => {
    vi.stubEnv("DAILY_SPEND_LIMIT_USD", "0");
    vi.stubEnv("TELEGRAPH_WALLET_KEY", "");
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network must not be used")));
    vi.stubGlobal("fetch", fetchSpy);
    const { dir, guide } = await loadInDir();
    const logs: string[] = [];
    expect(await guide.buyLeaseGuideIfDue({ log: (l) => logs.push(l) })).toBe("failed");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "data", "ledger.jsonl"))).toBe(false);
    expect(logs.join(" ")).toContain("daily limit");
  });

  it("a purchase made by another process while we waited for the lock is not repeated", async () => {
    vi.stubEnv("DAILY_SPEND_LIMIT_USD", "10");
    vi.stubEnv("TELEGRAPH_WALLET_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network must not be used")));
    vi.stubGlobal("fetch", fetchSpy);
    const { dir, tg } = await loadInDir();
    // The pre-check says "due", then someone else writes the purchase before our lock check runs.
    const row = sourcesOnlyRow(new Date().toISOString());
    const skipIf = () => {
      writeFileSync(join(dir, "data", "ledger.jsonl"), JSON.stringify(row) + "\n");
      return true;
    };
    await expect(tg.ask({ intent: LEASE_GUIDE_INTENT, params: { query: "q" } }, "All sites", { skipIf })).rejects.toBeInstanceOf(tg.AlreadyBoughtError);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "data", ".payment.lock"))).toBe(false);
  });
});
