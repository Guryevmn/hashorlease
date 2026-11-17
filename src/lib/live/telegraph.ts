// Server-side Telegraph Engine client: pays from the Telegraph escrow balance when it is funded, otherwise via x402
// (test USDC on Sepolia); keeps the data/ledger.jsonl journal
// and stops at the daily limit. Server-only: the wallet key comes from .env.

import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { buildEscrowPayment, decodeReceipt, findEscrowOffer, isUnfundedEscrow } from "./escrow";

const USDC_SEPOLIA = "0xcc194e1a843B658526D0D5C431f670028582Ae17";
const REQUEST_COST_USD = 0.01;
const LEDGER = join(process.cwd(), "data", "ledger.jsonl");
/** Payment lock on disk: the app and the agent are separate processes and pay strictly one at a time. */
const PAY_LOCK = join(process.cwd(), "data", ".payment.lock");
const PAY_TIMEOUT_MS = 90_000;
/** At most 30 requests per minute across all processes: the devnode limits a client to 60 new questions per minute (429). */
const MAX_ASKS_PER_MINUTE = 30;

export interface LedgerRow {
  at: string;
  intent: string | null;
  params: unknown;
  status: number;
  cost_usd: number;
  tx: string | null;
  signal_hash: string | null;
  miner_name?: string | null;
  /** What the request was made for (site name / "All sites"). */
  purpose?: string;
  body: unknown;
  /** How it was paid: "escrow" (balance on the Telegraph contract, no per-request tx) or "x402" (per-request settlement). */
  rail?: "escrow" | "x402";
  /** Telegraph receipt of a delivered call (both rails); the proof for escrow, which has no tx. */
  receipt_hash?: string | null;
  epoch_id?: number | null;
  /** Why the escrow rail was skipped before falling back to x402 (e.g. balance not funded). */
  escrow_refusal?: string;
  /** No response, but the payment was already sent: counted as spent (conservatively) until proven otherwise. */
  uncertain?: boolean;
  error?: string;
}

export class SpendLimitError extends Error {
  constructor(limit: number) {
    super(`Daily limit $${limit.toFixed(2)} reached`);
  }
}

export class RateLimitError extends Error {
  constructor() {
    super(`More than ${MAX_ASKS_PER_MINUTE} Telegraph requests in the last minute — try again shortly`);
  }
}

export function dailyLimitUsd(): number {
  const v = Number(process.env.DAILY_SPEND_LIMIT_USD ?? "0.5");
  return Number.isFinite(v) && v >= 0 ? v : 0.5;
}

export function readLedger(): LedgerRow[] {
  if (!existsSync(LEDGER)) return [];
  return readFileSync(LEDGER, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as LedgerRow;
      } catch {
        // Truncated line: count it as today's payment so the limit doesn't weaken.
        return { at: new Date().toISOString(), intent: null, params: null, status: 0, cost_usd: REQUEST_COST_USD, tx: null, signal_hash: null, body: null, uncertain: true, error: "unreadable ledger line" };
      }
    });
}

export function spentTodayUsd(now = new Date()): number {
  const day = now.toISOString().slice(0, 10);
  return readLedger()
    .filter((r) => r.at.startsWith(day))
    .reduce((s, r) => s + (r.cost_usd ?? 0), 0);
}

/** Telegraph requests in the last minute per the journal, both paid and failed (402, 504): the devnode saw those too. */
export function asksLastMinute(now = Date.now()): number {
  return readLedger().filter((r) => {
    const t = Date.parse(r.at);
    return now - t < 60_000 && t <= now;
  }).length;
}

/** In-flight requests: their cost is already counted as spent so parallel calls can't break the limit. */
let reservedUsd = 0;

let account: ReturnType<typeof privateKeyToAccount> | null = null;
function getAccount() {
  if (account) return account;
  const key = process.env.TELEGRAPH_WALLET_KEY;
  if (!key) throw new Error("TELEGRAPH_WALLET_KEY is not set");
  account = privateKeyToAccount(key as `0x${string}`);
  return account;
}

let client: x402Client | null = null;
function getClient(): x402Client {
  if (client) return client;
  const c = new x402Client();
  c.register("eip155:*", new ExactEvmScheme(getAccount()));
  // The Telegraph token is not in the default list: allow only it and no more than $0.02 per payment.
  c.setSpendControls({ allowedAssets: [{ network: "eip155:11155111", asset: USDC_SEPOLIA, maxAmountPerPayment: "20000" }] });
  client = c;
  return c;
}

