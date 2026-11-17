# Hash or Lease — план действий до сдачи и готовые тексты

> **Обновление 17.11.** Числа ниже — снимок на 16.11. Актуально на 17.11, 20:00 UTC (`node scripts/recount.mjs 2026-11-17T20:00:00Z`): решение принято в 156 из 170 часовых слотов, самая длинная серия 112 ч, 252 платных запроса на $2.52, 127 тестов. **С 07:00 UTC 17.11 агент не проводит платежи** (проверка оплаты проходит, а расчёт у стороннего сервиса x402 не завершается; 13 слотов без решения) — до съёмки и поста проверить, что оплата снова идёт. Бот: Михаил сам проверил `/start`, `/now`, `/demo` 17.11 (пришли). Первый отзыв — от знакомого, не независимый пользователь: GitHub Discussions #1. Свежие факты — в `application.md`.


Составлено 2026-11-12, обновлено по сверке `reality-check.md` (12.11, 17:25 UTC). Пост А отправлен владельцем 12.11 в 19:52 МСК в `#hackathon` (ветка в `#showcase` — в 19:50 МСК); остальные посты — только после «да» владельца.
Формат показов уточнён по Discord, подробности и цитаты — `docs/submission/discord-findings.md`.

## План простыми словами

Все даты — UTC; в скобках — по Москве.

| Когда | Что | Кто | Нужно от владельца |
|---|---|---|---|
| **Чт 12 нояб, вечер** | Заметка А (текст ниже) опубликована 12.11 в 19:52 МСК в `#hackathon` — сделано | владелец | — |
| **Пт 14 нояб** | Проверка интеграции. Следить за ответом организаторов на наш вопрос (ERCOT и хешпрайс пустые) | сессия | — |
| ~~до 15 нояб~~ | Токен Telegram-бота — сделано: токен вставлен, бот работает (@hashorlease_bot) | — | проверить, что бот доставляет сообщение подписчику |
| ~~до 17 нояб~~ | Демо на выдуманных данных выложено: https://hashorlease.vercel.app — сделано | — | — |
| 19 нояб | Репетиция показа без интернета (видео + демо-режим) | сессия | — |
| **Пт 20 нояб** | «Community showcase»: ветка в форуме `#showcase` (текст Б) + пост в X (текст В) | сессия по «да» | «да» на публикацию, решить, где ещё публиковать |
| 21–27 нояб | Найти 3–5 человек, которые реально попробуют; они оставляют публичный след | владелец + сессия | имена знакомых, «да» на приглашения |
| 24–27 нояб | Ролик 2–5 минут (сценарий — `video-script.md`) | сессия | выбрать голос, «да» на публикацию после просмотра |
| ~26 нояб | Третье публичное обновление: инструкция «как агент сам платит» (план Г) | сессия по «да» | «да» |
| до 29 нояб | Свои поля заявки (имя, контакт, что можно показывать), проверка условий выплаты приза | владелец | данные, решения |
| **30 нояб** | Заполнить форму сдачи (она откроется позже; ссылку смотреть на сайте хакатона), остановиться перед «Отправить» | сессия | «да» на отправку |
| **1 дек 23:59 (2 дек 02:59 МСК)** | Крайний срок. Сдавать 30 ноября | — | — |
| 2–8 дек | Жюри само запускает проект по `docs/JUDGE.md`; агент должен работать всё это время | сессия | — |

**Что известно про показы (из Discord и правил):**
- 14 ноября — не созвон и не форма: организатор написал выложить свидетельство работающей покупки в `#hackathon` (транзакция, запрос, ответ). Это отметка прогресса. Законченное приложение не нужно.
- 20 ноября — формат организаторы не уточнили. Они советуют выкладывать приложение в форум `#showcase`; живого созвона в найденном нет. Готовы оба варианта (`demo-plan.md`, формат A и B).
- Публичные посты дают баллы (до 20 из 100), нужно минимум 3 на разные даты: 14 ноября, 20 ноября и ~26 ноября. В постах про хакатон нужна пометка об участии и призах; в X — тег `@Telegraphprotoc`.

