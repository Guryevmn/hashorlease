# Hash or Lease — application text

> **Резюме для владельца (по-русски).** Это готовый текст заявки на английском: сначала поля в том порядке, в каком их просит сайт хакатона (раздел 8 правил), затем полный рассказ о продукте. Все цифры проверены 11–12 ноября по коду и журналам; в конце — таблица «что обновить в день подачи» и список того, что в заявке честно названо слабым местом.
> Обновление 17.11: добавлены первый отзыв знакомого тестера и два исправленных после него бага, новый логотип и дизайн, приветствие бота, обе реальные смены решения 15.11 и **сбой оплаты 17.11 07:00–20:33 UTC — закрыт** (расчётный сервис x402 не проводил платежи; с 20:33 UTC агент платит с депозита Telegraph; числа пересчитаны по журналу).
> Добавлено позже 17.11: в разделе A3 — три гипотезы модели дохода (подписка на площадку, процент от выгоды, оплата по факту запросов), помечены «не проверено с клиентами»; цена привязана только к реальной стоимости данных ($0,24 в сутки на парк). Строки «кто поддерживает» не тронуты.
> Правка по ревью жюри (17.11, поздно вечером): везде «оплата — x402 или депозит Telegraph», чек = Sepolia-транзакция (x402) или `receipt_hash` со ссылкой на signal (депозит); сбой 17.11 описан как закрытый (13 пропущенных часовых слотов); почасовое решение названо «майнить или выключить», аренда под ИИ — гипотеза/ориентир; цифра «$2 800–10 700» заменена живым примером 15.11 13:00 UTC; 154 теста в 15 файлах; подпись площадки с фиксированным тарифом. Цена подписки в тексте: `[цена — решает Михаил]`.
> Внимание: после этой правки в main влит ежедневный платный запрос `WEB_SEARCH_GENERAL` («подсказка по ставкам аренды», ветка web-search-live; $0,01 в сутки, итог обычно «ставка не названа»). Фразы «покупается только цена BTC» в A1, B5, B7 надо обновить отдельной правкой, когда решишь, считать ли это вторым Intent'ом.
> Ничего не отправлено. Поля в `[квадратных скобках]` заполняешь ты. Саму форму на сайте видно только после входа, поэтому порядок полей взят из правил, а не с экрана формы.

Status: draft, **not submitted**. Refreshed 2026-11-17: agent and ledger numbers recounted at 17 Nov 20:40 UTC, last full hourly slot 20:00 (`node scripts/recount.mjs 2026-11-17T21:00:00Z` for the slots; it counts only x402 payments with a Sepolia transaction — the one payment from the deposit is counted by `"rail":"escrow"`, see `docs/JUDGE.md` §4); product, tester and bot facts as of 17 Nov. Supersedes sections 1–8 of `docs/SUBMISSION.md`.
Rules checked on 2026-11-12: https://hackathon.telegraphprotocol.com/rules (sections 3, 5, 6, 8, 9). The rules set no word limits; the only instruction is "keep the answers short" for the five commercial questions.

---

## Part A — Form fields, in the order of rules §8

### A1. Project details