export interface AskResult {
  status: number;
  body: Record<string, unknown> | null;
  tx: string | null;
  /** The call was delivered and paid (x402 with a settlement tx, or escrow with a 200). */
  paid: boolean;
  rail: "escrow" | "x402";
  receiptHash: string | null;
  /** Public proof: the Sepolia tx (x402) or the signal on the Telegraph node (escrow). */
  proofUrl: string | null;
}

/** Payment rail: TELEGRAPH_PAY_RAIL=escrow | x402 | auto (default: escrow first, x402 if the balance is not funded). */
export function payRail(): "escrow" | "x402" | "auto" {
  const v = (process.env.TELEGRAPH_PAY_RAIL ?? "auto").trim().toLowerCase();
  return v === "escrow" || v === "x402" ? v : "auto";
}

export function engineBase(): string {
  return process.env.TELEGRAPH_API_URL || "https://devnode.telegraphprotocol.com/engine/v1";
}

/** Proof link of a journal row: Sepolia tx for x402, the signal lookup on the node for escrow. */
export function proofUrlOf(r: Pick<LedgerRow, "tx" | "signal_hash">): string | null {
  if (r.tx) return `https://sepolia.etherscan.io/tx/${r.tx}`;
  if (r.signal_hash) return `${engineBase()}/signal/${r.signal_hash}`;
  return null;
}

/** Whether a journal row is a delivered, paid call. */
export function isPaidRow(r: LedgerRow): boolean {
  if (r.tx) return true;
  return r.rail === "escrow" && r.status === 200 && (r.cost_usd ?? 0) > 0;
}

