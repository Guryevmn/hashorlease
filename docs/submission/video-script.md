# Hash or Lease — demo video script

> **Резюме для владельца (по-русски).** Сценарий ролика на 2 минуты 35 секунд: 9 кадров, для каждого — что на экране и что говорим. Правила требуют ролик от 2 до 5 минут, поэтому короче 2:00 делать нельзя — запас заложен.
> Два кадра можно закрыть готовыми снимками из `docs/shots/`, остальные семь нужно записать с живого приложения; список — в конце. Запись одного кадра стоит 1 цент тестовых денег.

Status: draft. Nothing has been recorded or published.

**What the rules require** (https://hackathon.telegraphprotocol.com/rules §8, checked 2026-11-12): "a 2–5 minute video or accessible equivalent showing the real input, result, and Telegraph integration"; screen recordings are fine. The rules suggest — but do not require — this flow: problem → Telegraph request → intelligence and provider evidence → observed cost → completed result → how to try it. The script follows it.

**Format:** screen recording, 1280×900 window, live mode on testnet. English voiceover, about 255 words — unhurried at this length. Burn in English captions: they make the video an "accessible equivalent" and carry it if the sound is off.

**One rule for the narrator:** read the numbers that are on screen on recording day. The numbers below are from 9–11 November and will differ.

---

## Shot list

| # | Time | On screen | Voiceover |
|---|---|---|---|
| 1 | 0:00–0:12 | **Places**, live mode, top of the page: the "Testnet · no real money" badge, the "Live data" strip, the total "+$… /h". Hold still. *Fallback still: `docs/shots/sites.png`.* | "Every megawatt a Bitcoin miner controls is an hourly choice: mine, lease the power to AI, or switch off. Today that choice lives in spreadsheets." |
| 2 | 0:12–0:30 | Same screen, slow scroll down the three site cards: Leipzig Hub — Lease to AI; Silesia Farm — Switch off; My tariff (garage) — Keep as is. Pause on each badge. | "Hash or Lease makes that call every hour, for every site, in dollars. Right now: Leipzig — lease to AI. Silesia — switch off. The small rig on a fixed tariff — keep as is." |
| 3 | 0:30–0:50 | Click **Leipzig Hub**. Place detail: the three option tiles in $/MWh, then scroll to **"Where the numbers come from"** and the **Formula** lines. | "Open a site and the math is on the table. Mining revenue, power price, lease rate. Three options in dollars per megawatt-hour, and the formula that picked one." |
| 4 | 0:50–1:15 | Click the green ✓ next to **Mining revenue**. The receipt opens: Service `CRYPTO_PRICE_USD`, Provider, Fetched, Request cost `$0.010 USDC · testnet`, Receipt hash. Click **View payment on Sepolia ↗** — the etherscan page with "Success". Back to the app. *Fallback still for the receipt: `docs/shots/site-detail-receipt.png`.* | "Every number says where it came from. This one was bought through Telegraph: the service, the provider that answered, the time, the cost — one cent of test USDC — and the payment itself, settled on Sepolia." |
| 5 | 1:15–1:28 | Close the receipt. Hover the globe icon next to **Power price**: "Public source, not bought via Telegraph". | "The power price is a free public source, and it is labelled that way. We don't dress it up as a Telegraph purchase." |
| 6 | 1:28–1:50 | Terminal, clean prompt: `npm run agent -- --once --fresh`. The log prints the cycle line, three sites with receipts, `paid requests 1`. Cut the wait. Then **Usage** → the "Hourly agent" card and the "Paid requests" table. | "And nobody clicks 'buy'. An agent wakes up every hour, pays Telegraph itself over x402, decides for every site, and logs the receipts. It has run `[27]` hours in a row, for about a cent an hour." |
| 7 | 1:50–2:10 | Terminal: `DAILY_SPEND_LIMIT_USD=0 npm run agent -- --mode=live --once --fresh`. The log shows "⛔ Daily spend limit reached" and "Paused · daily limit" for each site, `paid requests 0`. Then **History**: the hour marked "Paused · daily limit". | "Its budget is hard-capped. At the daily limit it stops before paying. And with no fresh receipt it makes no call — it records a pause, not a guess." |
| 8 | 2:10–2:22 | **Places → + Add place**: pick France, type 500 PH/s, 10 MW, 20 J/TH, **Add place**. The new site opens with its call. Speed up the typing ×2. | "Adding your own site takes a minute: zone, megawatts, hashrate, lease rate." |
| 9 | 2:22–2:35 | End card on a plain background: **Hash or Lease** · `github.com/Guryevmn/hashorlease` · "Reviewer guide: docs/JUDGE.md" · "Testnet only: Telegraph devnode + Ethereum Sepolia" · "Mission 12 — Mining and Power". | "Everything here runs on testnet — no real money, no customers yet. Clone the repo and it runs in five minutes, no wallet needed. Reviewer steps are in docs/JUDGE.md." |

Total: 2:35. Do not cut below 2:05 — the minimum is 2:00.

**The `[27]` in shot 6** is the number of consecutive hours the agent decided as of 11 November. On recording day, say the real number from the "Hourly agent" card or the run log. If the run was interrupted, say "for more than a day" only if that is true, or drop the sentence.

---

## What must be recorded

All in live mode, same window size, same day if possible, so the numbers match between shots.

| # | Recording | How | Costs |
|---|---|---|---|
| R1 | Places, top and scroll (shots 1–2) | browser, `npm start` in live mode | free if the last purchase is under 30 min old |
| R2 | Place detail, options and formula (shot 3) | click Leipzig Hub, scroll | free |
| R3 | Receipt popover and the Sepolia page (shot 4) | click ✓, then "View payment on Sepolia" | free |
| R4 | Globe label on Power price (shot 5) | hover the globe icon | free |
| R5 | Terminal: one agent cycle with a purchase (shot 6) | `npm run agent -- --once --fresh` | $0.01 test USDC |
| R6 | Usage: agent card and paid requests (shot 6) | browser | free |
| R7 | Terminal: the limit run (shot 7) | `DAILY_SPEND_LIMIT_USD=0 npm run agent -- --mode=live --once --fresh` | free — no payment is attempted |
| R8 | History with the paused hour (shot 7) | browser, right after R7 | free |
| R9 | Add place, France (shot 8) | browser; delete the test site afterwards (⋯ Menu → Delete) | free |
| R10 | End card (shot 9) | a still image | free |
| R11 | Voiceover | one take per shot, or a synthetic voice from this script | — |

**Already available as stills:** `docs/shots/sites.png` (shot 1) and `docs/shots/site-detail-receipt.png` (shot 4). They are from 9 November and show "Spent today $0.92 / $1.50"; a fresh recording is better, the stills are the fallback.

**Optional tenth shot, only after the bot has run in real Telegram:** a phone with the change alert and `/now`, 8–10 seconds, placed after shot 6 with the line "When a call changes, it tells you in Telegram." Do not include it before then: the bot has not been run against Telegram.

---

## Before recording

1. The hourly agent is already running in the background. Leave it running: `--once` works next to it. But it has usually bought this hour's price already, so a plain `--once` prints `paid requests 0`. To show a purchase on camera, run R5 as `npm run agent -- --once --fresh` ($0.01 test USDC), and say "paid requests 1" only if the log says so. R7 adds one failed run to the agent's log for that hour; the hour's real call stays.
2. Record R7 (the limit) **after** R1–R6: it leaves "Paused" hours in History, which belong in shot 7 and not in shot 1.
3. Set the day's limit with headroom in the morning; every forced refresh costs a cent.
4. Clean frame: no `.env` on screen, a fresh terminal with a short prompt, no bookmarks bar, no other tabs, notifications off.
5. Power at $300–500/MWh looks like a mistake to a viewer who knows the market. It is real — an evening peak in the day-ahead data. If the number on screen is that high, shot 3 may add: "Power is at an evening peak tonight."
6. Watch the finished video once for secrets and for the wallet key before publishing. The wallet *address* and transaction hashes are public and fine.

## What the video deliberately does not claim

No users, no mainnet, no ERCOT, no "all inputs through Telegraph". Shot 5 says outright that the power price is not a Telegraph purchase, and shot 9 says "no customers yet". This matches `application.md` and the "accurate claims" requirement in rules §5.
