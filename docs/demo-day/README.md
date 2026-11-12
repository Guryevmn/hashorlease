# Demo day — a simulated day on which the call changes

**Everything in this folder and on the `/demo-day` screen is demo data.** The site is invented, the prices are invented, the hours are simulated. No Telegraph request is made, nothing is paid, there are no receipts. It exists for one reason: in our live run (10–12 November 2026) power stayed at $189–610/MWh and no call ever changed, so there was nothing to show of the moment a call flips. Real calls and real receipts are in `docs/evidence/`.

## What it shows

One site, **Solar Ridge (demo)**: 15 MW, 1000 PH/s, 15 J/TH, an AI tenant paying $75/MWh who also pays for power, $8/MWh overhead, "keep as is" threshold $5/MWh. One day of 24 hourly prices. Each hour goes through the same agent cycle as a live hour (`src/lib/agent/cycle.ts`) and the same decision logic.

| Simulated UTC | Call | Why |
|---|---|---|
| 00:00–10:00 | Lease to AI | power $41–171/MWh; the lease pays $67/MWh, mining less |
| 10:00 | Lease to AI, *keep as is* | mining is ahead by $2.06/MWh — under the $5 threshold |
| **11:00** | **Lease to AI → Mine** | power fell from $28 to $21/MWh; mining now beats the lease by $9.11/MWh |
| 14:00–15:00 | Mine, *keep as is* | the gap is under $5/MWh either way |
| **16:00** | **Mine → Lease to AI** | power rose from $33 to $124/MWh; the lease now beats mining by $93.50/MWh |
| 16:00–24:00 | Lease to AI | evening peak up to $236/MWh |

The call changes when the power price crosses about **$30/MWh**: mining income of about $97/MWh minus the $67/MWh the lease pays.

## Where to see it

- **Screen:** `/demo-day` (link "See a call change" at the bottom of Places). Play button — the day in 2 minutes or in 24 seconds; hour-by-hour tape with the reason; changed hours highlighted; preview of the bot alert; the journal record of the hour. `?hour=16` opens a given hour.
- **Terminal:** `npm run demo:day` (2 minutes), `npm run demo:day -- --speed=0` (at once). Writes the journal to `data/agent/demo/`.
- **Telegram bot:** `/demo` replays the day into the chat: intro, both change alerts, the day at a glance. Every message starts with 🧪 and says it is demo data. *(Message texts are tested; the bot has not been run against Telegram.)*
- **Journal:** `decisions.jsonl` in this folder — the 24 records of the day, the same format as the live journal (`docs/evidence/agent-decisions.jsonl`) plus the `why` line. A test keeps this file equal to what the simulation produces. Download from a running app: `/api/demo-day`.

## How demo data is kept apart from real data

- Every demo number has receipt status `demo` (not `verified`, not `public`): no hash, no proof link, cost 0, source text starting with "Demo day: invented".
- Every journal record has `"mode":"demo"` and the site name ends with "(demo)".
- The demo journal has its own folder, `data/agent/demo/`; the live journal is `data/agent/live/`. The demo run rewrites only its own folder.
- The agent refuses a demo number outside demo mode: in live or mock mode it records a pause, not a call.
- The screen carries the "Demo data" badge and a yellow strip even when the rest of the app runs in live mode, and in live mode it does not load the market snapshot (so it can never trigger a paid request).
- All of the above is covered by tests in `src/lib/demo/day.test.ts`.

## Where the numbers come from

Invented, but of a real order of magnitude, checked against data the project already had:

| Demo number | Value | Real reference |
|---|---|---|
| Power price | $18–236/MWh, a low-price day with a midday solar dip | Energy-Charts day-ahead, 11 Oct – 12 Nov 2026, as cached by the app: median by hour $193–319/MWh (FR); hours under $30/MWh were 4.8% (FR) and 4.7% (DE-LU) of the month; the lowest decile at 11:00–14:00 UTC in FR was $21–29/MWh |
| BTC price | $73,310–74,020 | $73,544 bought through Telegraph on 12 Nov 2026 |
| Hashprice | $34.81–35.15 /PH/day (144 blocks × 3.149 BTC × price ÷ 955 EH/s) | $34.48–35.53 in the live agent journal, 9–12 Nov |
| Fleet | 15 J/TH | current-generation machines; the live examples use 20–38 J/TH |
| Lease | $75/MWh, power paid by the tenant | the project's other examples use $70–120/MWh |

The demo day is deliberately cheaper than a typical day of that month: on a typical day power never came near $30/MWh, which is exactly why the live call did not change. With a 20 J/TH fleet and a $120/MWh lease (the live Leipzig example) the call would not change on this profile either.
