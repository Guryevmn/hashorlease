# Hash or Lease — reviewer guide

Telegraph Hackathon Season II · Apps & Agents · Mission 12 "Mining and Power" (example 1, "The allocation agent").

Every hour, for every mining site, Hash or Lease answers one question: **Mine, Lease to AI, or Switch off?**
It shows the call in $/h, the three options in $/MWh, and a receipt under every input number.
An hourly agent makes the call without a browser, pays for its Telegraph data itself (per request, with x402 or from a prepaid Telegraph deposit; testnet USDC) and stops at a daily spend limit.

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

**Live changes of call.** The live run recorded two, both on 15 Nov 2026 at Silesia Farm: 08:00 UTC Switch off → Lease to AI and 13:00 UTC Lease to AI → Switch off (History → filter *7 d* → *Changed from…*; or `grep '"changed":true' data/agent/live/decisions.jsonl`). No live call has ever been Mine.

**See a Mine flip (demo data, 30 seconds).** That flip never happened live, so it is shown on an invented site with an invented day of prices, run through the same agent cycle:

```
npm run demo:day -- --speed=0
```

It prints 24 simulated hours with the reason for each, and the two bot alerts (`Lease to AI → Mine` at 11:00, `Mine → Lease to AI` at 16:00, each with a `Why:` line). In the app: Places → **See a call change**, or `/demo-day` → **Play the day**. Nothing is requested, paid or sent; every number is marked `demo` and the journal goes to its own folder `data/agent/demo/`. What the numbers were checked against: [docs/demo-day/README.md](demo-day/README.md).

Checks:

```
npm test            # 154 tests in 15 files: decision logic, agent cycle, demo day, bot messages, site form, site storage, spend limit, request rate
npm run typecheck
npm run build
```

## 2. Live mode (real Telegraph purchase on testnet)

Live mode needs a funded **test** wallet. Keys never go into code or git: `.env` is git-ignored, `.env.example` lists the variables.

