# Hash or Lease — план действий до сдачи и готовые тексты

Составлено 2026-11-12. Ничего не опубликовано и не отправлено: каждый пост — только после «да» владельца.
Формат показов уточнён по Discord, подробности и цитаты — `docs/submission/discord-findings.md`.

## План простыми словами

Все даты — UTC; в скобках — по Москве.

| Когда | Что | Кто | Нужно от владельца |
|---|---|---|---|
| **Чт 12 нояб, вечер** | Решить по заметке для 14 ноября (текст ниже, А) | владелец | «да» / правки |
| **Пт 13 нояб** | Опубликовать заметку в Discord-канал `#hackathon`, приложить 2 скриншота | сессия по «да» | «да» на публикацию |
| **Пт 14 нояб** | Проверка интеграции. Следить за ответом организаторов на наш вопрос (ERCOT и хешprice пустые) | сессия | — |
| до 15 нояб | Токен Telegram-бота (шаги — в `demo-plan.md`, пункт 3) | владелец | вставить токен в `.env`, написать «токен вставил» |
| до 17 нояб | Решить: выложить демо в интернет на выдуманных данных (уже есть: hashorlease.vercel.app) | владелец | «да/нет» |
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

**Что готово сейчас (проверено 12 ноября, 10:27 UTC):**
- [x] Агент работает (запущен ~7 часов назад, перезапуск без потери истории); подряд 41 час с покупкой каждый час, с 10 ноября 18:00 UTC; платежи на Sepolia. Всего в журнале 169 платных запросов на $1.36 тестовых денег (часть — разработка).
- [x] Живое решение за это время ни разу не менялось (мир с ценой электричества $189–610/МВт·ч). Мы об этом честно говорим и показываем «Демо-день» как симуляцию.
- [x] Тексты 14 и 20 ноября, сценарий ролика, текст заявки — в этой папке.
- [ ] Бот Telegram не проверен в настоящем Telegram (нет токена).
- [ ] Сторонних пользователей ноль.
- [ ] Свежие журналы агента не лежат в репозитории (в `docs/evidence/` только 9 ноября): нужна отправка на GitHub, только с «да».

**Риск по нашему интенту:** участник NFT KING написал (12 ноября), что компараторы `GRID_POWER_PRICE` с 3 ноября висят в «pending». Ответа организаторов нет. У нас та же проблема с пустыми значениями, поэтому наш вопрос в заметке 14 ноября уместен.

**Чего я не знаю:** будет ли у 20 ноября живой созвон (на сайте и в Discord об этом не сказано; если появится объявление, поменяем формат); во сколько UTC закрывается приём заметок 14 ноября (нигде не указано).

---

## Тексты (English, для публикации — только с «да»)

### А. 14 ноября — Discord, канал `#hackathon`

Вложения: `docs/shots/site-detail-receipt.png`, `docs/shots/sites.png`.
Перед публикацией обновить число часов (сейчас 41).

> **Hash or Lease — Mission 12, Mining and Power (Apps & Agents)**
> Hourly allocation call per mining site: Mine / Lease to AI / Switch off, with a receipt under every input.
>
> **Integration: working.** An hourly agent buys `CRYPTO_PRICE_USD` from the devnode over x402 (test USDC, Ethereum Sepolia) with no human in the loop, and makes no call without a fresh receipt. It has run 41 hours in a row at one purchase per hour. Example payment: https://sepolia.etherscan.io/tx/0x1c3bc795d2cf6d7eb66949a98ebf173d2f59545b7023597f5d363a48829a76df
>
> **Blocker.** `MINING_HASHPRICE_VERIFY_GENERAL` and `GRID_POWER_PRICE_GENERAL` (`HB_HOUSTON`, `HB_WEST`) settle and return receipts, but the value fields are `null` / `missing`. The hashprice request is routed to a pool-statistics miner, the ERCOT requests to a CAISO grid miner. Raw answers are in the repo under `docs/evidence/`. Until this changes we compute hashprice ourselves and use public European day-ahead prices, and label both on screen as not bought via Telegraph.
>
> **Question.** Is there a parameter form or a miner that returns values for ERCOT hubs and for hashprice on the devnode?
>
> Repo and reviewer guide: https://github.com/Guryevmn/hashorlease (`docs/JUDGE.md`). Demo mode runs in five minutes, no wallet. Testnet only. Hackathon entry, Season II.

