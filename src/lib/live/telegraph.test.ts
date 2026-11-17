import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The journal and payment lock live in process.cwd()/data: swap the folder before loading the module so the real data/ isn't touched.
async function loadInEmptyDir() {
  const dir = mkdtempSync(join(tmpdir(), "hol-telegraph-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  vi.resetModules();
  return { dir, mod: await import("./telegraph") };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Telegraph daily limit", () => {
  it("DAILY_SPEND_LIMIT_USD=0 on a clean install: ask() refuses before payment, network and wallet", async () => {
    vi.stubEnv("DAILY_SPEND_LIMIT_USD", "0");
    vi.stubEnv("TELEGRAPH_WALLET_KEY", "");
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network must not be used")));
    vi.stubGlobal("fetch", fetchSpy);
    const { dir, mod } = await loadInEmptyDir();

    expect(mod.dailyLimitUsd()).toBe(0);
    await expect(mod.ask({ query: "What is the current price of Bitcoin (BTC) in USD?" }, "All sites")).rejects.toBeInstanceOf(mod.SpendLimitError);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "data", "ledger.jsonl"))).toBe(false);
    expect(existsSync(join(dir, "data", ".payment.lock"))).toBe(false);
  });
});

describe("Telegraph request rate", () => {
  const question = { query: "What is the current price of Bitcoin (BTC) in USD?" };
  // Unpaid journal lines (504 from the devnode): the daily limit doesn't interfere, only the rate counts.
  function seedLedger(dir: string, agesMs: number[]) {
    mkdirSync(join(dir, "data"), { recursive: true });
    const rows = agesMs.map((age) => JSON.stringify({ at: new Date(Date.now() - age).toISOString(), intent: null, params: question, status: 504, cost_usd: 0, tx: null, signal_hash: null, body: null }));
    writeFileSync(join(dir, "data", "ledger.jsonl"), rows.join("\n") + "\n");
  }

  it("30 requests in the last minute: ask() refuses before payment and network", async () => {
    vi.stubEnv("DAILY_SPEND_LIMIT_USD", "10");
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network must not be used")));
    vi.stubGlobal("fetch", fetchSpy);
    const { dir, mod } = await loadInEmptyDir();
    seedLedger(dir, Array.from({ length: 30 }, (_, i) => i * 1000));

    expect(mod.asksLastMinute()).toBe(30);
    await expect(mod.ask(question, "All sites")).rejects.toBeInstanceOf(mod.RateLimitError);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "data", ".payment.lock"))).toBe(false);
  });

  it("requests older than a minute don't count: 29 fresh + 40 old, the limiter lets it through", async () => {
    vi.stubEnv("DAILY_SPEND_LIMIT_USD", "10");
    vi.stubEnv("TELEGRAPH_WALLET_KEY", "");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network must not be used"))));
    const { dir, mod } = await loadInEmptyDir();
    seedLedger(dir, [...Array.from({ length: 29 }, (_, i) => i * 1000), ...Array.from({ length: 40 }, (_, i) => 61_000 + i * 1000)]);

    expect(mod.asksLastMinute()).toBe(29);
    // Past the limiter: without a wallet the request fails on the client, not on the rate.
    await expect(mod.ask(question, "All sites")).rejects.toThrow("TELEGRAPH_WALLET_KEY is not set");
    expect(existsSync(join(dir, "data", ".payment.lock"))).toBe(false);
  });
});