async function acquirePayLock(): Promise<() => void> {
  if (!existsSync(join(process.cwd(), "data"))) mkdirSync(join(process.cwd(), "data"));
  const deadline = Date.now() + PAY_TIMEOUT_MS + 15_000;
  for (;;) {
    try {
      const fd = openSync(PAY_LOCK, "wx");
      closeSync(fd);
      return () => {
        try {
          unlinkSync(PAY_LOCK);
        } catch {
          /* already removed */
        }
      };
    } catch {
      // A lock from a crashed process older than two minutes is removed.
      try {
        if (Date.now() - statSync(PAY_LOCK).mtimeMs > 2 * PAY_TIMEOUT_MS) unlinkSync(PAY_LOCK);
      } catch {
        /* vanished on its own */
      }
      if (Date.now() > deadline) throw new Error("Another payment is still in progress");
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

/**
 * Paid request. Throws SpendLimitError if the daily limit is exhausted, and RateLimitError after 30 requests per minute.
 * The limit is strict: the check and the payment run under an on-disk lock (one payment at a time across all processes),
 * and a payment without a response is recorded in the journal as spent.
 */
export async function ask(
  payload: { intent: string; params: Record<string, unknown> } | { query: string },
  purpose: string,
): Promise<AskResult> {
  const limit = dailyLimitUsd();
  if (spentTodayUsd() + reservedUsd + REQUEST_COST_USD > limit + 1e-9) throw new SpendLimitError(limit);
  if (asksLastMinute() >= MAX_ASKS_PER_MINUTE) throw new RateLimitError();
  reservedUsd += REQUEST_COST_USD;
  let release: (() => void) | null = null;
  try {
    release = await acquirePayLock();
    // Under the lock, once more: another process may have paid while we waited.
    if (spentTodayUsd() + REQUEST_COST_USD > limit + 1e-9) throw new SpendLimitError(limit);
    if (asksLastMinute() >= MAX_ASKS_PER_MINUTE) throw new RateLimitError();
    return await doAsk(payload, purpose);
  } finally {
    release?.();
    reservedUsd -= REQUEST_COST_USD;
  }
}

type Payload = { intent: string; params: Record<string, unknown> } | { query: string };

interface RawAnswer {
  status: number;
  body: Record<string, unknown> | null;
  headers: Headers;
  rail: "escrow" | "x402";
  escrowRefusal?: string;
}

/**
 * Escrow attempt: read the challenge (free), sign the escrow template, send it in X-PAYMENT.
 * Returns null when the node offers no escrow, or (in auto mode) when the balance is not funded: then x402 is used.
 */
async function askEscrow(url: string, reqBody: string, tracked: typeof fetch, mode: "escrow" | "auto"): Promise<RawAnswer | { skip: string }> {
  const ch = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: reqBody, signal: AbortSignal.timeout(30_000) });
  const challenge = await ch.json().catch(() => null);
  const offer = ch.status === 402 ? findEscrowOffer(challenge) : null;
  if (!offer) {
    if (mode === "escrow") throw new Error(`Telegraph offers no escrow payment (status ${ch.status})`);
    return { skip: "no escrow offer in the challenge" };
  }
  const acc = getAccount();
  const { header } = await buildEscrowPayment(offer, acc.address, (message) => acc.signMessage({ message }));
  const res = await tracked(url, {
    method: "POST",
    headers: { "content-type": "application/json", "X-PAYMENT": header },
    body: reqBody,
    signal: AbortSignal.timeout(PAY_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = typeof body?.reason === "string" ? body.reason : null;
  if (res.status === 402 && mode === "auto" && isUnfundedEscrow(reason)) return { skip: reason!.slice(0, 200) };
  return { status: res.status, body, headers: res.headers, rail: "escrow" };
}

async function askX402(url: string, reqBody: string, tracked: typeof fetch): Promise<RawAnswer> {
  const pay = wrapFetchWithPayment(tracked, getClient());
  const res = await pay(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: reqBody,
    signal: AbortSignal.timeout(PAY_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, body, headers: res.headers, rail: "x402" };
}

async function doAsk(payload: Payload, purpose: string): Promise<AskResult> {
  getAccount(); // no wallet: fail on the client, before any network call
  // We notice whether a request with a signed payment went out: if it drops, we count the money as spent.
  let paymentSent = false;
  let railTried: "escrow" | "x402" = "x402";
  const tracked: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if ([...headers.keys()].some((k) => k.includes("payment"))) paymentSent = true;
    return fetch(input, init);
  };
  const url = `${engineBase()}/ask`;
  const reqBody = JSON.stringify(payload);
  const mode = payRail();
  let ans: RawAnswer;
  let escrowRefusal: string | undefined;
  try {
    let viaEscrow: RawAnswer | { skip: string } | null = null;
    if (mode !== "x402") {
      railTried = "escrow";
      viaEscrow = await askEscrow(url, reqBody, tracked, mode);
    }
    if (viaEscrow && "status" in viaEscrow) ans = viaEscrow;
    else {
      escrowRefusal = viaEscrow?.skip;
      railTried = "x402";
      paymentSent = false;
      ans = await askX402(url, reqBody, tracked);
    }
  } catch (e) {
    if (paymentSent) {
      const row: LedgerRow = {
        at: new Date().toISOString(),
        intent: "intent" in payload ? payload.intent : null,
        params: "intent" in payload ? payload.params : { query: payload.query },
        status: 0,
        cost_usd: REQUEST_COST_USD,
        tx: null,
        signal_hash: null,
        purpose,
        body: null,
        rail: railTried,
        uncertain: true,
        error: e instanceof Error ? e.message.slice(0, 200) : "request failed",
      };
      appendFileSync(LEDGER, JSON.stringify(row) + "\n");
    }
    throw e;
  }
  const { body, status } = ans;

  let tx: string | null = null;
  if (ans.rail === "x402") {
    try {
      const receipt = new x402HTTPClient(getClient()).getPaymentSettleResponse((n) => ans.headers.get(n));
      if (receipt?.success) tx = receipt.transaction ?? null;
    } catch {
      /* no payment was made */
    }
  }
  const tgReceipt = decodeReceipt(ans.headers.get(ans.rail === "escrow" ? "x-payment-response" : "x-telegraph-receipt"));
  // Escrow: a delivered 200 is billed at the epoch close; a failed request is never billed.
  const paid = ans.rail === "escrow" ? status === 200 : !!tx;
  const cost = paid ? ((body?.cost_usd as number | undefined) ?? REQUEST_COST_USD) : 0;

  if (!existsSync(join(process.cwd(), "data"))) mkdirSync(join(process.cwd(), "data"));
  const row: LedgerRow = {
    at: new Date().toISOString(),
    intent: "intent" in payload ? payload.intent : ((body?.intent as string | undefined) ?? null),
    params: "intent" in payload ? payload.params : { query: payload.query },
    status,
    cost_usd: cost,
    tx,
    signal_hash: (body?.signal_hash as string | undefined) ?? null,
    miner_name: (body?.miner_name as string | undefined) ?? null,
    purpose,
    body,
    rail: ans.rail,
    receipt_hash: tgReceipt?.receipt_hash ?? null,
    epoch_id: tgReceipt?.epoch_id ?? null,
    ...(escrowRefusal ? { escrow_refusal: escrowRefusal } : {}),
  };
  appendFileSync(LEDGER, JSON.stringify(row) + "\n");
  return { status, body, tx, paid, rail: ans.rail, receiptHash: row.receipt_hash ?? null, proofUrl: paid ? proofUrlOf(row) : null };
}