(Перед публикацией проверить: ссылка на репозиторий открывается публично; число часов актуально.)

### Б. 20 ноября — форум `#showcase`, новая ветка

Категория: **Apps & Agents**. Заголовок: `Hash or Lease (Mission 12): mine, lease to AI or switch off — with a receipt per number`

> **What it is.** An hourly agent for Bitcoin miners. For each site it calls Mine / Lease to AI / Switch off, shows the gain in $/h, and puts a source under every input number: a Telegraph receipt, a labelled public source, or your own input.
>
> **Telegraph, for real.** The agent pays for `CRYPTO_PRICE_USD` itself over x402 (test USDC, Sepolia), one cent an hour for all sites, and stops at a daily limit. No fresh receipt, no call — it logs a pause. Running for `[N]` hours in a row. Example payment: `[Sepolia link]`.
>
> **Simulated day (demo data, not live).** In our live week the call never changed, because power was too expensive for mining. So there is a simulated day on an invented site where the call changes twice, each time with the reason: `/demo-day` in the repo (https://hashorlease.vercel.app/demo-day). `[screenshot or short video]`
>
> **What is not done.** Only one input is bought through Telegraph. Hashprice and ERCOT intents came back empty (raw answers in `docs/evidence/`). No operator has used it yet. Testnet only.
>
> **Where we need help.** (1) A miner that returns hashprice and ERCOT hub prices on the devnode. (2) Two or three people who run mining hardware or hosting to tell us what the call gets wrong. (3) Anyone to follow `docs/JUDGE.md` and tell us where it breaks.
>
> Repo: https://github.com/Guryevmn/hashorlease · Demo (invented data): https://hashorlease.vercel.app

### В. Пост в X (≈20 ноября; нужен аккаунт владельца и его «да»)

> Building Hash or Lease for @Telegraphprotoc Season II (Mission 12, Mining and Power; hackathon entry, prizes at stake). An agent that decides every hour whether a Bitcoin miner should mine, lease power to AI or switch off, and pays for its market data itself over x402 on Sepolia. A receipt under every number. Testnet. Repo and demo: https://github.com/Guryevmn/hashorlease

### Г. ~26 ноября — инструкция «как агент сам платит за данные»

План (≈600 слов + код-фрагмент): проблема → запрос `POST /engine/v1/ask` и ответ 402 → оплата через `@x402/fetch` → чек (провайдер, `signal_hash`, транзакция) → потолок на платёж и дневной лимит под блокировкой → что делать, если ответ пустой. Опубликовать в `#showcase` (ответом в нашей ветке) и на внешней площадке (X, GitHub-статья или блог): баллы дают за выход за пределы Discord.

---

## Что нужно решить владельцу

1. **Заметка для 14 ноября** (текст А) — публиковать завтра (13 ноября) в `#hackathon`? Рекомендую «да»: это и отметка прогресса, и первое из трёх обновлений.
2. **Ветка в `#showcase`** 20 ноября и **пост в X** — согласен ли, и есть ли аккаунт X для постов?
3. **Вопрос организаторам** про пустые значения: он уже внутри текста А, отдельно писать не нужно.
4. **Токен бота** и **выкладка демо** (сроки в таблице).
5. **Отправка свежих журналов на GitHub** — «да» до 20 ноября.

## Технические детали

- Источники чисел: `data/agent/live/runs.jsonl` (подряд 41 час: 2026-11-10T18:00Z — 2026-11-12T10:00Z; 8 пауз: 7 в ночь на 10 ноября во время ранних тестов и одна 11 ноября 21:00Z), `data/ledger.jsonl` (169 записей, $1.36).
- Ссылки на репозиторий, hashorlease.vercel.app и транзакцию Sepolia не открывал заново; перед публикацией проверить.
