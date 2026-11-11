# Hash or Lease — submission draft (NOT submitted)

> **Newer materials (2026-11-12):** the current application text, video script and demo plan are in [`docs/submission/`](submission/); where they differ from this file, they win.

For the owner: below are the English texts for the hackathon site form, in the order of rules section 8
("What to submit by December 1": https://hackathon.telegraphprotocol.com/rules, checked 2026-11-10), a screenshot list, the video script and demo risks.
Submission deadline: **1 December 2026, 23:59 UTC** (14 November is a progress check, not a deadline).
Nothing has been submitted or published. Fields in `[brackets]` are filled in by the owner. Before submitting, go through the "Needed from you" items at the end.

---

## 1. Project details

- **Project name:** Hash or Lease
- **Track:** Apps & Agents
- **Mission:** 12 — Mining and Power (example build 1, "The allocation agent")
- **Intents used:** `CRYPTO_PRICE_USD` (bought on every cycle); `MINING_HASHPRICE_VERIFY_GENERAL`, `GRID_POWER_PRICE_GENERAL` (probed, returned empty values on the devnode)
- **Team / contact:** `[name, email]`
- **Working or reviewer-access link:** `[public repo URL]` · `[hosted demo URL, if any]`
- **GitHub username that starred telegraphprotocol/bounties:** `[username]`
- **Network:** testnet only — Telegraph devnode + Ethereum Sepolia (test USDC)

## 2. One-liner and short description

**One-liner**

> Hash or Lease tells a Bitcoin miner, every hour and for every site, whether to mine, lease the power to AI, or switch off — in dollars per hour, with a receipt under every number.

**Short description (≤ 300 characters)**

> Hourly allocation agent for Bitcoin miners. For each site it calls Mine, Lease to AI or Switch off, shows the gain in $/h and the source of every input. It pays for its own market data through Telegraph (x402, testnet USDC) and stops at a daily spend limit.

## 3. Commercial summary (the five questions)

**Who is it for?**
Operators of Bitcoin mining sites who can also sell their power capacity to AI compute: site managers and energy desks at mining and hosting companies. A second, smaller user is a miner on a fixed tariff who only needs "mine or switch off".

**What does it improve?**
The mine-or-lease decision is made today in spreadsheets and phone calls and reviewed rarely. Hash or Lease makes it every hour, per site, and keeps the evidence: which number came from where, when, and what it cost. When a call turns out wrong, the operator can show what it was based on.

**What does it do today?**
On testnet it runs end to end: an hourly agent buys the BTC price through Telegraph by itself, combines it with public Bitcoin network data and day-ahead power prices for five European zones, and writes a call for every site with its receipts. A web app shows the call, the three options in $/MWh, the receipts, the hour-by-hour history and the spend. The agent stops before paying when the daily limit is reached, and makes no call when it has no fresh Telegraph receipt.

**Why would someone adopt it?**
The data for a whole fleet costs about $0.24 a day at testnet prices (one $0.01 purchase per hour covers every site), against decisions worth hundreds to thousands of dollars per hour on a multi-megawatt site. It needs no integration with the operator's hardware: you enter fleet size, power draw and the lease rate, and you get a call. No operator has used it yet — this is our reasoning, not customer evidence.

**How can someone try it?**
Clone the repo, `npm install`, `npm run build && npm start` — it opens in demo mode with invented data, no wallet and no network. `npm run agent -- --mode=mock --once` runs the agent once the same way. Live mode needs a throwaway Sepolia test wallet; steps are in `docs/JUDGE.md`.

## 4. Full description

**Problem.** Every megawatt a miner controls is a live choice between hashing, leasing the capacity to AI compute, and switching off when power is expensive. The inputs move on different clocks — hashprice with every block and BTC tick, power every hour, lease rates by contract — and the data behind the decision is bought ad hoc or not at all. The decision is rarely revisited and almost never auditable afterwards.

**What it does.**
- **One call per site per hour:** Mine / Lease to AI / Switch off, with the gain in $/h against "mine everything" and all three options in $/MWh.
- **"Keep as is" threshold:** if the best option beats the current one by less than a set margin (default $5/MWh), the call does not change, so equipment is not flapped on noise.
- **A source under every number:** a paid Telegraph answer shows service, provider, time, cost and the Sepolia payment; a free public source is labelled "Public source, not bought via Telegraph"; operator inputs are labelled "Your input".
- **Hourly agent without a browser** (`npm run agent`): buys data, decides for all sites, writes history to disk, sends Telegram alerts when a call changes.
- **No receipt, no call:** if Telegraph is unreachable or the spend limit is hit, the hour is recorded as "Paused" with the reason instead of a guess.
- **History the operator can argue with:** hour-by-hour calls; the operator marks what they actually did, and missed gain is counted only for marked hours.
- **Telegram bot** (grammY): change alerts, `/now`. *(Implemented and its messages are tested; not yet run against Telegram — no bot token.)*

**How it uses Telegraph.**
- The agent calls the Telegraph Engine (`POST /engine/v1/ask` on the devnode) and pays per request with **x402** in test USDC on **Ethereum Sepolia**. No human approves the payment: this is a machine-to-machine purchase.
- Each paid answer returns a provider name, a `signal_hash` and a settlement transaction. All three go into an append-only ledger and onto the screen next to the number they back.
- **What is bought today:** the BTC/USD price (`CRYPTO_PRICE_USD`), $0.01 per request. The hourly agent buys at most once per UTC hour for all sites (about $0.24/day); an open app reuses the same purchase for 30 minutes.
- **What we tried to buy and could not use:** `MINING_HASHPRICE_VERIFY_GENERAL` and `GRID_POWER_PRICE_GENERAL` for ERCOT hubs. On the devnode (2026-11-09) the payments settled and receipts came back, but the value fields were `null` / `missing`: our requests used the documented canonical form (`intent` + required `params`), and the auto-router sent them to miners that do not compute these values (mempool.space pool statistics for hashprice; a CAISO-only grid endpoint for ERCOT hubs). The raw answers are kept in the repo. So mining income is computed by us (144 blocks × average reward × Telegraph BTC price ÷ network hashrate from mempool.space), and power prices come from Energy-Charts. When those Intents return numbers, they plug into the same receipt model.
- **Spend safety around the purchase:** a daily limit checked before every payment and again under a file lock shared by the app and the agent (one payment at a time); a hard cap of $0.02 per payment; only the test USDC asset is allowed; a payment that left without an answer is booked as spent; the app cannot raise its own limit.

**Technical overview.**
- **Stack:** Next.js 16 / React 19 (web app and API routes), TypeScript run directly by Node 22.18+ for the agent and the bot, `@x402/fetch` + `@x402/evm` + viem for payments, grammY for Telegram, vitest for tests.
- **Shape:** the decision logic is a pure module with no network or clock; the agent cycle takes its dependencies from outside, so the same code runs on live data, on demo data and in tests. Screens talk to one `DataSource` interface with a demo and a live implementation.
- **Storage:** plain files on the operator's machine — the payment ledger, the shared market snapshot, live sites, agent decisions and runs. Sites and history marks in demo mode live in the browser.

**Network and what is verified (2026-11-09/10).** Testnet only: Telegraph devnode + Ethereum Sepolia (test USDC). The agent's own purchases settle on Sepolia (`status 0x1`); the daily limit blocks payment before it happens (also checked on a clean install with `DAILY_SPEND_LIMIT_USD=0` and by a unit test); Telegraph-unreachable and provider-down cases pause the call instead of guessing; 77 automated tests, typecheck and production build pass; all screens were checked for console errors in demo and live mode (automated browser checks, 2026-11-09). The ledger holds 94 paid requests from 2026-11-09, most of them from development — the breakdown is in `docs/JUDGE.md` ("What is in the ledger").

**Limitations (honest list).**
- **Testnet only.** No real money, no mainnet transactions, no customers. No operator has used it; the live sites are examples.
- **One input is bought through Telegraph** (BTC price). Hashprice is computed by us; power prices are free public European day-ahead data (Energy-Charts), not ERCOT. US sites run on demo data only.
- **The AI lease rate is typed in by the operator.** The `WEB_SEARCH` market guide exists only in demo mode; there is no market comparison in live mode yet.
- **The agent has run single cycles on one evening (2026-11-09), not for days** `[update after a multi-day run]`.
- **History before the agent started** is recomputed from past power prices with today's hashprice; only hours tagged "Agent call" were decided live.
- **No login.** Built for one operator on their own machine, not for a public server.
- **Telegram bot** is implemented and its messages are tested, but it has not been run against Telegram `[update after the first real run]`.

**What is next.**
1. Buy more of the decision through Telegraph: lease-rate comparables via `WEB_SEARCH`; power prices via `GRID_POWER_PRICE` as soon as a node returns values (CAISO is the next probe); hashprice via `MINING_HASHPRICE_VERIFY` when its fields are populated. The receipt model on screen already supports all three.
2. A US site on live data — the mission's buyers are US operators.
3. Put it in front of 3–5 miners and hosting operators and record what they do with the calls.
4. Login and server-side history, so it can run as a hosted service.
5. Curtailment payments in the "Switch off" option (the decision engine already accepts the value; the form does not yet).

**Data sources.** Telegraph Engine devnode (`CRYPTO_PRICE_USD`, paid via x402) · mempool.space (hashrate, block rewards, EUR/USD) · Energy-Charts / Bundesnetzagentur SMARD (day-ahead power prices, DE-LU, FR, PL, AT, NL) · operator inputs (fleet, lease rate, overhead, tariff).

**Reused components.** Next.js, React, viem, `@x402/fetch` / `@x402/evm` (x402 client), grammY, lucide-react icons, vitest. All product code written during Season II.

## 5. How to run it

> Full reviewer guide: `docs/JUDGE.md` — run from scratch, try a new site, inspect the real request and payment, break it, reproduce.
>
> - **Prerequisites:** Node.js 22.18+. No wallet needed for demo mode.
> - **Run:** `npm install` → `npm run build && npm start` → http://localhost:3000 (demo mode, yellow "Demo data" strip). Agent once: `npm run agent -- --mode=mock --once`.
> - **Live mode (testnet):** `node scripts/create-wallet.mjs` → fund the address with Sepolia ETH and test USDC → `.env`: `NEXT_PUBLIC_DATA_MODE=live`, `DAILY_SPEND_LIMIT_USD=0.50`.
> - **Sample request:** Add place → France, 500 PH/s, 10 MW, 20 J/TH; or `POST /api/live/sites` (curl in `docs/JUDGE.md` §3). **Expected result:** a call with three options in $/MWh and a receipt under each input.
> - **Network:** Telegraph devnode + Ethereum Sepolia, test USDC.
> - **Costs and limits:** $0.01 test USDC per Telegraph request, about $0.24/day for the hourly agent; daily limit `DAILY_SPEND_LIMIT_USD` (default $0.50), $0.02 cap per payment.
> - **Failure cases without spending:** `DAILY_SPEND_LIMIT_USD=0 npm run agent -- --mode=live --once --fresh` (limit), unreachable Telegraph, provider down, invalid input — `docs/JUDGE.md` §5.
> - **Known limitations:** see the list above.

## 6. Evidence

- Payment ledger: `docs/evidence/ledger.jsonl` (copy of `data/ledger.jsonl`) — one line per request: intent, status, cost, tx, signal_hash, provider, full answer. 127 requests on 2026-11-09, 94 paid; breakdown in `docs/JUDGE.md` ("What is in the ledger").
- Example agent purchase: Sepolia tx `0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df` (2026-11-09 19:57 UTC), one-command check in `docs/JUDGE.md` §4.
- Agent runs and decisions with receipts: `docs/evidence/agent-runs.jsonl`, `docs/evidence/agent-decisions.jsonl` (copies of `data/agent/live/`).
- Raw answers of the mission Intents that returned empty values: `docs/evidence/first-hashprice.json`, `docs/evidence/second-queries.json`.
- Tests: `npm test` (79 tests: decision logic, agent cycle, bot messages, site storage, spend limit, request rate).
- Screenshots: `docs/shots/sites.png`, `docs/shots/site-detail-receipt.png`.

**Evidence map (for us, not part of the form):**

| Claim | Where to check |
|---|---|
| x402 client, Engine address | `src/lib/live/telegraph.ts:4-5,153-161` |
| Test USDC only, $0.02 cap | `src/lib/live/telegraph.ts:10,78` |
| Limit checked before payment and under a lock | `src/lib/live/telegraph.ts:126,132`; test `src/lib/live/telegraph.test.ts` |
| Payment without a response counts as spent | `src/lib/live/telegraph.ts:163-177` |
| BTC price is the paid input | `src/lib/live/market.ts:61-70` |
| Hashprice formula | `src/lib/live/market.ts:56-59` |
| Electricity from Energy-Charts, 5 zones | `src/lib/live/market.ts:88-91`, `src/lib/live/catalog.ts:6-12` |
| Agent buys at most once per UTC hour | `src/lib/live/market.ts` (`getFreshSnapshot`) |
| $5 threshold, formulas, curtailment field | `src/lib/decision.ts:6,100-109` |
| No receipt, no call | `src/lib/agent/cycle.ts:77-86` |
| Three successful agent cycles on 9 Nov | `docs/evidence/agent-runs.jsonl` (lines 1, 5, 10) |
| Empty values for the mission Intents | `docs/evidence/second-queries.json`, `docs/PLAN.md:47-51` |

## 7. Short public summary

> **Hash or Lease** (Mission 12, Mining and Power) is an hourly allocation agent for Bitcoin miners: per site it calls Mine, Lease to AI or Switch off and shows where every input came from. It buys the BTC price through Telegraph with x402 on testnet, stops at a daily spend limit, and refuses to make a call without a fresh receipt. Hashprice and power still come from public sources, because those Intents returned empty values on the devnode — details and raw answers are in the repo. Try it in five minutes with no wallet: `[repo URL]`. Reviewer guide: `docs/JUDGE.md`. Feedback from anyone running a mining site is very welcome: `[contact]`.
>
> Updates: `[link 1, date]` · `[link 2, date]` · `[link 3, date]` · Demo video: `[link]`

## 8. Showcase permission `[owner's decision]`

- May be shared publicly: `[text / screenshots / video / tutorial — choose]`
- Buyer introductions: `[yes / no]`

## 9. Screenshots for the submission

Ready (live mode, 9 Nov):
- [x] `docs/shots/sites.png` — site list: call, $/h, receipt next to the numbers.
- [x] `docs/shots/site-detail-receipt.png` — a site with an expanded Telegraph receipt and a link to the payment on Sepolia.

To capture before submitting (`npm start`, 1280×900 window):
- [ ] Usage — the limit, the "Hourly agent" card, the table of paid requests with links.
- [ ] History — hours tagged "Agent call" and the "Followed / Did something else / Skip" buttons.
- [ ] Add place — the input error "2 J/TH is below any known miner".
- [ ] The "Can't reach Telegraph" banner (scenario from JUDGE.md §5).
- [ ] Terminal with the agent log (`npm run agent -- --once`).
- [ ] The transaction page on sepolia.etherscan.io.
- [ ] Telegram: a call-change alert and `/now` — after the bot token is connected.

## 10. Demo video, 2–3 minutes

Voiceover in English, short. The Screen column shows what is on screen. The rules ask for 2–5 minutes in this order: problem → Telegraph request → data and provider → request price → result → how to try it.

| Time | Screen | Voiceover |
|---|---|---|
| 0:00–0:15 | Places (live mode) | "Miners decide every hour: mine, lease the power to AI, or switch off. Hash or Lease makes that call for every site, with a receipt under every number." |
| 0:15–0:40 | Leipzig Hub → "Where the numbers come from" block | "Leipzig: power is $420 a megawatt-hour tonight, mining earns $73, so leasing wins by about $9,000 an hour. Here is the formula, input by input." |
| 0:40–1:05 | Tap the ✓ next to Mining revenue → "View payment on Sepolia" | "This number is backed by a Telegraph purchase: provider, time, one cent in test USDC, and the settlement on Sepolia. The power price is marked as a free public source — we don't pretend it came from Telegraph." |
| 1:05–1:30 | Terminal: `npm run agent -- --once` → Usage, agent card | "The agent runs every hour without a browser. It buys its own data through Telegraph with x402 and writes every decision with its receipts." |
| 1:30–1:55 | Terminal: `DAILY_SPEND_LIMIT_USD=0 npm run agent -- --mode=live --once --fresh` → History, "Paused · daily limit" hours | "Spend is capped. Hit the daily limit and it stops before paying — no receipt, no call." |
| 1:55–2:15 | Add place: France, 500 PH/s, 10 MW → new site; then 2 J/TH → error | "Adding a site takes a minute. Bad input is caught next to the field." |
| 2:15–2:35 | History, mark an hour "Did something else" | "History shows what following the advice was worth — counted only for hours the operator marks." |
| 2:35–2:50 | "Testnet · no real money" header, JUDGE.md | "Everything runs on testnet: Telegraph devnode and Sepolia. Reviewer steps are in docs/JUDGE.md." |

Before recording: run one normal agent cycle (`npm run agent -- --once`) so History has fresh "Agent call" hours.
The numbers in the 0:15 line are from the evening of 9 Nov; on recording day they will differ: the narrator reads what is on screen.

## 11. Demo risks and fallback plan

Recommendation: record scene by scene and use the finished recording for the demo — a live demo depends on three third-party services at once.

| Risk | What to do |
|---|---|
| x402 payment is slow (agent cycles on 9 Nov took 17–23 s) | Cut the wait in the recording; live, keep talking through the scene while the cycle runs. |
| The Telegraph node is unreachable or returns 504 (there were 14 504 responses on 9 Nov) | Do not fix it on camera: show the "Can't reach Telegraph" banner as the "no receipt, no call" rule, then switch to the recording. |
| Energy-Charts rate-limited requests | The app uses the last saved price series; if a site is still "Paused", show a site on its own tariff. |
| Limit used up by trial runs | Set the limit with headroom in the morning; every `--fresh` and "Refresh now" costs one cent. |
| Limit scene | Only with `DAILY_SPEND_LIMIT_USD=0`. Fallback shot: `npm run agent -- --mode=mock --once --state=limit` — the same picture on made-up data; say so out loud. |
| A power price of $400+ per MWh looks suspicious | It is a real evening peak (checked against Energy-Charts, `docs/JUDGE.md` §2); say "tonight power is at an evening peak". |
| A secret got into the frame | Do not open `.env`; keep the terminal clean; review the recording before publishing. |
| The network is gone entirely | Demo mode without network with the "Demo data" badge, states `?state=error`, `?state=limit`; say plainly that the data is made up. |

## 12. Short summary for the owner

**One line:** every hour, for every site — mine, lease the power to AI or switch off, in dollars per hour, with a source under every number.
**Telegraph:** the agent pays for the BTC price itself (x402, test USDC on Sepolia, $0.01 per request, about $0.24 a day). We tried to buy hashprice and ERCOT prices — the payment went through but the values were empty; so we compute hashprice ourselves and take electricity from an open European source.
**Spend safety:** daily limit checked before payment, one payment at a time, $0.02 cap, test coin only.
**Limitations:** testnet only, no users, one number is bought through Telegraph, the lease rate is entered by the operator, the agent has run only in single cycles, the bot has not been run in real Telegram.

## 13. Needed from you before submitting

- [ ] Contact, links to the code and demo, GitHub username (fields in `[brackets]`).
- [ ] Star on github.com/telegraphprotocol/bounties — handled by another session.
- [ ] First git commit and publishing the code (judges need access to the code) — your decision.
- [ ] Telegram bot token (create with @BotFather, put in `.env` as `HASHORLEASE_BOT_TOKEN`) — if we want to show the bot.
- [ ] Decide where to show the demo: locally on your machine or hosted online (hosting only with your "yes").
- [ ] Record the video (or assign a session to record it) and give a "yes" to publish.
- [ ] Links to public progress updates and showcase permissions (section 8).
- [ ] Submitting the form — yourself or with your "yes".