**Что готово сейчас (обновлено 16 ноября, 21:00 UTC; первичная проверка — 12 ноября):**
- [x] Агент работает: 146 из 147 часовых слотов с 10.11 18:00 UTC по 16.11 20:00 UTC, единственный пропуск — 14:00 UTC 12.11 (совпал с перезагрузкой Mac); первая серия была 44 часа, текущая идёт с 12.11 15:00 — 102 часа подряд; платежи на Sepolia. Всего 242 платных запроса на $2.42 тестовых денег (часть — разработка, 94 из них 9.11). Пересчитано скриптом `node scripts/recount.mjs 2026-11-16T21:00:00Z`; тестов 95 (`npm test`, 16.11).
- [x] Живое решение менялось дважды — оба раза 15.11 на площадке Silesia Farm: 08:00 UTC «Выключить → Сдать под ИИ» (цена упала с $123.79 до $54.00/МВт·ч) и 13:00 UTC «Сдать → Выключить» (цена выросла с $66.60 до $169.43). На «Майнить» живое решение не переключалось ни разу (цены $14.52–664.25/МВт·ч). Доставку уведомлений в Telegram не проверяли. «Демо-день» показываем только как симуляцию смены на «Майнить».
- [x] Тексты 14 и 20 ноября, сценарий ролика, текст заявки — в этой папке.
- [x] Бот работает: @hashorlease_bot запущен, в `bot-chats.json` 1 подписчик. [ ] Доставку сообщения в Telegram ещё не проверяли.
- [x] Код публичный (MIT), демо выложено: https://hashorlease.vercel.app.
- [ ] Сторонних пользователей ноль.
- [ ] Свежие журналы агента не лежат в репозитории (в `docs/evidence/` только 9 ноября); этот план и другие свежие документы — только в локальной ветке: нужна отправка на GitHub, только с «да».

**Риск по нашему интенту:** участник NFT KING написал (12 ноября), что компараторы `GRID_POWER_PRICE` с 3 ноября висят в «pending»; организатор Ahmed Ali ответил ему 12.11 в 14:28 МСК, что эти семейства не будут поддержаны («не нужны для основного пути»). Нам организаторы не отвечали, вопросов к нам нет. Наша проблема — пустые значения у `GRID_POWER_PRICE` и хешпрайса, это не то же самое, поэтому наш вопрос в заметке уместен.

**Чего я не знаю:** будет ли у 20 ноября живой созвон (на сайте и в Discord об этом не сказано; если появится объявление, поменяем формат); во сколько UTC закрывается приём заметок 14 ноября (нигде не указано).

---

## Тексты (English, для публикации — только с «да»)

### А. 14 ноября — Discord, канал `#hackathon`

Вложения: `docs/shots/site-detail-receipt.png`, `docs/shots/sites.png`.
**Опубликовано 12.11 в 19:52 МСК (текст ниже — как отправлен).**

> **Hash or Lease — Mission 12, Mining and Power (Apps & Agents)**
> Hourly allocation call per mining site: Mine / Lease to AI / Switch off, with a receipt under every input.
>
> **Integration: working.** An hourly agent buys `CRYPTO_PRICE_USD` from the devnode over x402 (test USDC, Ethereum Sepolia) with no human in the loop, and makes no call without a fresh receipt. It has run since Nov 10, 18:00 UTC: 45 hourly runs in 46 hours, one purchase each, the longest unbroken streak is 44 hours. Example payment: https://sepolia.etherscan.io/tx/0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df
>
> **Blocker.** `MINING_HASHPRICE_VERIFY_GENERAL` and `GRID_POWER_PRICE_GENERAL` (`HB_HOUSTON`, `HB_WEST`) settle and return receipts, but the value fields are `null` / `missing`. The hashprice request is routed to a pool-statistics miner, the ERCOT requests to a CAISO grid miner. Raw answers are in the repo under `docs/evidence/`. Until this changes we compute hashprice ourselves and use public European day-ahead prices, and label both on screen as not bought via Telegraph.
>
> **Question.** Is there a parameter form or a miner that returns values for ERCOT hubs and for hashprice on the devnode?
>
> Repo and reviewer guide: https://github.com/Guryevmn/hashorlease (`docs/JUDGE.md`). Demo mode runs in five minutes, no wallet. Testnet only. Hackathon entry, Season II.

(Опубликовано 12.11 в 19:52 МСК — текст выше не менять. Репозиторий публичный, проверено 12.11.)

### Б. 20 ноября — форум `#showcase`, обновление в нашей ветке

Не новая ветка: **ответ в ветке, созданной 12.11** (там же лежит пост А), чтобы обновления шли одной лентой. Заголовок не нужен. Публиковать только с «да» владельца; числа в `[…]` заполнить в день публикации (команда ниже), до этого текст не отправлять.

**Как пересчитать числа за минуту** (из корня проекта; только чтение, ничего не платит):

```
export PATH=$(ls -d ~/.local/share/node-v22.*/bin | head -1):$PATH
node scripts/recount.mjs          # слоты, пропуски, серия, платные запросы, $
npm test                          # число тестов (строка Tests)
```

