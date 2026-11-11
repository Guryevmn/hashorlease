# Hash or Lease — demo plan

> **Резюме для владельца (по-русски).** План трёх показов: 14 ноября (проверка хода), 20 ноября (показ сообществу) и 2–8 декабря, когда жюри само запускает проект по инструкции — это и есть главный «показ». Для каждого: что показать по шагам и что делать, если сеть или бот подведут.
> Сайт хакатона не говорит, куда и в каком виде приносить показ 14 и 20 ноября — это нужно узнать в Discord до 13 ноября. Раздел **«Нужно от пользователя»** в конце написан по-русски, со сроками.

Status: plan. Nothing has been posted, published or submitted.

## What the rules actually say

Checked on 2026-11-12: https://hackathon.telegraphprotocol.com/rules (§3, §6, §8, §9) and https://hackathon.telegraphprotocol.com/timeline.

| Date (UTC) | Event | What the site says | What it does not say |
|---|---|---|---|
| 14 Nov | First Integration Milestone | "Show your first working Telegraph intelligence request or purchase, an attempt, or what is blocking you." A progress check — not a deadline, not a cut. | Where and in what form: a Discord thread, a form, a call. |
| 20 Nov | Community showcase | "Working progress, uncovered missions, and opportunities where builders need help." | Whether it is a live call or a round of posts; time; length. |
| Final week | Anjoman hands-on community session | Details "through official channels". | Everything else. |
| 1 Dec 23:59 | Submission deadline | Through the official H2 website. | — |
| 2–8 Dec (planned) | Verification and judging | Reviewers reproduce the workflow themselves on the stated network. | — |

