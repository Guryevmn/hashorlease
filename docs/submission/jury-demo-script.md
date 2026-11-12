# Hash or Lease — сценарий показа жюри (демо 2–3 минуты)

> **Резюме для владельца (по-русски).** Пошаговый сценарий на 2:45: что на экране, что говорим (по-английски, 1–2 фразы), что в кадре живое, а что демо. Живое — только то, что идёт на Mac в живом режиме: платная покупка на Sepolia с чеком, журнал агента, часы работы. Выдуманное — всё на https://hashorlease.vercel.app и «Демо-день» Solar Ridge; оно всегда называется демо вслух. Внизу: запасные шаги, если что-то упало, и чек-лист за 10 минут до показа.
> Сценарий не обещает того, чего нет: пользователей нет, только тестовая сеть, через Telegraph покупается один вход, в живой работе решение пока ни разу не менялось.

Status: draft, ничего не опубликовано. Основа: `video-script.md` (ролик), `demo-plan.md` (формат A), `docs/JUDGE.md`, `docs/demo-day/README.md`. Числа на экране читаем те, что есть в день показа; цифры ниже — пересчёт `node scripts/recount.mjs` от 12.11, 20:36 UTC (49 из 50 часовых слотов, пропуск 14:00 UTC 12.11, серия 44 ч, потом 5; 145 платных запросов на $1.45 тестовых; 95 тестов) и до показа устареют.

## Что живое, что демо

| Источник | Статус | Как назвать вслух |
|---|---|---|
| Приложение на Mac, живой режим (`localhost:3000`, `NEXT_PUBLIC_DATA_MODE=live`): цена BTC, чек, платёж на Sepolia | **живое**, тестовая сеть | "live, on testnet" |
| Журнал агента (карточка «Hourly agent», «Paid requests», History) | **живое**: настоящие запуски с 10.11 | "the real run log" |
| Цена электричества и хешрейт сети в живом режиме | **живое, но не Telegraph**: открытые источники, помечены глобусом | "public source, not bought via Telegraph" |
| Ставка аренды под ИИ, накладные | вводит оператор («Your input») | "our own input" |
| Площадки Leipzig / Silesia / My tariff | примеры, не клиенты | "example sites" |
| https://hashorlease.vercel.app | **демо-данные**: плашка «Demo data on testnet», выдуманные числа и чеки, без сети | "invented data" |
| «Демо-день» Solar Ridge (`/demo-day`) | **симуляция**: выдуманная площадка и цены, тот же цикл агента, ничего не запрашивается и не платится | "a simulated day, demo data" |

## Сценарий (≈2:45)

Лимит правил для ролика — от 2:00; для живого показа можно короче, шаг 6 сокращается первым.

| Время | Что на экране | Что говорим (EN) | Живое / демо |
|---|---|---|---|
| 0:00–0:15 | Mac, живое приложение, **Places**: плашка «Testnet · no real money», полоса «Live data», итог «+$…/h», три площадки с решениями. Держим кадр. | "Every hour, for every mining site: mine, lease the power to AI, or switch off — in dollars. This is the live app on testnet." | Живое (тестовая сеть); площадки — примеры |
| 0:15–0:35 | Клик **Leipzig Hub** → три плитки $/MWh → «Where the numbers come from» → формула. | "Three options in dollars per megawatt-hour, and the formula that picked one. Every number says where it came from." | Живое; ставка аренды — наш ввод |
| 0:35–1:05 | Зелёная ✓ у **Mining revenue** → чек: `CRYPTO_PRICE_USD`, провайдер, время, `$0.010 USDC · testnet`, хеш. **View payment on Sepolia ↗** → Etherscan «Success». Запас: `docs/shots/site-detail-receipt.png`. | "This one was bought through Telegraph: the service, the provider that answered, the cost — one cent of test USDC — and the payment settled on Sepolia." | **Живое**: настоящий платёж в тестовой сети |
| 1:05–1:15 | Курсор на глобус у **Power price**: «Public source, not bought via Telegraph». | "The power price is a free public source, and it is labelled that way. Only this one input is bought through Telegraph." | Живое, не Telegraph |
| 1:15–1:45 | **Usage**: карточка «Hourly agent» и таблица «Paid requests». Читаем числа с экрана. Если есть пропуск — говорим про него. | "Nobody clicks buy. An agent has run since November 10, one purchase an hour under a daily limit. It missed one hour, when the Mac restarted. With no fresh receipt it makes no call — it logs a pause." | **Живое**: журнал агента. Числа — те, что на экране |
| 1:45–2:25 | **Demo day** (`/demo-day`, «Day in 24 s», **Play the day**). Жёлтая полоса «Demo day — invented site…» в кадре. В 11:00 зелёное «Lease to AI → Mine», в 16:00 фиолетовое «Mine → Lease to AI». Пауза на 16:00, прокрутка к «Hour by hour» и «What the Telegram bot sends». | "In our live run the call has not changed once — power was too expensive. So this is a simulated day on invented prices, marked as demo data. At eleven a midday dip makes mining win; at four the evening ramp flips it back, and the alert says why." | **Демо / симуляция** (Solar Ridge). Сказать «demo data» вслух, полосу не обрезать |
| 2:25–2:45 | Финальный кадр: репозиторий `github.com/Guryevmn/hashorlease`, `docs/JUDGE.md`, сайт https://hashorlease.vercel.app. | "Testnet only, no customers yet. Clone the repo and it runs in five minutes with no wallet; reviewer steps are in docs/JUDGE.md. The hosted demo at hashorlease.vercel.app uses invented data." | Ссылки живые; демо-сайт — выдуманные данные |

