import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync } from "node:fs";
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
