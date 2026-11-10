// Серверный клиент Telegraph Engine: платит x402 (тестовый USDC в Sepolia), ведёт журнал data/ledger.jsonl
// и останавливается на дневном лимите. Работает только на сервере: ключ кошелька из .env.

import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const USDC_SEPOLIA = "0xcc194e1a843B658526D0D5C431f670028582Ae17";
const REQUEST_COST_USD = 0.01;
const LEDGER = join(process.cwd(), "data", "ledger.jsonl");
/** Замок оплаты на диске: приложение и агент — разные процессы, платят строго по очереди. */
const PAY_LOCK = join(process.cwd(), "data", ".payment.lock");
const PAY_TIMEOUT_MS = 90_000;
/** Не больше 30 запросов за минуту на все процессы: у devnode лимит 60 новых вопросов в минуту на клиента (429). */
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
  /** Для чего сделан запрос (название площадки / «All sites»). */
  purpose?: string;
  body: unknown;
  /** Ответа нет, но платёж уже был отправлен: считаем потраченным (осторожно), пока не доказано обратное. */
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
        // Оборванная строка: считаем её сегодняшним платежом, чтобы лимит не ослаб.
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

/** Запросы к Telegraph за последнюю минуту по журналу — и оплаченные, и с ошибкой (402, 504): devnode их тоже видел. */
export function asksLastMinute(now = Date.now()): number {
  return readLedger().filter((r) => {
    const t = Date.parse(r.at);
    return now - t < 60_000 && t <= now;
  }).length;
}

/** Запросы в полёте: их стоимость уже считается потраченной, чтобы параллельные вызовы не пробили лимит. */
let reservedUsd = 0;

let client: x402Client | null = null;
function getClient(): x402Client {
  if (client) return client;
  const key = process.env.TELEGRAPH_WALLET_KEY;
  if (!key) throw new Error("TELEGRAPH_WALLET_KEY is not set");
  const c = new x402Client();
  c.register("eip155:*", new ExactEvmScheme(privateKeyToAccount(key as `0x${string}`)));
  // Токен Telegraph не из списка по умолчанию — разрешаем только его и не больше $0.02 за платёж.
  c.setSpendControls({ allowedAssets: [{ network: "eip155:11155111", asset: USDC_SEPOLIA, maxAmountPerPayment: "20000" }] });
  client = c;
  return c;
}

export interface AskResult {
  status: number;
  body: Record<string, unknown> | null;
  tx: string | null;
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
          /* уже снят */
        }
      };
    } catch {
      // Замок от упавшего процесса старше двух минут — снимаем.
      try {
        if (Date.now() - statSync(PAY_LOCK).mtimeMs > 2 * PAY_TIMEOUT_MS) unlinkSync(PAY_LOCK);
      } catch {
        /* исчез сам */
      }
      if (Date.now() > deadline) throw new Error("Another payment is still in progress");
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

/**
 * Платный запрос. Бросает SpendLimitError, если дневной лимит исчерпан, и RateLimitError — после 30 запросов за минуту.
 * Лимит жёсткий: проверка и оплата идут под замком на диске (один платёж за раз на все процессы),
 * а платёж без ответа записывается в журнал как потраченный.
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
    // Под замком — ещё раз: пока ждали, мог заплатить другой процесс.
    if (spentTodayUsd() + REQUEST_COST_USD > limit + 1e-9) throw new SpendLimitError(limit);
    if (asksLastMinute() >= MAX_ASKS_PER_MINUTE) throw new RateLimitError();
    return await doAsk(payload, purpose);
  } finally {
    release?.();
    reservedUsd -= REQUEST_COST_USD;
  }
}

async function doAsk(
  payload: { intent: string; params: Record<string, unknown> } | { query: string },
  purpose: string,
): Promise<AskResult> {
  const c = getClient();
  // Замечаем, ушёл ли запрос с подписанным платежом: тогда при обрыве считаем деньги потраченными.
  let paymentSent = false;
  const tracked: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if ([...headers.keys()].some((k) => k.includes("payment"))) paymentSent = true;
    return fetch(input, init);
  };
  const pay = wrapFetchWithPayment(tracked, c);
  const base = process.env.TELEGRAPH_API_URL ?? "https://devnode.telegraphprotocol.com/engine/v1";
  let res: Response;
  try {
    res = await pay(`${base}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(PAY_TIMEOUT_MS),
    });
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
        uncertain: true,
        error: e instanceof Error ? e.message.slice(0, 200) : "request failed",
      };
      appendFileSync(LEDGER, JSON.stringify(row) + "\n");
    }
    throw e;
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  let tx: string | null = null;
  try {
    const receipt = new x402HTTPClient(c).getPaymentSettleResponse((n) => res.headers.get(n));
    if (receipt?.success) tx = receipt.transaction ?? null;
  } catch {
    /* оплаты не было */
  }

  if (!existsSync(join(process.cwd(), "data"))) mkdirSync(join(process.cwd(), "data"));
  const row: LedgerRow = {
    at: new Date().toISOString(),
    intent: "intent" in payload ? payload.intent : ((body?.intent as string | undefined) ?? null),
    params: "intent" in payload ? payload.params : { query: payload.query },
    status: res.status,
    cost_usd: tx ? ((body?.cost_usd as number | undefined) ?? REQUEST_COST_USD) : 0,
    tx,
    signal_hash: (body?.signal_hash as string | undefined) ?? null,
    miner_name: (body?.miner_name as string | undefined) ?? null,
    purpose,
    body,
  };
  appendFileSync(LEDGER, JSON.stringify(row) + "\n");
  return { status: res.status, body, tx };
}