Что куда подставить: `[SLOTS]` = «Слотов», `[DECIDED]` = «с решением», `[LONGEST]` = «Самая длинная серия», `[CURRENT]` = «текущая серия», `[PAID]` и `[USD]` = «Платных запросов», `[TESTS]` = число из `npm test`, `[DATE]` = дата и час пересчёта UTC. Если появился новый пропуск — упомянуть его так же прямо, как пропуск 12.11. Слово «подряд» относить только к `[LONGEST]` и `[CURRENT]`, не ко всем слотам.

**Пересчёт 12.11, 20:36 UTC (для сверки скрипта, не для публикации):** слотов 50 (с 10.11 18:00 по 12.11 19:00 UTC), с решением и покупкой 49, пропуск один — 12.11 14:00 UTC; самая длинная серия 44 ч, текущая 5 ч; платных запросов 145 на $1.45 тестовых (часть — разработка); `npm test` 95 из 95. На 17:35 UTC скрипт давал 47 из 48 — совпадает с постом А и со сверкой.

**English (для публикации):**

> **Update, Nov 20 — Hash or Lease (Mission 12)**
>
> Short progress note since the Nov 12 post. Numbers recounted from our own logs on `[DATE]` UTC.
>
> **Telegraph, for real.** The hourly agent buys `CRYPTO_PRICE_USD` over x402 (test USDC, Sepolia); one purchase covers all sites, and it stops at a daily limit. With no fresh receipt it makes no call and logs a pause. Since Nov 10, 18:00 UTC: `[DECIDED]` of `[SLOTS]` hourly slots have a decided call with a purchase. One slot is missing: 14:00 UTC on Nov 12, when the Mac running the agent was restarted. The longest unbroken streak is `[LONGEST]` hours; the current one is `[CURRENT]`. `[Add one line if there is a new gap.]` Paid requests in the ledger: `[PAID]` for $`[USD]` of test money, including our own development tests. Example payment: https://sepolia.etherscan.io/tx/0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df
>
> **A real change of call, and a simulated one.** In our live run the call changed twice, both times on Nov 15 at Silesia Farm: at 08:00 UTC Switch off → Lease to AI (power fell from $123.79 to $54.00/MWh) and at 13:00 UTC back to Switch off (power rose to $169.43/MWh); the reason is written on each record. No live call has ever been Mine, and we have not verified that the alert messages reached Telegram. So there is also a simulated day (demo data, not live) on an invented site (Solar Ridge) where the call changes twice, each time with the reason and the alert text: https://hashorlease.vercel.app/demo-day. It runs the same agent cycle on invented prices; nothing is requested or paid. `[screenshot or short clip, captioned "demo data"]`
>
> **What is still not done.** Only one input is bought through Telegraph. The hashprice and ERCOT intents came back empty for us (raw answers in `docs/evidence/`), so hashprice is computed by us and power comes from a public European source, both labelled on screen. No operator has used it yet. Testnet only; `[TESTS]` automated tests pass.
>
> **Where we would like help.** (1) A miner or a parameter form that returns hashprice and ERCOT hub prices on the devnode. (2) Two or three people who run mining hardware or hosting to tell us what the call gets wrong. (3) Anyone willing to follow `docs/JUDGE.md` (about five minutes, no wallet) and tell us where it breaks.
>
> Repo: https://github.com/Guryevmn/hashorlease · Demo (invented data): https://hashorlease.vercel.app · Hackathon entry, Season II.

**Русский перевод (для владельца, не публиковать):**

