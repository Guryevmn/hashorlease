// Lease-rate guide: one Telegraph WEB_SEARCH_GENERAL purchase per day (~$0.01), shown on the site page as "Market guide".
// It is a hint only — no decision reads it. The journal (data/ledger.jsonl) is the single source of truth: the purchase,
// its receipt and its answer live there, so the schedule and the on-screen guide are derived from it (no second state file).
// The devnode's web search returns market-report snippets and links, rarely a stated rate: when no rate is quoted
// we say so instead of inventing a number.

import type { Receipt, Sourced } from "../types";
import { ask, isPaidRow, proofUrlOf, readLedger, SpendLimitError, AlreadyBoughtError, type LedgerRow } from "./telegraph";

export const LEASE_GUIDE_INTENT = "WEB_SEARCH_GENERAL";
export const LEASE_GUIDE_QUERY = "wholesale data center colocation lease rate price per kW per month 2026 AI GPU hosting";
/** One purchase per day. */
export const LEASE_GUIDE_EVERY_MS = 24 * 3600_000;
/** After a failed attempt wait this long before trying again (a failed call is not billed on escrow, but don't hammer the node). */
export const LEASE_GUIDE_RETRY_MS = 2 * 3600_000;
/** A guide older than this is shown as "stale". */
const STALE_AFTER_MS = LEASE_GUIDE_EVERY_MS + 2 * 3600_000;

export interface QuotedRate {
  low: number;
  high: number;
  unit: "kW·month" | "MWh";
  mentions: number;
}

const UNIT_RANGE: Record<QuotedRate["unit"], [number, number]> = { "kW·month": [20, 1000], MWh: [5, 2000] };

const RATE_RE = /\$\s?(\d{1,4}(?:\.\d+)?)(?:\s?(?:-|–|—|to)\s?\$?\s?(\d{1,4}(?:\.\d+)?))?\s*(?:\/|per\s+)\s*(kw|kilowatt|mwh)\b(?:[\s/-]*(?:per\s+)?(month|mo|year|yr|hour|hr)\b)?/gi;

/** Rates the search results explicitly quote ($/kW-month or $/MWh). Nothing is converted, guessed or averaged across units. */
export function extractQuotedRate(text: string): QuotedRate | null {
  const found = new Map<QuotedRate["unit"], number[]>();
  for (const m of text.matchAll(RATE_RE)) {
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    const base = m[3].toLowerCase();
    const period = (m[4] ?? "").toLowerCase();
    let unit: QuotedRate["unit"] | null = null;
    if (base === "mwh" && !period) unit = "MWh";
    else if (base !== "mwh" && (period === "month" || period === "mo")) unit = "kW·month";
    if (!unit) continue; // $/kW with no period, per-year, per-hour: ambiguous, skipped
    const [lo, hi] = UNIT_RANGE[unit];
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    if (!(low >= lo && high <= hi)) continue;
    (found.get(unit) ?? found.set(unit, []).get(unit)!).push(low, high);
  }
  let best: QuotedRate | null = null;
  for (const [unit, nums] of found) {
    if (!best || nums.length / 2 > best.mentions) best = { unit, low: Math.min(...nums), high: Math.max(...nums), mentions: nums.length / 2 };
  }
  return best;
}

/** All text of a web-search answer: the answer field plus the extracts the node attaches to it. */
function answerText(body: Record<string, unknown> | null): string {
  const out: string[] = [];
  const result = body?.result as { answer?: unknown; brief?: unknown } | undefined;
  for (const v of [result?.answer, result?.brief]) if (typeof v === "string") out.push(v);
  const items = (body?.findings as { items?: { type?: string; value?: unknown }[] } | undefined)?.items;
  if (Array.isArray(items)) for (const i of items) if (i.type === "string" && typeof i.value === "string") out.push(i.value);
  return out.join("\n");
}

function sourceCount(body: Record<string, unknown> | null): number {
  const s = (body?.result as { sources?: unknown } | undefined)?.sources;
  return Array.isArray(s) ? s.length : 0;
}

const usd0 = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export function formatQuotedRate(r: QuotedRate): string {
  return `${r.low === r.high ? usd0(r.low) : `${usd0(r.low)}–${usd0(r.high)}`} /${r.unit}`;
}