describe("Telegraph payment rails (settlement outage of 17.11.2026)", () => {
  const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const question = { query: "What is the current price of Bitcoin (BTC) in USD?" };
  const challengeBody = {
    error: "payment required",
    accepts: [
      {
        scheme: "escrow",
        network: "eip155:11155111",
        payTo: "0x72a70e949362670bf8bcead24efc5b8f950aa08b",
        price: "$0.01",
        extra: {
          message:
            "Telegraph Escrow Payment\n\nWallet: {from}\nPay To: 0x72a70e949362670bf8bcead24efc5b8f950aa08b\nNetwork: eip155:11155111\nAmount: 10000 uUSDC\nResource: /v1/ask\nNonce: {nonce}\nValid After: {validAfter}\nValid Before: {validBefore}",
        },
      },
    ],
  };
  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  const readRows = (dir: string) =>
    readFileSync(join(dir, "data", "ledger.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));

  it("funded escrow: pays without the facilitator, the journal row is paid, the proof is the signal on the node", async () => {
    vi.stubEnv("DAILY_SPEND_LIMIT_USD", "10");
    vi.stubEnv("TELEGRAPH_WALLET_KEY", TEST_KEY);
    const receipt = Buffer.from(JSON.stringify({ receipt_hash: "0xfeed", rail: "escrow", epoch_id: 12 })).toString("base64");
    const calls: Array<Record<string, string>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const h = Object.fromEntries(new Headers(init?.headers).entries());
        calls.push(h);
        if (!h["x-payment"]) return json(402, challengeBody);
        return json(200, { result: { price_usd: 91000 }, signal_hash: "0xsig", miner_name: "Cp Coinbase", cost_usd: 0.01 }, { "x-payment-response": receipt });
      }),
    );
    const { dir, mod } = await loadInEmptyDir();
    const r = await mod.ask(question, "All sites");
    expect(r).toMatchObject({ status: 200, paid: true, rail: "escrow", tx: null, receiptHash: "0xfeed" });
    expect(r.proofUrl).toBe("https://devnode.telegraphprotocol.com/engine/v1/signal/0xsig");
    expect(calls).toHaveLength(2); // challenge + paid request, no facilitator round trip
    const env = JSON.parse(Buffer.from(calls[1]["x-payment"], "base64").toString("utf8"));
    expect(env.scheme).toBe("escrow");
    const [row] = readRows(dir);
    expect(row).toMatchObject({ status: 200, rail: "escrow", cost_usd: 0.01, receipt_hash: "0xfeed", epoch_id: 12 });
    expect(mod.isPaidRow(row)).toBe(true);
    expect(mod.spentTodayUsd()).toBeCloseTo(0.01);
  });

  it("unfunded escrow in auto mode: falls back to x402 and notes why", async () => {
    vi.stubEnv("DAILY_SPEND_LIMIT_USD", "10");
    vi.stubEnv("TELEGRAPH_WALLET_KEY", TEST_KEY);
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        n += 1;
        const h = Object.fromEntries(new Headers(init?.headers).entries());
        if (n === 1) return json(402, challengeBody);
        if (h["x-payment"]) return json(402, { error: "payment required", reason: "insufficient escrow for delivery: unbilled=0 μUSDC + price=10000 μUSDC > balance=0 μUSDC" });
        return json(503, { error: "x402 attempt reached" }); // the x402 request itself
      }),
    );
    const { dir, mod } = await loadInEmptyDir();
    const r = await mod.ask(question, "All sites");
    expect(r).toMatchObject({ status: 503, rail: "x402", paid: false });
    const rows = readRows(dir);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rail: "x402", cost_usd: 0 });
    expect(rows[0].escrow_refusal).toContain("insufficient escrow");
  });

  it("TELEGRAPH_PAY_RAIL=escrow: an unfunded balance is a plain unpaid 402, no x402 attempt, nothing spent", async () => {
    vi.stubEnv("DAILY_SPEND_LIMIT_USD", "10");
    vi.stubEnv("TELEGRAPH_WALLET_KEY", TEST_KEY);
    vi.stubEnv("TELEGRAPH_PAY_RAIL", "escrow");
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      const h = Object.fromEntries(new Headers(init?.headers).entries());
      if (!h["x-payment"]) return json(402, challengeBody);
      return json(402, { error: "payment required", reason: "insufficient escrow for delivery: unbilled=0 μUSDC + price=10000 μUSDC > balance=0 μUSDC" });
    });
    vi.stubGlobal("fetch", f);
    const { dir, mod } = await loadInEmptyDir();
    const r = await mod.ask(question, "All sites");
    expect(r).toMatchObject({ status: 402, rail: "escrow", paid: false, proofUrl: null });
    expect(f).toHaveBeenCalledTimes(2);
    expect(readRows(dir)[0]).toMatchObject({ rail: "escrow", cost_usd: 0 });
    expect(mod.spentTodayUsd()).toBe(0);
  });
});
