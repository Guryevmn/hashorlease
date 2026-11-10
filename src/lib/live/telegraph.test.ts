import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Журнал и замок оплаты лежат в process.cwd()/data — подменяем папку до загрузки модуля, чтобы не тронуть настоящий data/.
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

describe("дневной лимит Telegraph", () => {
  it("DAILY_SPEND_LIMIT_USD=0 на чистой установке: ask() отказывает до оплаты, сети и кошелька", async () => {
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

describe("частота запросов к Telegraph", () => {
  const question = { query: "What is the current price of Bitcoin (BTC) in USD?" };
  // Строки журнала без оплаты (504 от devnode): дневной лимит не мешает, считается только частота.
  function seedLedger(dir: string, agesMs: number[]) {
    mkdirSync(join(dir, "data"), { recursive: true });
    const rows = agesMs.map((age) => JSON.stringify({ at: new Date(Date.now() - age).toISOString(), intent: null, params: question, status: 504, cost_usd: 0, tx: null, signal_hash: null, body: null }));
    writeFileSync(join(dir, "data", "ledger.jsonl"), rows.join("\n") + "\n");
  }

  it("30 запросов за последнюю минуту: ask() отказывает до оплаты и сети", async () => {
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

  it("запросы старше минуты не считаются: 29 свежих + 40 старых — ограничитель пропускает", async () => {
    vi.stubEnv("DAILY_SPEND_LIMIT_USD", "10");
    vi.stubEnv("TELEGRAPH_WALLET_KEY", "");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network must not be used"))));
    const { dir, mod } = await loadInEmptyDir();
    seedLedger(dir, [...Array.from({ length: 29 }, (_, i) => i * 1000), ...Array.from({ length: 40 }, (_, i) => 61_000 + i * 1000)]);

    expect(mod.asksLastMinute()).toBe(29);
    // Дальше ограничителя: без кошелька запрос падает на клиенте, а не на частоте.
    await expect(mod.ask(question, "All sites")).rejects.toThrow("TELEGRAPH_WALLET_KEY is not set");
    expect(existsSync(join(dir, "data", ".payment.lock"))).toBe(false);
  });
});