> **Обновление, 20 ноября — Hash or Lease (миссия 12)**
>
> Короткий отчёт после поста от 12 ноября. Числа пересчитаны по нашим журналам на `[DATE]` UTC.
>
> **Telegraph по-настоящему.** Агент каждый час сам покупает `CRYPTO_PRICE_USD` через x402 (тестовые USDC, Sepolia); одна покупка закрывает все площадки, есть дневной лимит. Нет свежего чека — решения нет, агент записывает паузу. С 10.11, 18:00 UTC: в `[DECIDED]` из `[SLOTS]` часовых слотов есть решение и покупка. Одного слота нет: 14:00 UTC 12.11, когда перезагружали Mac с агентом. Самая длинная серия без пропусков — `[LONGEST]` ч, текущая — `[CURRENT]` ч. `[Добавить строку, если появился новый пропуск.]` Платных запросов в журнале: `[PAID]` на $`[USD]` тестовых денег, включая наши тесты при разработке. Пример платежа: ссылка на Etherscan.
>
> **Настоящая смена решения и симуляция.** В живой работе решение менялось дважды, оба раза 15.11 на площадке Silesia Farm: в 08:00 UTC «Выключить → Сдать под ИИ» (цена упала с $123.79 до $54.00/МВт·ч), в 13:00 UTC обратно (цена выросла до $169.43); причина записана в журнале. На «Майнить» живое решение не переключалось ни разу, доставку уведомлений в Telegram мы не проверяли. Поэтому есть ещё симулированный день (демо-данные, не живое) на выдуманной площадке (Solar Ridge), где решение меняется дважды — каждый раз с причиной и текстом уведомления. Тот же цикл агента, на выдуманных ценах; ничего не запрашивается и не оплачивается. `[скриншот или короткий ролик с подписью «demo data»]`
>
> **Что ещё не сделано.** Через Telegraph покупается только один вход. Запросы про хешпрайс и ERCOT вернули пустые значения (сырые ответы в `docs/evidence/`), поэтому хешпрайс считаем сами, а цена электричества — из открытого европейского источника; оба помечены на экране. Ни один оператор пока не пользовался. Только тестовая сеть; `[TESTS]` автотестов проходят.
>
> **Где нужна помощь.** (1) Майнер или форма параметров, которые на devnode возвращают хешпрайс и цены ERCOT. (2) Два-три человека с майнинг-железом или хостингом, которые скажут, в чём решение ошибается. (3) Кто-нибудь, кто пройдёт `docs/JUDGE.md` (около пяти минут, кошелёк не нужен) и скажет, где ломается.

**Перед публикацией проверить:** (1) числа пересчитаны скриптом в день публикации; (2) ссылки открываются (`curl -sIL` — 200); (3) пока нет реальных пользователей — фразу «No operator has used it yet» оставить; если появится человек, оставивший публичный след, писать только то, что он сам написал, со ссылкой; (4) демо-день везде подписан «demo data».

### В. Пост в X (≈20 ноября; нужен аккаунт владельца и его «да»)

> Building Hash or Lease for @Telegraphprotoc Season II (Mission 12, Mining and Power; hackathon entry, prizes at stake). An agent that decides every hour whether a Bitcoin miner should mine, lease power to AI or switch off, and pays for its market data itself over x402 on Sepolia. A receipt under every number. Testnet. Repo and demo: https://github.com/Guryevmn/hashorlease

### Г. ~26 ноября — инструкция «как агент сам платит за данные»

План (≈600 слов + код-фрагмент): проблема → запрос `POST /engine/v1/ask` и ответ 402 → оплата через `@x402/fetch` → чек (провайдер, `signal_hash`, транзакция) → потолок на платёж и дневной лимит под блокировкой → что делать, если ответ пустой. Опубликовать в `#showcase` (ответом в нашей ветке) и на внешней площадке (X, GitHub-статья или блог): баллы дают за выход за пределы Discord.

---

## Что нужно решить владельцу

1. ~~**Заметка для 14 ноября** (текст А)~~ — опубликована 12.11 в 19:52 МСК в `#hackathon`; это первое из трёх обновлений.
2. **Ветка в `#showcase`** 20 ноября и **пост в X** — согласен ли, и есть ли аккаунт X для постов?
3. **Вопрос организаторам** про пустые значения: он уже внутри текста А, отдельно писать не нужно.
4. ~~**Токен бота** и **выкладка демо**~~ — сделано (бот @hashorlease_bot работает, демо https://hashorlease.vercel.app).
5. **Отправка свежих журналов на GitHub** — «да» до 20 ноября.

## Технические детали

- Источники чисел (пересчитано скриптом 16.11, 21:00 UTC): `data/agent/live/runs.jsonl` (146 из 147 слотов 10.11 18:00 — 16.11 20:00 UTC; подряд 102 ч с 12.11 15:00, пропуск 12.11 14:00 UTC; в 14 часах первый запуск был с паузой, повтор в тот же час прошёл), `data/ledger.jsonl` (279 записей, из них платных 242 на $2.42), `data/agent/live/decisions.jsonl` (`changed: true` — 2 записи: 15.11 08:00 и 13:00 UTC). Пересчёт одной командой: `node scripts/recount.mjs 2026-11-16T21:00:00Z`; `npm test` — 95. Снимки на 12.11 (17:35 и 20:36 UTC) в этом файле выше оставлены как история и в публикации не идут.
- Ссылки на репозиторий, hashorlease.vercel.app и транзакцию Sepolia не открывал заново; перед публикацией проверить.
