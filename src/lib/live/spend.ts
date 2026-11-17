import type { SpendLogEntry, SpendState } from "../types";
import { dailyLimitUsd, isPaidRow, proofUrlOf, readLedger, spentTodayUsd } from "./telegraph";

const SERVICE_LABEL: Record<string, string> = { CRYPTO_PRICE_USD: "CRYPTO_PRICE_USD" };

export function liveSpendState(): Omit<SpendState, "stopAtLimit" | "alertAtPct" | "limitUsd"> & { limitUsd: number } {
  const rows = readLedger();
  const day = new Date().toISOString().slice(0, 10);
  const today = rows.filter((r) => r.at.startsWith(day));
  const spent = Math.round(spentTodayUsd() * 100) / 100;
  const limit = dailyLimitUsd();

  const by = new Map<string, { requests: number; costUsd: number }>();
  for (const r of today) {
    const s = r.intent ?? "FREE_TEXT_QUERY";
    const v = by.get(s) ?? { requests: 0, costUsd: 0 };
    v.requests += 1;
    v.costUsd += r.cost_usd;
    by.set(s, v);
  }
  const log: SpendLogEntry[] = rows
    .slice(-50)
    .reverse()
    .map((r) => ({
      at: r.at,
      service: r.intent ?? "FREE_TEXT_QUERY",
      siteName: r.purpose ?? "—",
      provider: r.miner_name ?? undefined,
      costUsd: r.cost_usd,
      status: isPaidRow(r) ? ("paid" as const) : ("failed" as const),
      hash: paidHash(r),
      proofUrl: isPaidRow(r) ? (proofUrlOf(r) ?? undefined) : undefined,
    }));

  return {
    limitUsd: limit,
    spentUsd: spent,
    limitReached: spent + 0.01 > limit + 1e-9,
    forecastPerDayUsd: 0.25,
    forecastNote:
      "Hourly agent: 1 Telegraph request (BTC price) per hour for all places plus 1 web search a day (lease-rate guide), $0.01 each (testnet USDC). An open app reuses the same purchase for 30 minutes; Refresh now buys one more.",
    byService: [...by.entries()].map(([service, v]) => ({ service: SERVICE_LABEL[service] ?? service, requests: v.requests, costUsd: Math.round(v.costUsd * 100) / 100 })),
    log,
  };
}

/** Short hash of a paid row: the Sepolia tx (x402) or the Telegraph receipt (escrow). */
function paidHash(r: ReturnType<typeof readLedger>[number]): string | undefined {
  if (!isPaidRow(r)) return undefined;
  const h = r.tx ?? r.receipt_hash ?? r.signal_hash;
  return h ? `${h.slice(0, 6)}…${h.slice(-4)}` : undefined;
}