Telegraph takes payment per request in two ways ([Pay per Request (x402)](https://anjoman.ai/docs/using/x402-inference) and [Pay from Escrow](https://anjoman.ai/docs/using/escrow-inference)). Both use the same test USDC on Sepolia and return the same kind of Telegraph receipt. The agent chooses with `TELEGRAPH_PAY_RAIL` in `.env`:

| Value | What it does |
|---|---|
| `auto` (default) | Pays from your Telegraph deposit first; if the deposit is empty (`insufficient escrow`), pays per request with x402. |
| `escrow` | Deposit only. |
| `x402` | Per request only: one Sepolia transaction per purchase, settled by a third-party facilitator. |

**Which one to use.** Use `auto` and fund the deposit (step 3). On 17 Nov 2026 the x402 facilitator stopped settling payments for 13.5 hours (see §7); the deposit does not use it. With an empty deposit and a facilitator that is down you will get `402 payment required … settlement failed` and the agent will pause every site — that is the pause rule working, not a broken install.

1. `node scripts/create-wallet.mjs` — creates a throwaway key in `.env` and prints only the address.
2. Fund that address on **Sepolia**: a little Sepolia ETH (gas for `mint` and for the deposit) and test USDC `0xcc194e1a843B658526D0D5C431f670028582Ae17` (the token has an open `mint`). x402 payments themselves need no gas. *(We funded our wallet this way on 2026-11-09; we did not re-run the funding steps for this guide.)*
3. **Top up the Telegraph deposit** (the Telegraph docs, [Pay from Escrow → Step 1](https://anjoman.ai/docs/using/escrow-inference): `approve` the Telegraph contract for the USDC, then `depositUSDC(amount)`; amounts are in micro-USDC, `1000000` = 1 USDC, which pays for about 100 requests at $0.01, roughly four days of hourly calls). The contract address changes when Telegraph redeploys the devnode (the docs page still showed the older `0x3624…` on 17 Nov), so read the current one from the free challenge of the devnode — the `payTo` of the `escrow` entry:

```
curl -s -X POST https://devnode.telegraphprotocol.com/engine/v1/ask -H 'content-type: application/json' -d '{"query":"What is the current price of Bitcoin (BTC) in USD?"}' | python3 -c "import sys,json; print([a['payTo'] for a in json.load(sys.stdin)['accepts'] if a['scheme']=='escrow'])"
export DIAMOND=<that address> USDC=0xcc194e1a843B658526D0D5C431f670028582Ae17 RPC=https://ethereum-sepolia-rpc.publicnode.com
cast send $USDC "approve(address,uint256)" $DIAMOND 1000000 --rpc-url $RPC --private-key $KEY
cast send $DIAMOND "depositUSDC(uint256)" 1000000 --rpc-url $RPC --private-key $KEY
```

   **Our own deposit, as proof the step works** (17 Nov 2026, 20:22 UTC, the agent's wallet, 1 test USDC into the current contract `0x72a70e949362670Bf8bceAd24eFC5b8f950aa08b`): approve [`0x73b3895b46b0307f78e1b86f66e697aae7b1efe5a4fe468e9934ee4cfbe9e174`](https://sepolia.etherscan.io/tx/0x73b3895b46b0307f78e1b86f66e697aae7b1efe5a4fe468e9934ee4cfbe9e174) (block 12156735) and deposit [`0xba1da5f10e2cda2c315e31c36e4c353092c340f85bbec91e57dd74ade3ab0e93`](https://sepolia.etherscan.io/tx/0xba1da5f10e2cda2c315e31c36e4c353092c340f85bbec91e57dd74ade3ab0e93) (block 12156736), both `status 0x1`, the deposit's `to` is the contract above. Check it without trusting us (read-only, free):

```
curl -s -X POST https://ethereum-sepolia-rpc.publicnode.com -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["0xba1da5f10e2cda2c315e31c36e4c353092c340f85bbec91e57dd74ade3ab0e93"]}'
```

   We could not read the balance back: the documented getters (`escrowBalance`, `effectiveBalance`) were not available on the new contract on 17 Nov, so an empty deposit shows up only as the refusal `insufficient escrow`, after which `auto` falls back to x402. *(We deposited from a wallet that was already set up; we have not repeated steps 1–3 from a brand-new wallet for this guide.)*
4. In `.env`: `NEXT_PUBLIC_DATA_MODE=live`, `DAILY_SPEND_LIMIT_USD=0.50` (any value; default 0.50), `TELEGRAPH_PAY_RAIL=auto`.
5. `npm run build && npm start`, and the agent: `npm run agent -- --once` (or without `--once` to keep it hourly).

What live mode buys and where the other numbers come from:

| Input | Source | Paid? |
|---|---|---|
| BTC price | Telegraph `CRYPTO_PRICE_USD` (free-text query; x402 or deposit) | $0.01 test USDC; receipt = Sepolia tx (x402) or `receipt_hash` + signal link (deposit) |
| Network hashrate, block rewards | mempool.space | free, public |
| Mining income ($/PH/day) | computed: 144 blocks × avg reward × BTC price ÷ hashrate | — |
| Power price, current hour | Energy-Charts day-ahead (DE-LU, FR, PL, AT, NL) | free, public — shown with a globe icon "Public source, not bought via Telegraph" |
| AI lease rate, overhead | entered by the operator | "Your input" |

One purchase covers all sites and is reused for 30 minutes by both the app and the agent (`data/snapshot.json`), so the hourly agent costs about **$0.24/day**, plus **$0.01/day** for one lease-rate web search (`WEB_SEARCH_GENERAL`, bought once per 24 h; `npm run lease-guide` runs it now; a hint only, never an input of the decision).

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

- **Place detail** → "Where the numbers come from" → green ✓ next to *Mining revenue* → **Service** `CRYPTO_PRICE_USD`, **Provider** (Telegraph miner, e.g. "Cp Gemini"), time, cost `$0.010 USDC · testnet`, and the proof: for an x402 payment a short tx hash and **View payment on Sepolia ↗**, for a payment from the deposit the Telegraph receipt hash and a link to the receipt (see "A payment from the deposit" below). Screenshot of an x402 receipt: `docs/shots/site-detail-receipt.png`.
- **Place detail** → **Copy audit summary**: all receipts of the call as text, with Sepolia links.
- **Usage** → *Paid requests*: every purchase with provider, cost, status and `proof ↗`; **Export CSV**.
- **Agent log**: each run prints the receipt it used and how many paid requests it made.
- **Raw evidence:** `docs/evidence/ledger.jsonl` — a snapshot of the app’s `data/ledger.jsonl` (git-ignored) up to 2026-11-17 20:40 UTC, one line per request: `intent`, `status`, `cost_usd`, `tx` (x402) or `rail`/`receipt_hash`/`epoch_id` (deposit), `signal_hash`, `miner_name`, full response body. The ledger is append-only; we never edit it. The agent’s own journals are next to it: `docs/evidence/agent-runs.jsonl` (one line per cycle) and `docs/evidence/agent-decisions.jsonl` (one line per site and hour). What is in it: see [What is in the ledger](#what-is-in-the-ledger).
- **Check a payment on-chain without trusting us** (read-only, free):

```
curl -s -X POST https://ethereum-sepolia-rpc.publicnode.com -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df"]}'
```

That transaction is the agent's own purchase from 2026-11-09 19:57 UTC: `status 0x1`, block 12099744, `to` = the test USDC contract. Explorer: https://sepolia.etherscan.io/tx/0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df

- **A payment from the deposit** (since 17 Nov 20:33 UTC). There is no Sepolia transaction per purchase: the node bills your deposit once per epoch (1 hour on the testnet), so the proof is the Telegraph receipt. Our first one: 17 Nov 2026 20:33 UTC, `CRYPTO_PRICE_USD`, provider Cp Coinbase, BTC $63,955.69, `receipt_hash` `0x77b1c580af7bb60af8516fb12b050d53c73161475cd3605fa75295f7421e96f0`, epoch 4 — the line with `"rail":"escrow"` in `docs/evidence/ledger.jsonl`. Where to open it: the receipt chip in the app (Place detail, Usage) links to the signal on the node, `https://devnode.telegraphprotocol.com/engine/v1/signal/<signal_hash>` — ours is [`/engine/v1/signal/0x2989e424eb868bcf3f752c2fc2992c9819f43c3dcaa90643634797836ed83ce3`](https://devnode.telegraphprotocol.com/engine/v1/signal/0x2989e424eb868bcf3f752c2fc2992c9819f43c3dcaa90643634797836ed83ce3) (opened 17 Nov 20:50 UTC: miner Cp Coinbase, intent `CRYPTO_PRICE_USD`, created 20:33:15 UTC). The charge itself is proven by the epoch block: [`/v1/blocks/4/deliveries/<receipt_hash>`](https://devnode.telegraphprotocol.com/v1/blocks/4/deliveries/0x77b1c580af7bb60af8516fb12b050d53c73161475cd3605fa75295f7421e96f0) (Telegraph docs, "Step 4: Read the Receipt") returns the delivery (payer, intent, 10000 micro-USDC) and a Merkle proof. It answers `404 no block recorded for this epoch` until that epoch's block is written — up to about an hour on the testnet; ours answered `200` at 20:50 UTC. The deposit itself is the Sepolia pair of transactions above.

- **Manual query** with the same client: `node scripts/telegraph.mjs query "What is the current price of Bitcoin (BTC) in USD?"` (pays $0.01, respects the limit, appends to the ledger; not re-run for this guide).

### What is in the ledger

The ledger snapshot has 366 lines up to 17 Nov 20:40 UTC. The first part, 127 requests all on 2026-11-09: **94 paid ($0.94)** and 33 unpaid with no settlement (1 × `400`, 18 × `402 payment required`, 14 × `504`). By origin: 8 manual probes 05:27–05:36 UTC (7 paid); 1 first live check at 05:39; **a burst of 107 requests 05:39:58–05:41:31** (75 paid and all 32 of the 402/504) — our first live build under parallel headless-browser screenshots, when concurrent page loads each started their own BTC-price purchase because that version had no shared in-flight request and its limit check did not count payments in flight, so spend went past the $0.50 limit set then; fixed at 05:41 (one shared snapshot, in-flight reservation), the file lock came later. The devnode rate limit (60 new questions per client per minute) was not what failed: there is no `429` in the ledger, and every request in the burst repeated the same question, which the node does not count; most `402`s (15 of 17) are settlements the facilitator could not complete ("payment was verified but could not be settled") while many payments from one wallet were in flight, and the `504`s are gateway timeouts. Since 2026-11-10 the client also refuses a 31st request within any minute (`src/lib/live/telegraph.ts`); then 11 single purchases (8 by the app during development, 3 by the hourly agent at 19:57, 20:04 and 20:19). Three more paid probes ran before the ledger existed and are in `docs/evidence/first-hashprice.json` and `docs/evidence/second-queries.json`. Agent runs and decisions (all days up to 17 Nov): `docs/evidence/agent-runs.jsonl`, `docs/evidence/agent-decisions.jsonl`. Whole snapshot (`docs/evidence/ledger.jsonl`, up to 17 Nov 20:40 UTC): 366 lines, **253 paid ($2.53 test USDC)** — 252 paid with x402 (each with a Sepolia transaction) and 1 paid from the deposit. The x402 ones are the 94 of 9 Nov plus 158 agent purchases from 10–17 Nov (7 / 24 / 23 / 24 / 24 / 24 / 24 / 8 per day, the last settled at 06:01 UTC on 17 Nov; `node scripts/recount.mjs 2026-11-17T21:00:00Z` reads only these `tx` rows, so it prints 252). The deposit one is the 20:33 UTC purchase of 17 Nov (`"rail":"escrow"`, no `tx`; count them with `grep -c '"rail":"escrow"' data/ledger.jsonl`). The other lines after 9 Nov are 402 challenges, the failed settlements of 17 Nov (07:01–20:22 UTC, see §7) and **three payments sent without an answer** (13 Nov 05:01, 17 Nov 02:01 and 12:53 UTC): they have `cost_usd` 0.01 and `status` 0 because our safety rule books a payment that left without an answer as spent, but they are not purchases and are not in the 253. Agent journals on 17 Nov 20:40 UTC: 271 cycles in `agent-runs.jsonl`, 813 site-hour rows in `agent-decisions.jsonl`.

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
- Payment from the Telegraph deposit (since 17 Nov 20:33 UTC): the hourly agent paid $0.01 from a 1 test USDC deposit (Sepolia transactions in §2) and received `200` with a Telegraph receipt (`receipt_hash`, epoch 4). One purchase so far in the snapshot above; the receipt link is explained in §4.
- x402 purchase from the Telegraph devnode, paid in test USDC on Sepolia, by the hourly agent without a browser: agent purchases are in the ledger next to earlier manual probes and development requests (94 paid requests in total on 2026-11-09, see [What is in the ledger](#what-is-in-the-ledger)), receipts checked on-chain (`status 0x1`).
- The daily limit stops purchases before payment (live runs with limits $0.50 and $0.01 while $0.92–0.93 was spent: 0 payments, all places paused; on 2026-11-10 `DAILY_SPEND_LIMIT_USD=0` on a clean copy with an empty ledger and no wallet key: 0 payments, all places paused; unit test `src/lib/live/telegraph.test.ts`).
- Telegraph unreachable → no call, banner and alerts, no payment.
- All screens in demo and live mode open without console errors (68 demo + 17 live automated browser checks, desktop and a 390 px phone viewport).
- `npm test` (154 tests in 15 files, run 2026-11-17 20:54 UTC), `npm run typecheck`, `npm run build` pass.
- Demo day (2026-11-12): `npm run demo:day` and the `/demo-day` screen show two changes of call on invented prices (Lease to AI → Mine → Lease to AI); desktop and a 390 px phone viewport, no console errors. This verifies the mechanism, not live behaviour.

**Network:** testnet only — Telegraph devnode + Ethereum Sepolia (test USDC). Nothing ran on mainnet.

**Not verified / not done:**
- Real money, mainnet, real customers: none. No operator has used the app yet; the sites in live mode are examples.
- Telegraph hashprice and ERCOT power intents returned empty numbers on the devnode, so hashprice is computed by us and power comes from Energy-Charts (Europe). US (ERCOT) sites work only in demo mode.
- AI lease rates are operator input; the Telegraph `WEB_SEARCH_GENERAL` "market guide" is bought once a day in live mode and shown with its receipt, but the devnode returns links, not rates, so it usually reads "No rate quoted in the search results" (never a made-up number).
- The Telegram bot runs as @hashorlease_bot. The owner's own `/start`, `/now` and `/demo` replies arrived on 17 Nov, and the agent's log shows 10 alerts sent 12–16 Nov without a send error; no outside person has used it (status of 17 Nov).
- **Live changes of call: two, no live call was ever Mine.** Both are at Silesia Farm on 15 Nov 2026 (08:00 and 13:00 UTC; recounted 17 Nov 20:00 UTC). Power ranged $99.96–495.45/MWh at Leipzig Hub and $14.52–664.25/MWh at Silesia Farm; mining revenue (Mine option plus power price) stayed at $50–74/MWh, so Mine never beat the other options. The agent logged both changes and one alert each (`notified: 1` in `runs.jsonl`); the log shows both sent to Telegram without a send error, but no second person has confirmed reading them. The Mine flip is demonstrated only on the demo day, with invented prices.
- **One outage on 17 Nov 2026, closed.** The agent made a call in 157 of 171 hourly slots from 10 Nov 18:00 UTC to 17 Nov 20:00 UTC (longest streak 112 hours). *What happened:* from 07:01 UTC the settlement step at the third-party x402 facilitator (`facilitator.x402.rs`) timed out — the payment was verified, then never settled; our signature and wallet were fine (the ledger has the failed requests with the reason, none charged). Every cycle paused all sites and paid nothing — the pause rule working — so 13 hourly slots (07:00–19:00 UTC) have no call. *What we did:* switched to Telegraph's second payment method, the deposit (§2), which does not use the facilitator; first successful purchase from it at 20:33 UTC, all sites decided again in the 20:00 slot. *Not tested:* whether the facilitator has recovered. *Also:* the pause alert in Telegram fired once (07:11 UTC); the agent now repeats it every 6 hours of an outage. Recount: `node scripts/recount.mjs <end-UTC>` (slots; x402 payments only).
- **Outside feedback: one acquaintance.** One comment from a person the author asked directly ([Discussions #1](https://github.com/Guryevmn/hashorlease/discussions/1), 17 Nov); two problems he found were fixed the same day. No independent users.
- The app has no login; the site API and "Refresh now" (throttled to once per 2 minutes, capped by the daily limit) are meant for a local or single-operator install, not a public deployment.
- History hours before the agent started are recomputed from past day-ahead prices with today's mining income; only hours tagged "Agent call" were decided live.