Two consequences. First, **there is no pitch in front of a jury**: the entry is judged by a reviewer who clones the repo and follows `docs/JUDGE.md`, so that path matters more than any live demo. Second, the format of 14 and 20 November has to be found out in the Telegraph Discord (https://discord.gg/telegraphprotocol) — this plan covers both a written and a live format.

---

## 1. 14 November — First Integration Milestone

**Goal:** show that the purchase works, and report the blocker. We have both.

**What to show, in this order:**

1. **A working autonomous purchase.** The agent's own payment for `CRYPTO_PRICE_USD` on Sepolia — transaction `0x1c3bc795…76df`, link: https://sepolia.etherscan.io/tx/0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df
2. **What the purchase is used for.** Screenshot `docs/shots/site-detail-receipt.png`: the receipt under "Mining revenue" in the site breakdown.
3. **That it is not a one-off.** The agent's run log: 27 hours in a row on 10–11 November, one purchase an hour `[update the number on the day]`.
4. **The blocker.** `MINING_HASHPRICE_VERIFY_GENERAL` and `GRID_POWER_PRICE_GENERAL` for ERCOT hubs: paid, settled, values empty. Raw answers: `docs/evidence/first-hashprice.json`, `docs/evidence/second-queries.json`.
5. **One question to the organisers** — the reason to post at all: which request returns hashprice and ERCOT values on the devnode?

**Draft text** (to post only with the owner's "yes"; fits a Discord message):

> **Hash or Lease — Mission 12, Mining and Power (Apps & Agents)**
> Hourly allocation call per mining site: Mine / Lease to AI / Switch off, with a receipt under every input.
>
> **Integration: working.** An hourly agent buys `CRYPTO_PRICE_USD` from the devnode over x402 (test USDC, Sepolia) with no human in the loop, and makes no call without a fresh receipt. It has run `[27]` hours in a row at one purchase per hour. Example payment: https://sepolia.etherscan.io/tx/0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df
>
> **Blocker.** `MINING_HASHPRICE_VERIFY_GENERAL` and `GRID_POWER_PRICE_GENERAL` (`HB_HOUSTON`, `HB_WEST`) settle and return receipts, but the value fields are `null` / `missing`. The hashprice request is routed to a pool-statistics miner, the ERCOT requests to a CAISO grid miner. Raw answers are in the repo under `docs/evidence/`. Until this changes we compute hashprice ourselves and use public European day-ahead prices, and label both on screen as not bought via Telegraph.
>
> **Question.** Is there a parameter form or a miner that returns values for ERCOT hubs and for hashprice on the devnode?
>
> Repo and reviewer guide: https://github.com/Guryevmn/hashorlease (`docs/JUDGE.md`). Runs in demo mode in five minutes, no wallet.

**Attach:** `docs/shots/site-detail-receipt.png` and `docs/shots/sites.png`.

**If something fails on the day:** nothing in this milestone depends on a live system — the payment is on-chain and the screenshots exist. If the devnode is down on 14 November, post anyway and add one line saying so.

**Why it is worth doing well:** this post is also the first of the "three meaningful original updates on separate dates" (rules §6, 2 points), and a documented blocker is the kind of contribution delivery awards prioritise ("removing real blockers", rules §4).

---

## 2. 20 November — Community showcase

**Goal:** working progress, plus a clear ask. Prepare both formats; use the one the organisers announce.

### Format A — live, 4 minutes, screen share

Open beforehand: the app in live mode (tab 1), a Sepolia transaction page (tab 2), a terminal, the demo video as a local file.

| Step | Time | Do | Say |
|---|---|---|---|
| 1 | 0:00–0:30 | Places, live mode | "Hash or Lease, Mission 12. Every hour, for every mining site: mine, lease to AI, or switch off — in dollars." |
| 2 | 0:30–1:15 | Open Leipzig Hub → options → "Where the numbers come from" | "Three options in dollars per megawatt-hour and the formula. Each number says where it came from." |
| 3 | 1:15–2:00 | Click ✓ on Mining revenue → receipt → tab 2 | "This one is bought through Telegraph over x402: provider, time, one cent of test USDC, settled on Sepolia. Power is a public source and is labelled so." |
| 4 | 2:00–2:40 | Usage → "Hourly agent" card and paid requests | "No one clicks 'buy'. The agent has run `[N]` hours, one purchase an hour, under a daily limit. No fresh receipt — no call; it logs a pause." |
| 5 | 2:40–3:20 | Terminal: `npm run agent -- --mode=mock --once --state=limit` | "Here is the limit on demo data: it stops before paying." *(Say "demo data" out loud.)* |
| 6 | 3:20–4:00 | Repo page, `docs/JUDGE.md` | "What we need: a miner that returns hashprice and ERCOT prices — those Intents come back empty for us. And two or three people who run mining hardware to tell us what the call gets wrong. Five minutes to run, no wallet." |

Step 5 uses demo data on purpose: the real limit run takes longer and adds a paused hour to the live history. Nothing in this run-through pays.

### Format B — written post

The 14 November text, updated: hours run, what changed since, a link to the video or 3–4 screenshots (Places, receipt, Usage, History), and the same two asks as step 6. This is the second of the three updates.

### Fallback ladder for a live showing

| If | Then |
|---|---|
| The app shows "Can't reach Telegraph" | Do not fix it on air. Say: "This is the rule working — no fresh receipt, no call," show the banner and the "Outdated" badges, and continue from step 4. |
| A site shows "Paused" because the power source is rate-limited | Show another site; the fixed-tariff site does not depend on it. |
| The internet connection drops | Switch to the recorded video. If there is no video yet: demo mode (`npm start` without live mode) — and say plainly that the numbers are invented. |
| The Mac or the app will not start | Show the two screenshots in `docs/shots/` and the Sepolia link from a phone. |
| The Telegram bot is silent or not set up | Skip it. The bot is not part of the run-through until it has been run against Telegram for a day. |
| Someone asks why only one input is bought through Telegraph | The straight answer: the two mission Intents return empty values on the devnode; raw answers are in the repo; the screen labels every source. |
| Someone doubts power at $300–500/MWh | It is the real day-ahead evening peak in DE-LU / PL; `docs/JUDGE.md` §2 has the source link. |

**Rehearse once** on 19 November with the fallbacks: turn the network off and check that the video and demo mode both open.

---

## 3. 2–8 December — the reviewer runs it alone

This is the showing that is scored. A reviewer needs to: run it with a new input, check the result, inspect the real Telegraph request and payment, break it, and reproduce it (rules §2, "Mission acceptance"). `docs/JUDGE.md` already has a section for each.

**Before 1 December:**

- [ ] **Clean-machine rehearsal:** a fresh clone in an empty folder, following `docs/JUDGE.md` word for word — demo mode, the agent on demo data, tests. Fix anything that does not match the text.
- [ ] **Refresh the evidence:** copy the current ledger and the agent's run and decision logs into `docs/evidence/`. The repo holds 9 November only; the 27-hour run is not in it yet.
- [ ] **Bring `docs/JUDGE.md` up to date** with the multi-day run (it still describes single cycles on 9 November).
- [ ] **A reviewer-access link that works without us:** the public repo is enough for demo mode. A hosted demo is optional — see "Нужно от пользователя", item 5.
- [ ] **Keep the agent running** through the judging week, so the history a reviewer opens is current.

---

## 4. Weak spots to decide on before 20 November

Found while preparing these materials; each one is a decision for the owner or the project head, not something this document changes.

1. **The live call never changes.** In 28 cycles all three example sites kept the same call: with power at $189–610/MWh, mining never wins. A viewer sees "Lease / Switch off / Keep as is" and never "Mine", and the change alert has never fired live. *Suggested:* add one example site whose call does flip during a day — for instance a site on a fixed tariff near break-even, or with a lease rate that excludes power. It makes the video, the bot and the history much more convincing.
2. **One of five inputs is bought through Telegraph.** Telegraph integration is worth only 5 points, but technical quality (35, minimum 24) is judged with "mainnet readiness" in mind. *Suggested:* the cheap `WEB_SEARCH` probe for lease-rate comparables and the CAISO probe for `GRID_POWER_PRICE`, both already in the project queue — each success turns a "Public source" label into a receipt.
3. **No outside users** — 10 points for adoption and up to 4 of the growth points depend on an independent person doing something. See item 4 in the list below.
4. **`docs/SUBMISSION.md` is partly out of date** (test count, "single cycles on one evening"). `application.md` in this folder is the current text.

---

## Нужно от пользователя

Все сроки — по Москве. Крайний срок подачи: **1 декабря 23:59 UTC = 2 декабря 02:59 по Москве**. Подавать лучше 30 ноября, с запасом в сутки.

### 1. Узнать формат показа 14 и 20 ноября — до 13 ноября

**Зачем:** сайт не говорит, куда приносить показ; без этого не понять, готовить пост или живой созвон.

1. Открой Discord хакатона (ссылка — в подвале сайта hackathon.telegraphprotocol.com, кнопка Discord).
2. Найди канал с объявлениями (обычно называется announcements) и канал хакатона.
3. Посмотри, есть ли сообщение про 14 ноября («First Integration Milestone») и про 20 ноября («Community showcase»): куда писать, созвон это или пост, во сколько.
4. Перешли сюда текст объявления или снимок экрана.

Если времени нет — скажи «да», и сессия посмотрит сама через браузер на Mac (читать можно без твоего участия, писать — только с твоего согласия).

### 2. Сказать «да» на публикацию заметки 14 ноября — до 13 ноября, вечер

**Зачем:** это и есть проверка хода, а заодно первое из трёх публичных обновлений, за которые дают баллы. Текст готов выше, в разделе 1. Без твоего «да» ничего не публикуется.

### 3. Токен бота (ключ, по которому Telegram пускает нашего бота) — до 15 ноября

**Зачем:** без него бот не запускается, и его нельзя показать ни в ролике, ни на показе 20 ноября. В настройках на Mac строка для токена уже не пустая (само значение я не смотрел). Если ты его уже вставлял — напиши «токен стоит», и бота можно запускать. Если нет:

1. В Telegram найди **@BotFather** (с синей галочкой) и нажми «Запустить».
2. Отправь ему команду `/newbot`.
3. Он спросит имя — напиши `Hash or Lease`.
4. Он спросит адрес бота — придумай любой, оканчивающийся на `bot`, например `hashorlease_bot`. Если занят — попробуй другой.
5. BotFather пришлёт длинную строку из цифр и букв — это токен. **Никому его не пересылай и не вставляй в этот чат**: с ним любой может управлять ботом.
6. Когда будешь за Mac: открой папку «Документы» → `HashOrLease`, нажми `Cmd + Shift + .` (точка), чтобы показались скрытые файлы, открой файл `.env` в TextEdit.
7. Найди строку `HASHORLEASE_BOT_TOKEN=` и вставь токен сразу после знака `=`, без пробелов. Сохрани.
8. Напиши сюда «токен вставил» — сессия запустит бота. Потом открой своего бота в Telegram и нажми «Запустить», чтобы он знал, кому писать.

### 4. Найти 3–5 человек, которые попробуют продукт — с 21 по 27 ноября

**Зачем:** это самая большая дыра в заявке. За сторонних пользователей дают до 10 баллов, и ещё до 4 — если независимый разработчик что-то сделал по нашей инструкции. Сейчас там ноль. Звёзды и подписки баллов не дают, считаются только действия.

Что подходит: человек запустил проект у себя по инструкции и написал, что получилось; майнер или сотрудник хостинга посмотрел расчёт и сказал, чему не верит; кто-то открыл замечание в репозитории на GitHub.

Что нужно от тебя:
- вспомнить знакомых майнеров, людей из хостинга или разработчиков — 3–5 имён;
- сказать «да» на то, чтобы сессия подготовила короткое приглашение и (отдельное «да») написала в чаты майнеров и в Discord хакатона;
- попросить каждого оставить след публично (сообщение в Discord, замечание на GitHub): жюри засчитывает только то, что может проверить.

Выдумывать пользователей нельзя: за это по правилам снимают с конкурса.

### 5. Решить, выкладывать ли демо в интернет — до 17 ноября

**Зачем:** ссылка, по которой проект открывается сразу, без установки, поднимает баллы за «лёгкость попробовать» и нужна кнопкам бота. Без неё жюри ставит проект у себя по инструкции — это работает, но дольше.

- **Выложить демо на выдуманных данных (рекомендую).** Бесплатно, безопасно: ни кошелька, ни трат, на каждом экране плашка «Demo data».
- **Выложить живую версию.** Не советую: в приложении нет входа по паролю, любой посетитель сможет менять площадки и тратить дневной лимит.
- **Не выкладывать.** Ничего не ломает, но теряем часть баллов.

Нужно только твоё «да» — сессия сделает сама.

### 6. Ещё два публичных обновления в разные дни — 20 ноября и около 26 ноября

**Зачем:** правило оценки — минимум три содержательных обновления в разные даты (2 балла), плюс баллы за понятное объяснение и за техническую инструкцию о роли Telegraph (ещё до 4). Первое — заметка 14 ноября, второе — показ 20 ноября, третье — короткая инструкция «как агент сам платит за данные» ближе к 26 ноября. Тексты подготовит сессия, от тебя — «да» на каждую публикацию и решение, где публиковать (Discord хакатона и X или другая площадка — баллы дают за выход за пределы одного Discord).

### 7. Ролик — запись 24–27 ноября

**Зачем:** ролик от 2 до 5 минут обязателен в заявке. Сценарий — в `video-script.md`.

Решить нужно три вещи:
- **Голос.** Твой голос, синтетический английский голос или только титры. Рекомендую синтетический голос плюс титры: ровно и без пересъёмок.
- **Кто записывает экран.** Сессия может записать сама на Mac. Запись стоит несколько центов тестовых денег.
- **Куда выложить.** Нужна ссылка, которая открывается без входа (например, YouTube с доступом по ссылке). Публикация — только с твоим «да», после того как ты посмотришь ролик.

### 8. Оставить агента работать и обновить доказательства — «да» до 20 ноября

**Зачем:** чем дольше агент работает без перерыва, тем сильнее главный факт заявки. Сейчас он идёт с 10 ноября и тратит около 24 центов тестовых денег в сутки (настоящих денег нет). Свежие журналы нужно положить в открытый репозиторий — это отправка на GitHub, она делается только с твоим «да».

### 9. Заполнить свои поля в заявке — до 29 ноября

В `application.md` в квадратных скобках:
- имя и контакт (почта, Telegram или Discord), который увидят организаторы;
- что можно показывать публично: текст, снимки экрана, ролик, инструкцию;
- согласен ли ты, чтобы организаторы знакомили тебя с возможными покупателями (на оценку не влияет).

### 10. Проверить, сможешь ли ты получить приз — до 29 ноября

**Зачем:** в правилах сказано, что выплата зависит от страны, проверки личности и налоговых документов, и что регистрация сама по себе права на приз не подтверждает. Условия выплат стоит прочитать на сайте заранее или спросить у организаторов в Discord, подходит ли твоя страна и способ получения.

### 11. Подать заявку — 30 ноября

Заявка подаётся через сайт хакатона, после входа под твоей учётной записью. Сессия может заполнить форму за тебя в браузере на Mac и остановиться перед кнопкой отправки — нажатие только после твоего «да».

### Уже сделано, от тебя ничего не нужно

- [x] Код открыт: github.com/Guryevmn/hashorlease.
- [x] Обязательная звезда на репозитории bounties стоит (проверено 12 ноября).
- [x] Агент работает и платит сам; 79 автоматических проверок проходят.
- [ ] Регистрация на хакатоне — в очереди проекта отмечена как незавершённая; подтверди, что она пройдена и выбраны Apps & Agents и миссия 12.