const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

/** The newest delivered, paid guide purchase in the journal. */
function lastPaidGuide(rows: LedgerRow[]): LedgerRow | null {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].intent === LEASE_GUIDE_INTENT && isPaidRow(rows[i])) return rows[i];
  return null;
}

function lastGuideAttempt(rows: LedgerRow[]): LedgerRow | null {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].intent === LEASE_GUIDE_INTENT) return rows[i];
  return null;
}

/** Whether today's purchase is still to be made: no delivered one in the last 24 h and no failed attempt in the last 2 h. */
export function guideDue(rows: LedgerRow[], now = Date.now()): boolean {
  const paid = lastPaidGuide(rows);
  if (paid && now - Date.parse(paid.at) < LEASE_GUIDE_EVERY_MS) return false;
  const last = lastGuideAttempt(rows);
  if (last && now - Date.parse(last.at) < LEASE_GUIDE_RETRY_MS) return false;
  return true;
}

/** The guide for the screen, built from the journal. Never a made-up number: no rate in the answer → says so; no purchase → "unavailable". */
export function guideFromLedger(rows: LedgerRow[], now = Date.now()): Sourced<string> {
  const paid = lastPaidGuide(rows);
  const base: Omit<Receipt, "status" | "source"> = { network: "testnet", service: "WEB_SEARCH_GENERAL" };
  if (!paid) {
    const last = lastGuideAttempt(rows);
    const why = last ? `last attempt answered ${last.status || "no response"}` : "not bought yet";
    return { value: "Not available", receipt: { ...base, status: "unavailable", costUsd: 0, source: `Lease-rate web search ${why}; no rate is shown` } };
  }
  const body = paid.body as Record<string, unknown> | null;
  const quoted = extractQuotedRate(answerText(body));
  const n = sourceCount(body);
  const at = (body?.timestamp as string | undefined) ?? paid.at;
  const h = paid.receipt_hash ?? paid.tx ?? paid.signal_hash;
  const stale = now - Date.parse(paid.at) > STALE_AFTER_MS;
  return {
    value: quoted ? `${formatQuotedRate(quoted)} (quoted in ${quoted.mentions} search ${quoted.mentions === 1 ? "result" : "results"})` : "No rate quoted in the search results",
    receipt: {
      ...base,
      status: stale ? "stale" : "verified",
      provider: (paid.miner_name ?? undefined) || undefined,
      fetchedAt: at,
      costUsd: paid.cost_usd,
      hash: h ? shortHash(h) : undefined,
      proofUrl: proofUrlOf(paid) ?? undefined,
      source: quoted
        ? `Web search (${n} sources), rate taken verbatim from the snippets; an estimate, not a quote${stale ? " — older than a day" : ""}`
        : `Web search returned ${n} sources and no stated lease rate; nothing is estimated from it${stale ? " — older than a day" : ""}`,
    },
  };
}

/**
 * Buys the guide if it is due (once per day). Never throws: a failure (limit, rate limit, node down) only leaves the guide
 * as it was; decisions do not depend on it. The check is repeated under the payment lock, so two processes never both buy.
 */
export async function buyLeaseGuideIfDue(opts: { force?: boolean; log?: (line: string) => void } = {}): Promise<"bought" | "not-due" | "failed"> {
  const log = opts.log ?? (() => {});
  if (!opts.force && !guideDue(readLedger())) return "not-due";
  try {
    const r = await ask({ intent: LEASE_GUIDE_INTENT, params: { query: LEASE_GUIDE_QUERY } }, "All sites", opts.force ? {} : { skipIf: () => !guideDue(readLedger()) });
    log(`lease guide: Telegraph answered ${r.status}${r.paid ? ` · paid via ${r.rail}` : " · not paid"}`);
    return r.paid ? "bought" : "failed";
  } catch (e) {
    if (e instanceof AlreadyBoughtError) return "not-due";
    log(`lease guide: skipped (${e instanceof SpendLimitError ? "daily limit" : e instanceof Error ? e.message.slice(0, 120) : "error"})`);
    return "failed";
  }
}
