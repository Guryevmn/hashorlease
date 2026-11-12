# Hash or Lease — reviewer guide

Telegraph Hackathon Season II · Apps & Agents · Mission 12 "Mining and Power" (example 1, "The allocation agent").

Every hour, for every mining site, Hash or Lease answers one question: **Mine, Lease to AI, or Switch off?**
It shows the call in $/h, the three options in $/MWh, and a receipt under every input number.
An hourly agent makes the call without a browser, pays for its Telegraph data itself (x402, testnet USDC) and stops at a daily spend limit.

**Network: testnet only.** Telegraph devnode (`devnode.telegraphprotocol.com`), payments in test USDC on Ethereum Sepolia. No real money, no mainnet transactions.
See [What is verified](#7-what-is-verified-and-what-is-not) before relying on any claim.

---

## 1. Run it from scratch (5 min, no wallet needed)

Requirements: Node.js **22.18+** (the agent and the bot run TypeScript directly through Node's built-in type stripping).

```
npm install
npm run build && npm start          # http://localhost:3000  (or: npm run dev)
```

Without `NEXT_PUBLIC_DATA_MODE=live` in `.env` the app starts in **demo mode**: invented numbers and receipts, a yellow "Demo data" strip on every screen, no network calls, no wallet.

Screens: **Places** (`/`), **Place detail** (`/sites/<id>`), **Edit place** (`/sites/<id>/edit`), **History** (`/feed`), **Usage** (`/spend`), **Add place** (`/sites/new`).

Run the hourly agent once on demo data (no network, no money):

```
npm run agent -- --mode=mock --once
```

Expected output (real log from 2026-11-09):

```
[2026-11-09T19:49:03Z] Hash or Lease agent · mode mock (demo data, no network, no money) · Telegram alerts off (no HASHORLEASE_BOT_TOKEN in .env)
[2026-11-09T19:49:03Z] mock cycle for 19:00 UTC · 3 sites · 3 decided · 0 paused · paid requests 0 · spent today $0.00 of $1.00
[2026-11-09T19:49:03Z]   Houston Hub: Lease to AI · receipt MINING_HASHPRICE_VERIFY 0x6269…9bd0, GRID_POWER_PRICE 0x55f8…e138
[2026-11-09T19:49:03Z]   North Ridge: Switch off · receipt MINING_HASHPRICE_VERIFY 0x6269…9bd0, GRID_POWER_PRICE 0x91c4…07ad
[2026-11-09T19:49:03Z]   My tariff (garage): Mine (keep as is) · receipt MINING_HASHPRICE_VERIFY 0x6269…9bd0
[2026-11-09T19:49:03Z]   saved to data/agent/mock/ · alerts: 0 (0 sent to Telegram)
```

The Usage screen then shows an "Hourly agent" card with the last run. Without `--once` the agent keeps running and repeats every hour at hh:01 UTC (retry in 10 minutes after a failure; `Ctrl+C` stops it; a second copy refuses to start).

**See a call change (demo data, 30 seconds).** In our live run no call has changed yet, so this is shown on an invented site with an invented day of prices, run through the same agent cycle:

```
npm run demo:day -- --speed=0
```

It prints 24 simulated hours with the reason for each, and the two bot alerts (`Lease to AI → Mine` at 11:00, `Mine → Lease to AI` at 16:00, each with a `Why:` line). In the app: Places → **See a call change**, or `/demo-day` → **Play the day**. Nothing is requested, paid or sent; every number is marked `demo` and the journal goes to its own folder `data/agent/demo/`. What the numbers were checked against: [docs/demo-day/README.md](demo-day/README.md).

Checks:

```
npm test            # 94 tests: decision logic, agent cycle, demo day, bot messages, site storage, spend limit, request rate
npm run typecheck
npm run build
```

## 2. Live mode (real Telegraph purchase on testnet)

Live mode needs a funded **test** wallet. Keys never go into code or git: `.env` is git-ignored, `.env.example` lists the variables.

1. `node scripts/create-wallet.mjs` — creates a throwaway key in `.env` and prints only the address.
2. Fund that address on **Sepolia**: a little Sepolia ETH (gas for `mint`) and test USDC `0xcc194e1a843B658526D0D5C431f670028582Ae17` (the token has an open `mint`). x402 payments themselves need no gas. *(We funded our wallet this way on 2026-11-09; we did not re-run the funding steps for this guide.)*
3. In `.env`: `NEXT_PUBLIC_DATA_MODE=live`, `DAILY_SPEND_LIMIT_USD=0.50` (any value; default 0.50).
4. `npm run build && npm start`, and the agent: `npm run agent -- --once` (or without `--once` to keep it hourly).

What live mode buys and where the other numbers come from:

| Input | Source | Paid? |
|---|---|---|
| BTC price | Telegraph `CRYPTO_PRICE_USD` (free-text query, x402) | $0.01 test USDC, receipt = Sepolia tx |
| Network hashrate, block rewards | mempool.space | free, public |
| Mining income ($/PH/day) | computed: 144 blocks × avg reward × BTC price ÷ hashrate | — |
| Power price, current hour | Energy-Charts day-ahead (DE-LU, FR, PL, AT, NL) | free, public — shown with a globe icon "Public source, not bought via Telegraph" |
| AI lease rate, overhead | entered by the operator | "Your input" |

One purchase covers all sites and is reused for 30 minutes by both the app and the agent (`data/snapshot.json`), so the hourly agent costs about **$0.24/day**.

Power prices of $360–520/MWh in the agent log are real evening prices, not a unit error: for 2026-11-09 19:00–20:00 UTC Energy-Charts day-ahead averaged €374.88/MWh for DE-LU and €465.96/MWh for PL (four 15-minute prices), which at EUR→USD ≈1.12 gives the $420.59 (Leipzig Hub) and $522.77 (Silesia Farm) in `docs/evidence/agent-decisions.jsonl`. Source: https://api.energy-charts.info/price?bzn=DE-LU&start=2026-11-09&end=2026-11-10 (same for `bzn=PL`).

Why not Telegraph for hashprice and power? On the devnode, `MINING_HASHPRICE_VERIFY_GENERAL` returned `null` fields and `GRID_POWER_PRICE_GENERAL` for ERCOT hubs returned `null` prices (9 paid probes on 2026-11-09: 6 in `docs/evidence/ledger.jsonl`, 3 made before the ledger existed and saved in `docs/evidence/first-hashprice.json` and `docs/evidence/second-queries.json`). We use Telegraph where it returned real numbers and say so on screen.

## 3. Try a new input

**In the app:** Places → **+ Add place**.
- Grid node: pick a zone chip (e.g. *France*), name "Paris Test", Mining power `500` PH/s, Power draw `10` MW, Efficiency `20` J/TH → **Add place**. You land on the new place with a call, the three options and receipts.
- My tariff: switch to *My tariff*, rate `0.05` $/kWh, `1` PH/s, `0.03` MW, `30` J/TH. The power price then shows "Your input" instead of a receipt.
- Change any number later: place → **Edit site**. Delete: **⋯ Menu → Delete**.

**Through the API** (live mode, the same validation as the form):

```
curl -s -X POST localhost:3000/api/live/sites -H 'content-type: application/json' -d '{"kind":"grid","name":"Paris Test","nodeId":"FR","mw":10,"phs":500,"jPerTh":20,"thresholdUsdPerMwh":5}'
```

Live sites are stored on the server in `data/sites.json` (git-ignored), so the hourly agent decides for them without a browser. The next agent run includes the new place.

## 4. Inspect the real Telegraph request and its payment

- **Place detail** → "Where the numbers come from" → green ✓ next to *Mining revenue* → **Service** `CRYPTO_PRICE_USD`, **Provider** (Telegraph miner, e.g. "Cp Gemini"), time, cost `$0.010 USDC · testnet`, short tx hash and **View payment on Sepolia ↗**. Screenshot: `docs/shots/site-detail-receipt.png`.
- **Place detail** → **Copy audit summary**: all receipts of the call as text, with Sepolia links.
- **Usage** → *Paid requests*: every purchase with provider, cost, status and `proof ↗`; **Export CSV**.
- **Agent log**: each run prints the receipt it used and how many paid requests it made.
- **Raw evidence:** `docs/evidence/ledger.jsonl` — a copy of the app’s `data/ledger.jsonl` (git-ignored) as of 2026-11-09, one line per paid request: `intent`, `status`, `cost_usd`, `tx`, `signal_hash`, `miner_name`, full response body. The ledger is append-only; we never edit it. What is in it: see [What is in the ledger](#what-is-in-the-ledger).
- **Check a payment on-chain without trusting us** (read-only, free):

```
curl -s -X POST https://ethereum-sepolia-rpc.publicnode.com -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df"]}'
```

That transaction is the agent's own purchase from 2026-11-09 19:57 UTC: `status 0x1`, block 12099744, `to` = the test USDC contract. Explorer: https://sepolia.etherscan.io/tx/0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df

- **Manual query** with the same client: `node scripts/telegraph.mjs query "What is the current price of Bitcoin (BTC) in USD?"` (pays $0.01, respects the limit, appends to the ledger; not re-run for this guide).

### What is in the ledger

127 requests, all on 2026-11-09: **94 paid ($0.94)** and 33 unpaid with no settlement (1 × `400`, 18 × `402 payment required`, 14 × `504`). By origin: 8 manual probes 05:27–05:36 UTC (7 paid); 1 first live check at 05:39; **a burst of 107 requests 05:39:58–05:41:31** (75 paid and all 32 of the 402/504) — our first live build under parallel headless-browser screenshots, when concurrent page loads each started their own BTC-price purchase because that version had no shared in-flight request and its limit check did not count payments in flight, so spend went past the $0.50 limit set then; fixed at 05:41 (one shared snapshot, in-flight reservation), the file lock came later. The devnode rate limit (60 new questions per client per minute) was not what failed: there is no `429` in the ledger, and every request in the burst repeated the same question, which the node does not count; most `402`s (15 of 17) are settlements the facilitator could not complete ("payment was verified but could not be settled") while many payments from one wallet were in flight, and the `504`s are gateway timeouts. Since 2026-11-10 the client also refuses a 31st request within any minute (`src/lib/live/telegraph.ts`); then 11 single purchases (8 by the app during development, 3 by the hourly agent at 19:57, 20:04 and 20:19). Three more paid probes ran before the ledger existed and are in `docs/evidence/first-hashprice.json` and `docs/evidence/second-queries.json`. Agent runs and decisions of that day: `docs/evidence/agent-runs.jsonl`, `docs/evidence/agent-decisions.jsonl`.

## 5. Break it (reasonable failures)

None of these spends money. `--fresh` (only together with `--once`) tells the live agent to skip the 30-minute cache and try to buy now.

| Failure | How to trigger | What you see |
|---|---|---|
| **Spend limit** | `DAILY_SPEND_LIMIT_USD=0 npm run agent -- --mode=live --once --fresh` | No payment is attempted, even on a fresh install with nothing spent yet (with `0.01` the first $0.01 request would still fit under the limit). Log (the alert line appears once per UTC day): `⛔ Daily spend limit reached ($0.00). Calls are paused until 00:00 UTC.` and `Leipzig Hub: on hold: Paused · daily limit` for every place; `paid requests 0`. History shows the hour as "Paused · daily limit". The limit is checked before every payment against `data/ledger.jsonl` under a file lock shared by the app and the agent (one payment at a time), a payment sent without an answer is booked as spent, and each x402 payment is capped at $0.02 for the test USDC asset only. |
| **Telegraph unavailable** | `TELEGRAPH_API_URL=https://telegraph.invalid/engine/v1 npm run agent -- --mode=live --once --fresh` | Log: `⚠️ Can't reach Telegraph. I'll keep trying…` and every place `on hold: Paused · no fresh Telegraph receipt`. The app shows a red banner "Can't reach Telegraph. Showing the last decision from HH:MM", places get an "Outdated" badge, the receipt turns grey ("Unavailable"). Rule: **no fresh Telegraph receipt → no call.** The next normal run logs `✅ Data is reachable again. Hourly calls are back on.` |
| **One price provider down** | `npm run agent -- --mode=mock --once --state=provider-error` (or open any screen with `?state=provider-error`) | Only that place is on hold: `⚠️ North Ridge: grid price unavailable. Last call (19:00): Switch off. Retrying in 10 min.` Other places are still decided. |
| **Invalid input** | Add place with Efficiency `2` J/TH, or Power draw `0` | Inline error next to the field: "Efficiency looks off: 2 J/TH is below any known miner". The API answers `400 {"ok":false,"error":"invalid","message":"Check the highlighted fields: Efficiency looks off: 2 J/TH is below any known miner."}` |
| **Unsupported zone** | Live mode, type `HB_HOUSTON` as power source | "Zone "HB_HOUSTON" isn't available in live mode yet. Pick one from the list (DE-LU, FR, PL, AT, NL) or use My tariff." API: `422 node-not-found`. |
| **Bad agent options** | `npm run agent -- --bogus` | `Unknown option --bogus. Use --once, --fresh, --mode=mock|live, …` and exit code 2. |
| **No bot token** | `npm run bot` | `Telegram bot is off: HASHORLEASE_BOT_TOKEN is not set in .env.` and exit code 1. The app and the agent keep working. |

All UI states can also be previewed on demo data from the footer links or with `?state=loading | empty | error | provider-error | limit` on any screen.

## 6. Telegram bot (optional)

`npm run bot` (grammY) needs `HASHORLEASE_BOT_TOKEN` from @BotFather in `.env`.
`/start` subscribes the chat to alerts, `/now` (or `/now Leipzig`) shows the current call per place, `/stop` unsubscribes, `/demo` replays the simulated demo day (every message marked 🧪 demo data).
The hourly agent sends "🔄 Leipzig Hub: Mine → Lease to AI …" when a call changes, plus limit / provider / Telegraph-down alerts, once per state change.
The bot never pays: `/now` reads the agent's last records. Message texts are covered by tests (`src/lib/bot/messages.test.ts`).
Without a token the agent prints the alerts it would have sent (`alert (bot not configured, not sent): …`).

## 7. What is verified and what is not

**Verified by us (2026-11-09):**
- x402 purchase from the Telegraph devnode, paid in test USDC on Sepolia, by the hourly agent without a browser: agent purchases are in the ledger next to earlier manual probes and development requests (94 paid requests in total on 2026-11-09, see [What is in the ledger](#what-is-in-the-ledger)), receipts checked on-chain (`status 0x1`).
- The daily limit stops purchases before payment (live runs with limits $0.50 and $0.01 while $0.92–0.93 was spent: 0 payments, all places paused; on 2026-11-10 `DAILY_SPEND_LIMIT_USD=0` on a clean copy with an empty ledger and no wallet key: 0 payments, all places paused; unit test `src/lib/live/telegraph.test.ts`).
- Telegraph unreachable → no call, banner and alerts, no payment.
- All screens in demo and live mode open without console errors (68 demo + 17 live automated browser checks, desktop and a 390 px phone viewport).
- `npm test` (94 tests as of 2026-11-12), `npm run typecheck`, `npm run build` pass.
- Demo day (2026-11-12): `npm run demo:day` and the `/demo-day` screen show two changes of call on invented prices; desktop and a 390 px phone viewport, no console errors. This verifies the mechanism, not live behaviour.

**Network:** testnet only — Telegraph devnode + Ethereum Sepolia (test USDC). Nothing ran on mainnet.

**Not verified / not done:**
- Real money, mainnet, real customers: none. No operator has used the app yet; the sites in live mode are examples.
- Telegraph hashprice and ERCOT power intents returned empty numbers on the devnode, so hashprice is computed by us and power comes from Energy-Charts (Europe). US (ERCOT) sites work only in demo mode.
- AI lease rates are operator input; the Telegraph `WEB_SEARCH` "market guide" is shown only in demo mode.
- The Telegram bot is implemented and its messages are tested, but it has **not** been run against Telegram (no token yet).
- **No call has changed in live operation** (power stayed at $189–610/MWh, far above mining revenue), so the change alert has not fired live. The change of call is demonstrated only on the demo day, with invented prices.
- The app has no login; the site API and "Refresh now" (throttled to once per 2 minutes, capped by the daily limit) are meant for a local or single-operator install, not a public deployment.
- History hours before the agent started are recomputed from past day-ahead prices with today's mining income; only hours tagged "Agent call" were decided live.
