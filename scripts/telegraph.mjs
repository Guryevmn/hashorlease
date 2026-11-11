// Telegraph Engine client: pays via x402 (Sepolia USDC), keeps a ledger in data/ledger.jsonl and enforces the daily limit.
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const URL = `${env.TELEGRAPH_API_URL}/ask`;
const LIMIT_USD = Number(env.DAILY_SPEND_LIMIT_USD ?? "0.50");
const USDC = "0xcc194e1a843B658526D0D5C431f670028582Ae17";
const LEDGER = "data/ledger.jsonl";

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(privateKeyToAccount(env.TELEGRAPH_WALLET_KEY)));
client.setSpendControls({ allowedAssets: [{ network: "eip155:11155111", asset: USDC, maxAmountPerPayment: "20000" }] });
const pay = wrapFetchWithPayment(fetch, client);

function spentToday() {
  if (!existsSync(LEDGER)) return 0;
  const day = new Date().toISOString().slice(0, 10);
  return readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    .filter((r) => r.at.startsWith(day)).reduce((s, r) => s + (r.cost_usd ?? 0), 0);
}

export async function ask(intent, params) {
  const payload = intent === null ? { query: params } : { intent, params };
  if (spentToday() + 0.01 > LIMIT_USD) throw new Error(`Daily limit of $${LIMIT_USD} reached`);
  const res = await pay(URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const body = await res.json().catch(() => null);
  let receipt = null;
  try { receipt = new x402HTTPClient(client).getPaymentSettleResponse((n) => res.headers.get(n)); } catch {}
  if (!existsSync("data")) mkdirSync("data");
  appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), intent, params, status: res.status, cost_usd: receipt?.success ? (body?.cost_usd ?? 0.01) : 0, tx: receipt?.transaction ?? null, signal_hash: body?.signal_hash ?? null, body }) + "\n");
  return { status: res.status, body, receipt };
}

if (process.argv[1].endsWith("telegraph.mjs") && process.argv[2]) {
  const free = process.argv[2] === "query";
  const r = await ask(free ? null : process.argv[2], free ? process.argv[3] : JSON.parse(process.argv[3] ?? "{}"));
  console.log(r.status, JSON.stringify(r.body?.result ?? r.body).slice(0, 1200), "| field_status:", JSON.stringify(r.body?.field_status), "| tx:", r.receipt?.transaction);
}
