# Hash or Lease — черновик заявки (НЕ отправлено)

Для пользователя: ниже — английские тексты для формы на сайте хакатона в порядке раздела 8 правил
(«What to submit by December 1»: https://hackathon.telegraphprotocol.com/rules, сверено 2026-11-10), список скриншотов, сценарий видео и риски показа.
Срок подачи — **1 декабря 2026, 23:59 UTC** (14 ноября — проверка хода, не дедлайн).
Ничего не подано и не опубликовано. Поля в `[скобках]` заполняет владелец. Перед отправкой проверь пункты «Нужно от тебя» в конце.

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

**Карта доказательств (для нас, в форму не идёт):**

| Утверждение | Где проверить |
|---|---|
| x402-клиент, адрес Engine | `src/lib/live/telegraph.ts:4-5,153-161` |
| Только тестовый USDC, потолок $0.02 | `src/lib/live/telegraph.ts:10,78` |
| Лимит до оплаты и под замком | `src/lib/live/telegraph.ts:126,132`; тест `src/lib/live/telegraph.test.ts` |
| Платёж без ответа — потрачен | `src/lib/live/telegraph.ts:163-177` |
| Курс BTC — платный вход | `src/lib/live/market.ts:61-70` |
| Формула хешпрайса | `src/lib/live/market.ts:56-59` |
| Электричество — Energy-Charts, 5 зон | `src/lib/live/market.ts:88-91`, `src/lib/live/catalog.ts:6-12` |
| Агент покупает не чаще раза в час UTC | `src/lib/live/market.ts` (`getFreshSnapshot`) |
| Порог $5, формулы, поле curtailment | `src/lib/decision.ts:6,100-109` |
| Нет чека — нет решения | `src/lib/agent/cycle.ts:77-86` |
| Три удачных цикла агента 9 нояб | `docs/evidence/agent-runs.jsonl` (строки 1, 5, 10) |
| Пустые значения у интентов миссии | `docs/evidence/second-queries.json`, `docs/PLAN.md:47-51` |

## 7. Short public summary

> **Hash or Lease** (Mission 12, Mining and Power) is an hourly allocation agent for Bitcoin miners: per site it calls Mine, Lease to AI or Switch off and shows where every input came from. It buys the BTC price through Telegraph with x402 on testnet, stops at a daily spend limit, and refuses to make a call without a fresh receipt. Hashprice and power still come from public sources, because those Intents returned empty values on the devnode — details and raw answers are in the repo. Try it in five minutes with no wallet: `[repo URL]`. Reviewer guide: `docs/JUDGE.md`. Feedback from anyone running a mining site is very welcome: `[contact]`.
>
> Updates: `[link 1, date]` · `[link 2, date]` · `[link 3, date]` · Demo video: `[link]`

## 8. Showcase permission `[решение владельца]`

- May be shared publicly: `[text / screenshots / video / tutorial — choose]`
- Buyer introductions: `[yes / no]`

## 9. Скриншоты для заявки

Готовы (живой режим, 9 нояб):
- [x] `docs/shots/sites.png` — список площадок: решение, $/ч, чек у цифр.
- [x] `docs/shots/site-detail-receipt.png` — площадка с раскрытым чеком Telegraph и ссылкой на оплату в Sepolia.

Снять перед подачей (`npm start`, окно 1280×900):
- [ ] Usage — лимит, карточка «Hourly agent», таблица платных запросов со ссылками.
- [ ] History — часы с пометкой «Agent call» и кнопками «Followed / Did something else / Skip».
- [ ] Add place — ошибка ввода «2 J/TH is below any known miner».
- [ ] Баннер «Can't reach Telegraph» (сценарий из JUDGE.md §5).
- [ ] Терминал с логом агента (`npm run agent -- --once`).
- [ ] Страница транзакции на sepolia.etherscan.io.
- [ ] Telegram: оповещение о смене решения и `/now` — после подключения токена бота.

## 10. Видео-демо, 2–3 минуты

Голос — по-английски, коротко. В скобках — что на экране. Правила просят 2–5 минут в порядке: проблема → запрос к Telegraph → данные и поставщик → цена запроса → результат → как попробовать.

| Время | Экран | Текст |
|---|---|---|
| 0:00–0:15 | Places (живой режим) | "Miners decide every hour: mine, lease the power to AI, or switch off. Hash or Lease makes that call for every site, with a receipt under every number." |
| 0:15–0:40 | Leipzig Hub → блок «Where the numbers come from» | "Leipzig: power is $420 a megawatt-hour tonight, mining earns $73, so leasing wins by about $9,000 an hour. Here is the formula, input by input." |
| 0:40–1:05 | Тап по ✓ у Mining revenue → «View payment on Sepolia» | "This number is backed by a Telegraph purchase: provider, time, one cent in test USDC, and the settlement on Sepolia. The power price is marked as a free public source — we don't pretend it came from Telegraph." |
| 1:05–1:30 | Терминал: `npm run agent -- --once` → Usage, карточка агента | "The agent runs every hour without a browser. It buys its own data through Telegraph with x402 and writes every decision with its receipts." |
| 1:30–1:55 | Терминал: `DAILY_SPEND_LIMIT_USD=0 npm run agent -- --mode=live --once --fresh` → History, часы «Paused · daily limit» | "Spend is capped. Hit the daily limit and it stops before paying — no receipt, no call." |
| 1:55–2:15 | Add place: France, 500 PH/s, 10 MW → новая площадка; затем 2 J/TH → ошибка | "Adding a site takes a minute. Bad input is caught next to the field." |
| 2:15–2:35 | History, отметить час «Did something else» | "History shows what following the advice was worth — counted only for hours the operator marks." |
| 2:35–2:50 | Шапка «Testnet · no real money», JUDGE.md | "Everything runs on testnet: Telegraph devnode and Sepolia. Reviewer steps are in docs/JUDGE.md." |

Перед записью: один обычный цикл агента (`npm run agent -- --once`), чтобы в History были свежие «Agent call».
Цифры в тексте на 0:15 — с вечера 9 нояб; в день записи они будут другими: диктор читает то, что на экране.

## 11. Риски показа и запасной план

Рекомендация: записывать по кадрам и на показе использовать готовую запись — живой показ зависит сразу от трёх чужих сервисов.

| Риск | Что делать |
|---|---|
| Оплата x402 идёт долго (циклы агента 9 нояб — 17–23 с) | В записи вырезать ожидание; вживую — говорить текст кадра, пока идёт цикл. |
| Узел Telegraph недоступен или отвечает 504 (9 нояб было 14 ответов 504) | Не чинить в кадре: показать баннер «Can't reach Telegraph» как правило «нет чека — нет решения», перейти к записи. |
| Energy-Charts ограничил частоту запросов | Приложение берёт последний сохранённый ряд цен; если площадка всё же «Paused» — показывать площадку на своём тарифе. |
| Лимит исчерпан пробными прогонами | Утром выставить лимит с запасом; каждый `--fresh` и «Refresh now» — минус цент. |
| Сцена лимита | Только `DAILY_SPEND_LIMIT_USD=0`. Запасной кадр: `npm run agent -- --mode=mock --once --state=limit` — та же картинка на выдуманных данных, сказать об этом вслух. |
| Цена электричества $400+ за МВт·ч выглядит подозрительно | Это реальный вечерний пик (сверено с Energy-Charts, `docs/JUDGE.md` §2); сказать «tonight power is at an evening peak». |
| В кадр попал секрет | `.env` не открывать; терминал очищен; запись пересмотреть перед публикацией. |
| Сеть пропала совсем | Демо-режим без сети с плашкой «Demo data», состояния `?state=error`, `?state=limit`; прямо сказать, что данные выдуманные. |

## 12. Коротко по-русски

**Одной строкой:** каждый час по каждой площадке — майнить, сдать мощность под ИИ или выключить, в долларах в час и с источником под каждой цифрой.
**Telegraph:** агент сам платит за курс BTC (x402, тестовый USDC в Sepolia, $0.01 за запрос, около $0.24 в день). Хешпрайс и цены ERCOT пробовали купить — оплата прошла, значения пустые; поэтому хешпрайс считаем сами, электричество берём из открытого европейского источника.
**Безопасность расходов:** дневной лимит до оплаты, один платёж за раз, потолок $0.02, только тестовая монета.
**Ограничения:** только тестовая сеть, пользователей нет, через Telegraph покупается одна цифра, ставку аренды вводит оператор, агент запускался разово, бот не запускался в настоящем Telegram.

## 13. Нужно от тебя перед подачей

- [ ] Контакт, ссылки на код и демо, имя на GitHub (поля в `[скобках]`).
- [ ] Звезда на github.com/telegraphprotocol/bounties — ведёт другая сессия.
- [ ] Первый коммит в git и публикация кода (судьям нужен доступ к коду) — твоё решение.
- [ ] Токен Telegram-бота (создать у @BotFather, вписать в `.env` как `HASHORLEASE_BOT_TOKEN`) — если хотим показать бота.
- [ ] Решение, где показывать демо: локально у тебя или выложить в интернет (выкладка — только с твоего «да»).
- [ ] Записать видео (или поручить запись сессии) и «да» на публикацию.
- [ ] Ссылки на публичные записи о ходе работы (updates) и разрешения на показ (раздел 8).
- [ ] Отправка формы — сам или с твоего «да».