| Field | Value |
|---|---|
| Project name | Hash or Lease |
| Track | Apps & Agents |
| Mission | 12 — Mining and Power (example build 01, "The allocation agent") |
| Intents | Bought every hour: `CRYPTO_PRICE_USD`. Probed, paid, returned empty values on the devnode: `MINING_HASHPRICE_VERIFY_GENERAL`, `GRID_POWER_PRICE_GENERAL` |
| Working / reviewer-access link | https://github.com/Guryevmn/hashorlease · reviewer guide: `docs/JUDGE.md` · hosted demo: https://hashorlease.vercel.app (invented data, marked on screen) |
| GitHub username that starred `telegraphprotocol/bounties` | `Guryevmn` |
| Team / contact | Mikhail Guryev — product designer, [guryev.design](https://guryev.design), GitHub [@Guryevmn](https://github.com/Guryevmn); contact via GitHub Discussions #1 |
| Network | Testnet only: Telegraph devnode + Ethereum Sepolia (test USDC) |

### A2. One-liner and short description

**One-liner**

> Every hour, for every mining site: mine or switch off — in dollars per hour, with an AI-lease rate as the benchmark and a receipt under every number.

**Short description (299 characters)**

> Hourly agent for Bitcoin miners: per site it calls Mine or Switch off, in $/h, with an AI-lease rate as benchmark and a source for every input. It pays for its own data through Telegraph (x402 or a prepaid deposit, test USDC), stops at a daily spend limit, and makes no call without a fresh receipt.

### A3. The five commercial questions (short answers)

**Who is it for?**
Operators of Bitcoin mining sites who can also sell their power capacity to AI compute — the site managers and energy desks at mining and hosting companies that Mission 12 describes. A second, smaller user is a miner on a fixed tariff who only needs "mine or switch off".

**What does it improve?**
Mine-or-lease is decided today in spreadsheets and phone calls and revisited rarely. Hash or Lease makes the call every hour, per site, in dollars — and keeps the evidence for each one: which number came from where, when, and what it cost. When a call turns out wrong, the operator can show exactly what it was based on.

**What does it do today?**
On testnet it runs end to end. An hourly agent buys the BTC price through Telegraph by itself (per request, with x402 or from a prepaid Telegraph deposit; test USDC on Sepolia), combines it with public Bitcoin network data and day-ahead power prices for five European zones, and records a call for every site with its receipts. A web app shows the call, the three options in $/MWh, the receipts, the hour-by-hour history and the spend. The agent has run since 10 November 18:00 UTC for about one cent an hour: 157 of 171 hourly slots had a call by 17 November 20:00 UTC, the longest unbroken streak is 112 hours. One outage, now closed: from 07:00 to 20:33 UTC on 17 November the x402 facilitator's settlement step timed out, the agent paused all sites by its own rule and paid nothing (13 hourly slots without a call); since 20:33 UTC it pays from a Telegraph deposit — see B6. It stops before paying when the daily limit is reached, and it makes no call when it has no fresh Telegraph receipt. A Telegram bot (@hashorlease_bot) greets a new subscriber with the current call for every site and two buttons.

**Why would someone adopt it?**
The data for a whole fleet costs about $0.24 a day at testnet prices — one $0.01 purchase per hour covers every site. A live example: on 15 Nov 2026 at 13:00 UTC Silesia Farm (12 MW) faced a day-ahead power price of $169.43/MWh; mining would have lost $116.53/MWh there, about $1,398 for that single hour, and the agent switched the site off (the figure is against an operator who does not watch prices; against the next-best option, leasing at the rate we assumed, switching off was better by $107.43/MWh, about $1,289 for the hour). The problem comes back every hour: day-ahead prices are published daily and change every hour — at Silesia Farm over the week of the run they ranged from $14.52 to $664.25/MWh, moved in every one of 154 consecutive-hour steps and by $50/MWh or more in 33 of them (largest step $284/MWh), so the decision has to be made every hour. The hourly decision is **Mine or Switch off**. "Lease to AI" is a hypothesis about interruptible AI load (workloads that can be paused when power is expensive) or a benchmark — the rate at which a lease contract would beat mining at today's prices; a long lease contract is not switched hour by hour. It needs no integration with the operator's hardware: enter fleet size, power draw and lease rate, get a call. No operator has used it yet; this is our reasoning, not customer evidence.

**How could it make money? (hypotheses — not tested with any customer)**
We have not asked any operator what they would pay, so these are three possible models, not a plan with prices. The only real cost figure we have is the data: the agent buys one $0.01 request per hour for the whole fleet, 24 × $0.01 = $0.24 a day, about $7.20 a month, at testnet prices (the mainnet price of the same request is not known to us).
1. *Subscription per site.* A flat monthly fee per site. **Price: `[цена — решает Михаил]`.** *Hypothesis; no price tested.* The only anchor we have: one avoided loss like 15 Nov 13:00 UTC at Silesia Farm (≈$1,398 for that hour) would cover a subscription many times over if such an hour is caught once a month — an assumption, not a measured result. Simple to explain and to bill; it does not depend on how much the call earns.
2. *Share of the measured gain.* A small percentage of the "gain vs mining" the app shows in $/h. *Hypothesis, and the weakest of the three today:* the gain rests on the AI lease rate the operator types in himself, so it cannot be audited yet; it would need a baseline the operator agrees to.
3. *Usage-based: pass the receipts through.* Bill the actual cost of each paid Telegraph request (already recorded in the ledger with its Sepolia transaction or Telegraph receipt) plus a fixed fee per call. *Hypothesis.* Fits the pay-per-request model that x402 is built for and scales with the number of sites and inputs bought.
What we would learn first from the 3–5 operator conversations planned in B8: which of the three they accept, and whether they trust the lease-rate input enough to be billed on it.

**How can someone try it?**
`git clone https://github.com/Guryevmn/hashorlease.git`, `npm install`, `npm run build && npm start` — it opens in demo mode with invented data, no wallet, no network. `npm run agent -- --mode=mock --once` runs the agent once the same way. Live mode needs a throwaway Sepolia test wallet; the steps are in `docs/JUDGE.md`. Maintained by Mikhail Guryev ([guryev.design](https://guryev.design), GitHub [@Guryevmn](https://github.com/Guryevmn)); issues and questions go to GitHub Discussions #1 and Issues of the repository.

### A4. Short demo

`[video link]` — 2–5 minutes (rules §8). Script: `docs/submission/video-script.md`.

### A5. How to run it

> Full reviewer guide: `docs/JUDGE.md` — run from scratch, try a new site, inspect the real request and payment, break it, reproduce.
>
> - **Prerequisites:** Node.js 22.18+. No wallet is needed for demo mode.
> - **Run:** `npm install` → `npm run build && npm start` → http://localhost:3000 (demo mode, yellow "Demo data" strip). Agent, one cycle: `npm run agent -- --mode=mock --once`.
> - **Configuration for live mode (testnet):** `node scripts/create-wallet.mjs` creates a throwaway key in `.env` → fund the printed address with a little Sepolia ETH and test USDC → optionally deposit test USDC into Telegraph escrow (`docs/JUDGE.md` §2; `TELEGRAPH_PAY_RAIL=auto` pays from the deposit first and falls back to x402) → set `NEXT_PUBLIC_DATA_MODE=live` and `DAILY_SPEND_LIMIT_USD=0.50`.
> - **Sample request:** Places → Add place → France, 500 PH/s, 10 MW, 20 J/TH. Or `POST /api/live/sites` (curl in `docs/JUDGE.md` §3).
> - **Expected result:** a call for the new site — Mine, Lease to AI or Switch off — with three options in $/MWh and a source under each input.
> - **Network:** Telegraph devnode + Ethereum Sepolia, test USDC. Nothing runs on mainnet.
> - **Costs and limits:** $0.01 test USDC per Telegraph request, about $0.24/day for the hourly agent. Daily limit `DAILY_SPEND_LIMIT_USD` (default $0.50), hard cap $0.02 per payment, test USDC only.
> - **Failure cases, none of which spends money:** daily limit (`DAILY_SPEND_LIMIT_USD=0 npm run agent -- --mode=live --once --fresh`), Telegraph unreachable, one price provider down, invalid input, unsupported zone — `docs/JUDGE.md` §5.
> - **Known limitations:** see B7 below; the same list is in `README.md`.

### A6. Evidence

- **Payment ledger** — `docs/evidence/ledger.jsonl`: one line per request with intent, status, cost, proof (Sepolia transaction for x402; `receipt_hash`, `rail`, `epoch_id` for a payment from the deposit), `signal_hash`, provider and the full answer. Append-only, never edited. Snapshot of 17 Nov 2026 up to 20:40 UTC (366 lines, 253 of them paid — 252 x402 with a Sepolia transaction and 1 from the deposit; the rest are 402 challenges, the failed settlements of 17 Nov and 3 payments sent without an answer). `[refresh the copy before submitting — see "Numbers to refresh"]`
- **Purchased intelligence and outcome** — the agent buys `CRYPTO_PRICE_USD` (BTC/USD); the outcome is one allocation call per site per hour: `docs/evidence/agent-decisions.jsonl` (snapshot of 17 Nov 2026 up to 20:40 UTC; it contains both 15 Nov changes of call, marked `"changed": true`), with the receipt attached to every call. Cycle summaries, including the 17 Nov pauses: `docs/evidence/agent-runs.jsonl`.
- **A payment anyone can check** — Sepolia tx `0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df`, the agent's own purchase on 2026-11-09 19:57 UTC. One-command check without trusting us: `docs/JUDGE.md` §4. The deposit that paid for data after the 17 Nov outage: approve [`0x73b3…e9e4`](https://sepolia.etherscan.io/tx/0x73b3895b46b0307f78e1b86f66e697aae7b1efe5a4fe468e9934ee4cfbe9e174) and deposit of 1 test USDC [`0xba1d…0e93`](https://sepolia.etherscan.io/tx/0xba1da5f10e2cda2c315e31c36e4c353092c340f85bbec91e57dd74ade3ab0e93) on Sepolia (17 Nov 20:22 UTC); the first purchase paid from it carries the Telegraph receipt `0x77b1…96f0` (§4 of the guide).
- **Raw answers of the mission Intents that came back empty** — `docs/evidence/first-hashprice.json`, `docs/evidence/second-queries.json`.
- **Tests** — `npm test`: 154 tests in 15 files (decision logic, agent cycle, demo day, bot messages, site form, site storage, spend limit, request rate), run 17 Nov 2026. `npm run typecheck` passes (run 17 Nov 2026).
- **Screens** — `docs/shots/sites.png`, `docs/shots/site-detail-receipt.png` (live mode, 9 Nov, before the redesign — `[replace with current screens before submitting]`). Before/after pairs of the design work are in `docs/design/`.
- **Tester feedback** — GitHub Discussions #1, https://github.com/Guryevmn/hashorlease/discussions/1: one comment (17 Nov) from `scottlaren`, a personal acquaintance of the author — **not an independent user**. See B6.

### A7. Short public summary

> **Hash or Lease** (Mission 12, Mining and Power) is an hourly allocation agent for Bitcoin miners. For every site it calls Mine, Lease to AI or Switch off, in dollars per hour, and shows where each input came from. The agent buys the BTC price through Telegraph on testnet (x402 or a prepaid deposit), stops at a daily spend limit, and refuses to make a call without a fresh receipt. Hashprice and power prices still come from public sources, because those Intents returned empty values on the devnode — the raw answers are in the repo. Try it in five minutes with no wallet: https://github.com/Guryevmn/hashorlease. Reviewer guide: `docs/JUDGE.md`. If you run a mining site, we would like to hear what the call gets wrong: `[contact]`.
>
> Updates: `[link 1, date]` · `[link 2, date]` · `[link 3, date]` · Tutorial: `[link]` · Demo video: `[link]` · Independent testing: `[links, if any]`

### A8. Showcase permission `[owner's decision]`

- May be shared publicly: `[text / screenshots / video / tutorial — choose]`
- Buyer introductions: `[yes / no]`

The rules say these choices do not affect technical scores.

---

## Part B — Full description

### B1. Problem

Every megawatt a Bitcoin miner controls is a live choice between three uses: hash with it, lease the capacity to AI compute, or switch off while power is expensive. The inputs move on different clocks — mining revenue with every block and every BTC tick, power every hour, lease rates by contract — but the decision is made in spreadsheets and phone calls and reviewed monthly.

Two things go wrong. The decision is slow: a decision reviewed monthly (the mission's own description) runs straight through hours when power costs several times what the hash earns. And it is unaccountable: when an allocation turns out wrong, nobody can reconstruct which numbers it rested on, where they came from, or whether they were fresh.

### B2. Solution

Hash or Lease answers one question per site per hour — **Mine, Lease to AI, or Switch off?** — and shows its work.

- **One call, in dollars.** The call, the gain in $/h against mining everything, and all three options in $/MWh side by side.
- **A source under every number.** A number bought through Telegraph carries its receipt: service, provider, time, cost, and the proof — the Sepolia settlement transaction when paid with x402, or the Telegraph `receipt_hash` with a link to the signal when paid from the deposit. A number from a free public source is labelled "Public source, not bought via Telegraph". A number the operator typed is labelled "Your input". Nothing is presented as more verified than it is.
- **No receipt, no call.** If the agent cannot get a fresh Telegraph receipt — the network is down, or the spend limit is reached — the hour is recorded as "Paused" with the reason. It does not guess.
- **An agent, not a dashboard.** The hourly agent runs without a browser, pays for its own data, decides for every site, writes the history to disk and sends a Telegram alert when a call changes.

### B3. Who it is for

**Primary:** site managers and energy desks at Bitcoin mining and hosting companies that can redirect power to AI compute — the buyers Mission 12 names. The larger the site, the more an hour on the wrong allocation costs, and the more it matters to be able to audit a call afterwards.

**Secondary:** a small miner on a fixed tariff. There is no lease option, only "mine or switch off"; the power price is the operator's own input and is labelled as such.

No operator has used the product yet. The three sites in live mode are examples we configured.

### B4. How it works

**Every hour, at hh:01 UTC, the agent:**

1. **Gathers the free inputs first** — network hashrate and block rewards from mempool.space, day-ahead power prices from Energy-Charts. Nothing is paid for until these are in hand.
2. **Checks the budget** — today's spend in the ledger against the daily limit, under a file lock shared with the web app, so only one payment can be in flight.
3. **Buys the BTC price through Telegraph** — `POST /engine/v1/ask` on the devnode, $0.01 in test USDC on Ethereum Sepolia, paid per request in one of Telegraph's two ways: **x402** (a settlement transaction on Sepolia per request) or **from a prepaid deposit** (escrow: signed per request, no transaction per request; the node bills the balance once per epoch). `TELEGRAPH_PAY_RAIL=auto` (default) pays from the deposit first and falls back to x402 when the deposit is empty. No human approves the payment: this is a machine-to-machine purchase. The answer comes back with the provider's name, a `signal_hash` and a receipt: the settlement transaction (x402) or the `receipt_hash` (deposit).
4. **Computes each site's three options, per MWh:**
   - *Mine* = mining revenue − power price, where mining revenue = hashprice × the site's PH/s per MW ÷ 24 and hashprice = 144 blocks × average block reward × BTC price ÷ network hashrate;
   - *Lease to AI* = contract rate − power price − overhead (power is not subtracted when the rate already includes it);
   - *Switch off* = 0.
5. **Picks the best — unless the difference is noise.** If the best option beats the current one by less than a threshold (default $5/MWh), the call is "Keep as is", so equipment is not switched back and forth on small moves.
6. **Records the call with its receipts** in an append-only log, and sends a Telegram alert if the call changed.

One purchase covers every site and is reused for 30 minutes by the app and the agent, so the cost does not grow with the fleet: about $0.24 a day.

**Spend safety around the purchase.** The daily limit is checked before every payment and again under the lock. Each payment is capped at $0.02 and only the test USDC asset is accepted. A payment that left without an answer is booked as spent. At most 30 requests a minute leave the client. The limit cannot be raised from the app.

**What the operator sees.** *Places* — every site's call for the current hour and the total gain. *Place detail* — the three options, the formula with the actual numbers, and the receipt under each input. *History* — hour-by-hour calls; the operator marks what they actually did, and missed gain is counted only for the hours they marked. *Usage* — spend against the limit, every paid request with a link to its payment, the agent's last run.

**Where each number comes from today.**

| Input | Source | Bought through Telegraph? |
|---|---|---|
| BTC price | Telegraph `CRYPTO_PRICE_USD` | Yes — $0.01 test USDC; receipt = Sepolia transaction (x402) or `receipt_hash` with a signal link (deposit) |
| Network hashrate, block rewards, EUR/USD | mempool.space | No — free public source |
| Hashprice ($/PH/day) | computed by us from the three numbers above | Partly — its BTC price input is the purchased one |
| Power price, current hour | Energy-Charts day-ahead: DE-LU, FR, PL, AT, NL | No — free public source, labelled on screen |
| AI lease rate, overhead, fixed tariff | entered by the operator | No — "Your input" |

**Why hashprice and power are not bought through Telegraph.** We tried. On 2026-11-09 we sent paid requests to `MINING_HASHPRICE_VERIFY_GENERAL` and to `GRID_POWER_PRICE_GENERAL` for the ERCOT hubs `HB_HOUSTON` and `HB_WEST`, in the documented form (`intent` + required `params`). The payments settled and receipts came back, but the value fields were `null` / `missing`: the router sent the hashprice request to a miner that returns pool statistics, and the ERCOT requests to a grid miner that covers CAISO. The raw answers are in the repo. So the app computes hashprice itself and takes power prices from Energy-Charts — which means European zones, not ERCOT. When these Intents return values, they plug into the receipt model that is already on screen.

### B5. What is different

- **A call, not a chart.** Hashprice indexes and profitability calculators show an input. Hash or Lease shows the decision for a specific site this hour, in dollars, next to the two alternatives it rejected.
- **Provenance per number, including the unflattering part.** Each input is labelled as bought through Telegraph, public, or typed in. Only one of them is bought today, and the screen says so.
- **It refuses to guess.** Without a fresh receipt there is no call — the hour is logged as a pause with its reason. On 11 November at 21:00 UTC this happened unprompted: Telegraph returned no fresh receipt, the agent paused all three sites, paid nothing, and logged why.
- **The buyer is a program with a budget.** The agent pays per request with no human in the loop, under a daily limit it cannot raise, with a hard cap per payment.
- **Built to be argued with.** History does not assume the operator obeyed. It counts missed gain only for hours the operator marked, and never for "Keep as is" hours.
- **A direct build of the mission's first example** — "an hourly allocation call per site … with every input receipted and timestamped" — with an exact account of which parts of that sentence the devnode could and could not support in November 2026.

### B6. Evidence (testnet; journal facts recounted 2026-11-17 20:40 UTC)

- **Autonomous purchases.** 253 paid Telegraph requests, $2.53 in test USDC (recounted 17 Nov 20:40 UTC): 252 with a Sepolia settlement (x402) and 1 paid from the Telegraph deposit (17 Nov 20:33 UTC, proof = receipt, no transaction of its own). By day, x402: 94 on 9 November (mostly development, including a burst caused by a bug we then fixed — explained line by line in `docs/JUDGE.md`, "What is in the ledger"), 7 on 10 November, 24 on 11 November, 23 on 12 November, 24 on 13 November, 24 on 14 November, 24 on 15 November, 24 on 16 November, 8 on 17 November (the last settled at 06:01 UTC); plus the one from the deposit on 17 November. Every request since 10 November was made by the agent (the hourly cycle, its ten-minute retry, or one restart run). Three further ledger lines (13 Nov 05:01, 17 Nov 02:01 and 12:53 UTC) are payments sent without an answer; our safety rule books them as spent, they are not counted as paid.
- **Continuous operation.** From 10 November 18:00 UTC to 17 November 20:00 UTC the agent made a call for every site in 157 of 171 hourly slots. Two interruptions: 14:00 UTC on 12 November (one slot, coincided with a restart of the host Mac, inferred from indirect data) and 17 November 07:00–19:00 UTC (13 slots; closed, see the outage bullet below). The first unbroken streak was 44 hours (to 12 November 13:00 UTC); the longest ran 112 hours, from 12 November 15:00 UTC to 17 November 06:00 UTC. 471 site-hour calls are stored (157 slots × 3 sites), each with its receipt (recounted 17 Nov 20:40 UTC). A cycle takes 15–44 seconds.
- **The pause rule, observed live.** At 21:00 UTC on 11 November Telegraph returned no fresh receipt. The agent recorded all three sites as "Paused · no fresh Telegraph receipt" and paid nothing. Until 17 November 06:00 UTC it happened in 16 different hours (18 failed runs); in each the retry ten minutes later succeeded within the same hour.
- **An outage, closed (17 Nov, 07:00–20:33 UTC).** *Cause:* from 07:01 UTC the settlement step at the third-party x402 facilitator (`facilitator.x402.rs`) timed out (`settle request failed … context deadline exceeded`): the payment was verified, then never settled, for us and — as far as we could see — for everyone; the facilitator's own page still answered. Our signature and our wallet (test USDC and ETH on it) were fine, and nothing was charged. The same morning the devnode moved to a new contract; we did not establish whether that is related. *Effect:* every cycle paused all three sites and paid nothing — the pause rule did what it is for, no guess and no spend — so 13 hourly slots (07:00–19:00 UTC) have no call: 13 hours missed out of 171. *Decision:* we switched the agent to Telegraph's documented second way to pay, a prepaid deposit (escrow, commit `e518bf3`; `TELEGRAPH_PAY_RAIL=auto` pays from the deposit first and falls back to x402). We deposited 1 test USDC (approve and deposit transactions on Sepolia at 20:22 UTC, links in A6), which covers about 100 requests, roughly four days of hourly calls. *Result:* the first purchase from the deposit came back with `200` at 20:33 UTC (Cp Coinbase, receipt `0x77b1…96f0`), and all three sites have had a call again since the 20:00 slot. Not tested: whether the x402 facilitator has recovered; the deposit path does not use it. We also added a reminder to the bot every 6 hours during an outage (the single alert at 07:11 UTC was easy to miss).
- **The limit, verified.** With `DAILY_SPEND_LIMIT_USD=0` on a clean install the agent attempts no payment and pauses every site; the same is covered by a unit test.
- **What the calls were.** Day-ahead power ranged from $99.96 to $495.45/MWh at Leipzig Hub (DE-LU) and from $14.52 to $664.25/MWh at Silesia Farm (PL), against mining revenue of about $50–74/MWh (Mine option plus power price). So the calls mostly held steady: Leipzig Hub (20 MW, all-in lease contract) — Lease to AI in every hour; the fixed-tariff rig — off in every hour (its label reads "Keep as is" in 106 of 157 hours and "Switch off" in 51; the action is the same, the rig stays off); Silesia Farm (12 MW) — Switch off, except 15 November. **Two live changes of call, both at Silesia Farm on 15 November (a Sunday):** 08:00 UTC Switch off → Lease to AI (power fell from $123.79 to $54.00/MWh; lease beat off by $8.00/MWh, worth $117.80/h more than mining) and 13:00 UTC Lease to AI → Switch off (power rose from $66.60 to $169.43/MWh; off beat lease by $107.43/MWh, worth $1,398.36/h more than mining), with Lease to AI held from 08:00 to 12:00 (5 hours). The dollar figures are the `options` and `gainVsMiningPerHour` fields of the two journal entries. Each change has its reason and receipts in the journal (`changed: true`) and one alert was logged (`notified: 1`); we have not verified that the messages reached Telegram. **No live call has ever been Mine**: that flip is exercised by the tests and shown on the demo day (`/demo-day`, `npm run demo:day`): an invented site and invented prices, marked as demo data on screen, in the bot and in the journal. The power prices are real: Energy-Charts reports a DE-LU day-ahead average of €317/MWh for 11 November.
- **First outside feedback (17 Nov) — from an acquaintance, not an independent user.** One person we asked directly, GitHub user `scottlaren`, tried the site in "My tariff" mode at $0.08/kWh and commented in Discussions #1. He found the call (Switch off) clear and checked the arithmetic himself in "Where the numbers come from" ($53.47 revenue vs $80 power). He reported two real problems, both fixed the same day (commit `42cdf17`, with tests): the miner fields looked pre-filled (1000/20/20 were only placeholders), so the form failed until he typed values — they are now visibly empty and required, with a "Fill with example" button, an error banner and focus on the first empty field; and the fixed-rate result said "no paid requests" while its receipt showed "1 paid request · $0.010" — the note now says the shared Bitcoin price request is still paid. This is one comment from one person we know; we count it as feedback, not as adoption. We have no other outside users (B7).
- **Interface and bot, as of 17 Nov.** New logo and one accent colour; one chip style for calls and receipts; History marks every change of call ("Changed from Switch off → Lease to AI" with its reason) and has a "Changes only" switch; one vertical rhythm on all screens. In Telegram, `/start` greets with the current call for every site and two buttons ("See a demo day", "Current calls"); the owner ran `/start`, `/now` and `/demo` in Telegram on 17 Nov and the replies arrived. Before/after pictures: `docs/design/`.
- **Tests.** 154 automated tests in 15 files pass (run on 2026-11-17, 20:54 UTC); typecheck passes (also run on 2026-11-17).
- **A finding for the network.** Paid probes of `MINING_HASHPRICE_VERIFY_GENERAL` and `GRID_POWER_PRICE_GENERAL` (ERCOT hubs) settle and return receipts with empty values. Raw answers and the routing we observed are documented in the repo, so the next Mission 12 builder does not have to pay to rediscover it.

### B7. Limitations

- **Testnet only.** No real money, no mainnet transactions, no customers. No operator has used it; the live sites are examples.
- **One input is bought through Telegraph** — the BTC price. Hashprice is computed by us; power prices are free public European day-ahead data, not ERCOT. US sites exist only in demo mode.
- **The AI lease rate is typed in by the operator.** The `WEB_SEARCH` market guide exists only in demo mode.
- **The live call changed only twice** (Silesia Farm, 15 Nov, see B6) and never to Mine; Leipzig Hub and the fixed-tariff rig never changed. A change to Mine can be seen only on the demo day, which uses invented prices (`docs/demo-day/README.md`).
- **One outage on 17 Nov (07:00–20:33 UTC, closed)**: 13 hourly slots without a call, then payment from a Telegraph deposit (B6). The deposit is a prepaid test-USDC balance of about 100 requests; when it runs out the agent falls back to x402, whose facilitator has not been re-tested since. We have not repeated the deposit steps of `docs/JUDGE.md` from a brand-new wallet.
- **"Lease to AI" is a hypothesis, not a service.** Leasing power to AI is normally a contract of months; nobody switches a long contract by the hour. The app treats the lease rate as a benchmark and as a model of interruptible AI load; at Leipzig Hub the all-in lease contract wins in every decided hour (161 of 161 rows), so the agent has nothing to decide there. The hourly decision that actually moved is Mine / Switch off at Silesia Farm.
- **The Telegram bot** runs as @hashorlease_bot with 2 subscribed chats in `bot-chats.json`. The owner's own `/start`, `/now` and `/demo` replies arrived on 17 Nov, and the agent's log shows 10 alerts sent between 12 and 16 Nov without a send error (two of them the 15 Nov changes of call). No outside person has used the bot. A new subscriber gets no hourly messages — only changes, failures, and the greeting on `/start`.
- **Outside users: one acquaintance, one comment** (B6). No independent adoption yet.
- **History before the agent started** is recomputed from past power prices with today's hashprice; only hours tagged "Agent call" were decided live.
- **The hosted demo shows invented receipts with real-looking wording.** Its receipt cards say "Verified by a Telegraph receipt" with the Intent names and hash-like strings from the mission page; they are invented, and every demo screen carries the strip "Demo data — invented numbers and receipts". Retitling the cards "Demo receipt — invented" is not done yet.
- **No login.** Built for one operator on their own machine, not as a public service.

### B8. What is next

1. **Buy more of the decision through Telegraph.** Lease-rate comparables via `WEB_SEARCH`; power via `GRID_POWER_PRICE` as soon as a miner returns values (CAISO is the next probe); hashprice via `MINING_HASHPRICE_VERIFY` when its fields are populated. The receipt model on screen already supports all three — each one replaces a "Public source" label with a receipt.
2. **A US site on live data.** The mission's buyers are US operators; today the live zones are European.
3. **Put it in front of 3–5 miners and hosting operators** and record what they do with the calls — and which input they trust least.
4. **Curtailment payments in "Switch off".** The decision engine already accepts the value; the form does not yet.
5. **Login and server-side history**, so it can run as a hosted service rather than a local install.

### B9. Stack, data sources, reused components

- **Stack:** Next.js 16 / React 19 (web app and API routes); TypeScript run directly by Node 22.18+ for the agent and the bot; `@x402/fetch` + `@x402/evm` + viem for x402 payments and EIP-191 message signing for the deposit rail; grammY for Telegram; vitest.
- **Shape:** the decision logic is a pure module with no network and no clock. The agent cycle receives its dependencies from outside, so the same code runs on live data, on demo data and in tests. Screens talk to one `DataSource` interface with a demo and a live implementation. Storage is plain files on the operator's machine.
- **Data sources:** Telegraph Engine devnode (`CRYPTO_PRICE_USD`, paid via x402 or from a deposit) · mempool.space · Energy-Charts / Bundesnetzagentur SMARD · operator inputs.
- **Reused components:** Next.js, React, viem, the x402 client packages, grammY, lucide-react, vitest. All product code was written during Season II. License: MIT.

---

## For the owner — not part of the form

### Numbers to refresh on submission day

The agent keeps running every hour and pays from the Telegraph deposit since 17 Nov 20:33 UTC (B6), so these move every hour. Re-read them from the files the day you submit, and copy the three log files from `data/` into `docs/evidence/` first — otherwise reviewers see only 9 November in the repo.

| Claim in the text | Value (recounted 17 Nov 20:40 UTC; tests 17 Nov 20:54 UTC) | Where to re-read it |
|---|---|---|
| Paid requests / total spent | 253 / $2.53 (252 x402 + 1 from the deposit) | `data/ledger.jsonl` (`status` 200 and `cost_usd` > 0; 3 more lines with `cost_usd` > 0 are payments without an answer and are not counted) |
| Paid requests by day (9–17 Nov) | 94 / 7 / 24 / 23 / 24 / 24 / 24 / 24 / 8 (+1 from the deposit on 17 Nov) | same file, by date (`node scripts/recount.mjs 2026-11-17T21:00:00Z` counts x402 only) |
| Decided hours, longest streak | 157 of 171 slots; longest streak 112 hours (12 Nov 15:00 – 17 Nov 06:00 UTC; the first was 44); current streak 1 (since the 20:00 slot) | `data/agent/live/runs.jsonl` (`ok: true`) |
| Site-hour calls in the run | 471 (157 slots × 3 sites) | `data/agent/live/decisions.jsonl` |
| Unplanned pauses | 16 hours with a failed first run (18 failed runs), all recovered the same hour; first on 11 Nov 21:00 UTC. Plus 13 slots with no call, 17 Nov 07:00–19:00 UTC (outage, closed, B6) | `runs.jsonl` (`ok: false`) |
| Call changes in live operation | 2 (Silesia Farm, 15 Nov 08:00 and 13:00 UTC); none to Mine | `grep -c '"changed":true' data/agent/live/decisions.jsonl` → 2 |
| Power price range in the run | Leipzig $99.96–495.45, Silesia $14.52–664.25 /MWh | `decisions.jsonl` (`powerPrice`) |
| Tests | 154 in 15 files (17 Nov) | `npm test` |
| Bot run against Telegram | yes: owner's own `/start`, `/now`, `/demo` (17 Nov); 10 agent alerts sent without error (12–16 Nov) | — |
| Outside users | 1 acquaintance, 1 comment (Discussions #1, 17 Nov); 0 independent | GitHub Discussions #1 |

### What was checked, and how

| Fact | Check (11–12 Nov) |
|---|---|
| 154 tests in 15 files pass, typecheck passes (17 Nov 2026) | ran `npm test` and `npm run typecheck` |
| BTC price is the only paid input | `src/lib/live/market.ts` (`telegraphBtcPrice`) |
| Hashprice formula | `src/lib/live/market.ts` (`hashpriceUsdPerPhDay`) |
| Power from Energy-Charts, five zones | `src/lib/live/market.ts` (`downloadSeries`), `src/lib/live/catalog.ts` |
| No receipt, no call | `src/lib/agent/cycle.ts` (`globalPause`) |
| $5 threshold, lease formula, curtailment field | `src/lib/decision.ts` |
| 30 requests/min, $0.02 cap, default limit $0.50 | `src/lib/live/telegraph.ts` |
| Ledger, run and decision counts | counted from `data/ledger.jsonl` and `data/agent/live/*.jsonl` |
| Power prices are real | Energy-Charts API, DE-LU, 11 Nov: 96 quarter-hour prices, average €316.65/MWh |
| Repository is public, MIT | GitHub API: `private: false`, last push 12 Nov (13:26 MSK) |
| Star on `telegraphprotocol/bounties` | GitHub API: present in `Guryevmn`'s starred list |
| Mission wording, required Intents | https://hackathon.telegraphprotocol.com/missions/mining-and-power |

**Not re-checked by me, taken from `docs/JUDGE.md`:** the on-chain status of the example transaction, the clean-install limit run, the browser checks of all screens, and the explanation of the 9 November burst.

### Where the text is deliberately modest

Scoring (rules §6): technical 35 (minimum 24), commercial 25, independent adoption 10, Telegraph integration 5, reproducibility 5, growth 20. The text claims nothing on adoption beyond one acquaintance's comment (17 Nov), and says so in A6, B6 and B7 — the rules list "accurate claims" as a requirement and fake adoption as grounds for disqualification. The adoption and growth points can only come from real events before 1 December: outside testers, three public updates on separate dates, a tutorial. See `demo-plan.md`.

### Differences from `docs/SUBMISSION.md` and `docs/research/`

- `SUBMISSION.md` §4 said "77 automated tests"; fixed on 16 Nov to the real number, 95 (11 files).
- `SUBMISSION.md` says the agent "has run single cycles on one evening"; fixed: it has since run 157 of 171 hourly slots (longest streak 112 hours; one closed outage 17 Nov 07:00–20:33 UTC; recounted 17 Nov 20:40 UTC).
- `SUBMISSION.md` §10 says the rules "ask for" a fixed order in the video. The rules only suggest a "useful flow"; the requirement is 2–5 minutes showing the real input, the result and the Telegraph integration.
- `docs/research/rules.txt` is cut off in the middle of section 5; sections 5–10 were re-read on the site. The scoring numbers in `docs/PLAN.md` §4 match the site.
- The site still does not say how the 14 November milestone or the 20 November showcase are delivered.
