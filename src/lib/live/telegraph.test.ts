import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