Порядок важен: **сначала настоящее (шаги 1–5), потом симуляция (шаг 6)**. Демо-день не ставить раньше чека.

Фразы, которых **нет** в сценарии и которых не говорим: «real users», «customers», «mainnet», «all inputs through Telegraph», «ERCOT works», «the call changed in live operation», «Telegram alerts delivered» (доставку сообщения в Telegram ещё не проверяли; бот @hashorlease_bot запущен, 1 подписчик).

## Если что-то упало

| Что случилось | Что делаем |
|---|---|
| Приложение показывает «Can't reach Telegraph» / «Outdated» | Не чиним в эфире. Говорим: "This is the rule working — no fresh receipt, no call." Показываем баннер и серые чеки, дальше с шага «Usage». |
| Площадка на паузе из-за источника цены электричества | Открыть другую площадку; «My tariff» от внешнего источника цены не зависит. |
| Нет интернета | Открыть демо-день (`/demo-day` в локальном `npm start` без живого режима — сети не требует) и сказать прямо: "numbers are invented". Чек показать скриншотом `docs/shots/site-detail-receipt.png`; ссылку Etherscan открыть с телефона, если есть связь. |
| `/demo-day` не открывается | Терминал: `npm run demo:day -- --speed=1` — тот же день за 24 с, оба уведомления, первая строка вывода «DEMO DATA». |
| Приложение на Mac не запускается | Скриншоты `docs/shots/sites.png`, `docs/shots/site-detail-receipt.png`, ролик (если записан), ссылка на репозиторий и https://hashorlease.vercel.app (демо-данные, сказать вслух). |
| Etherscan не грузится | Показать короткий хеш в чеке и сказать, что платёж в сети Sepolia; запасной путь проверки — `curl` из `docs/JUDGE.md` §4. |
| Бот не отвечает | Пропустить: бот в сценарий не входит, доставка не проверена. |
| Вопрос «почему только один вход через Telegraph?» | Прямой ответ: запросы про хешпрайс и ERCOT на devnode вернули пустые значения, сырые ответы лежат в репозитории (`docs/evidence/`), каждый источник на экране подписан. |
| Вопрос «это реальные пользователи?» | Нет. Пользователей пока нет, только тестовая сеть; площадки — примеры. |
| Вопрос «электричество $300–500/МВт·ч — ошибка?» | Нет, это вечерний пик day-ahead по DE-LU/PL, источник и пересчёт — `docs/JUDGE.md` §2. |

## Чек-лист за 10 минут до показа

- [ ] Mac не спит и не перезагружается: `caffeinate` под агентом работает, агент запущен (launchd). Не обновлять и не переставлять node.
- [ ] Агент: последний цикл не старше часа — свежая строка в `data/agent/live/runs.jsonl` или карточка «Hourly agent» на Usage. Запустить `node scripts/recount.mjs` и записать числа для устной части.
- [ ] Приложение в живом режиме открыто на `localhost:3000`, на экране нет баннера «Can't reach Telegraph».
- [ ] Дневной лимит с запасом: «Spent today» меньше «Limit» (лимит по умолчанию $0.50). Принудительное обновление стоит цент — на показе его не жмём.
- [ ] Чек открывается, ссылка на Sepolia открывается заранее, вкладка с Etherscan открыта.
- [ ] `/demo-day`: страница открыта, выбрано «Day in 24 s», видна жёлтая полоса.
- [ ] Вкладка с https://hashorlease.vercel.app проверена (`curl` → 200, плашка «Demo data on testnet» на месте).
- [ ] Запасное: скриншоты `docs/shots/`, терминал с `npm run demo:day -- --speed=1` готов, репозиторий открыт на `docs/JUDGE.md`.
- [ ] Чистый кадр: нет `.env` и ключей на экране, нет лишних вкладок и закладок, уведомления выключены, окно 1280×900.
- [ ] Платных запросов в ходе показа не делаем; если зависит от `--fresh` — отдельное «да» владельца.
- [ ] Сверить себя со списком «чего не говорим» выше.
