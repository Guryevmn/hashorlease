# Hash or Lease — screen descriptions for Figma

For the designer. Explanations are in English, and so is the interface text (the hackathon judges read English).
Source of logic and data: `docs/PLAN.md`. All numbers below are **made-up examples**, not real network data.

## 0. Common to all screens

### The product in a nutshell
Once an hour the app decides for each site (farm): **Mine** / **Lease to AI** (lease the power capacity to AI compute) / **Switch off**. A decision has an amount in $/h, and every input number has a Telegraph "receipt" (proof that the data was bought, and from where).
The user is a farm operator. The second segment is a miner on a fixed tariff ("My tariff").

### The three decisions — one visual language
- **Mine** — one combination of color + icon + word (for example, green, a chip icon).
- **Lease to AI** — a different color + icon (for example, blue/purple, a server/brain icon).
- **Switch off** — neutral gray + a power icon.
- **Keep as is** — not a fourth decision but a note: "the difference is below the threshold, we don't touch the equipment". Drawn as a badge next to the current decision (for example, "Mine · keep as is"), not as a separate color.
- Color is never the only carrier of meaning (always a word + an icon).

### Example data (used on all screens)
Market numbers "now", 8 Nov, 14:00 UTC (example):
- Hashprice (BTC): **$38.50 /PH/day**
- ERCOT Houston hub (HB_HOUSTON): real-time **$32.40 /MWh**, day-ahead **$29.80 /MWh**
- ERCOT North hub (HB_NORTH): real-time **$74.10 /MWh** (evening spike), day-ahead $58.00
- AI lease rate guide (WEB_SEARCH): "$70–100 /MWh" — a hint only; the operator enters the rate.

Sites:
1. **Houston Hub** — ERCOT HB_HOUSTON, 20 MW, 1,000 PH/s, 20 J/TH, AI lease rate $95 /MWh (we pay for the power, so we subtract it), overhead $8/MWh.
   - Mine: 38.50 × 50 PH/s per MW ÷ 24 = $80.20 gross − $32.40 = **+$47.80 /MWh**
   - Lease to AI: 95 − 32.40 − 8 = **+$54.60 /MWh**
   - Switch off: $0
   - Result: **Lease to AI**, gain over mining +$6.80/MWh × 20 MW = **+$136 /h**
2. **North Ridge** — ERCOT HB_NORTH, 12 MW, 480 PH/s, 25 J/TH, AI rate $70, overhead $8.
   - Mine: 38.50 × 40 ÷ 24 = $64.17 − 74.10 = **−$9.93 /MWh**
   - Lease to AI: 70 − 74.10 − 8 = **−$12.10 /MWh**
   - Result: **Switch off**, savings over mining $9.93 × 12 = **$119 /h**
3. **My tariff (garage)** — fixed tariff $0.040/kWh = $40 /MWh, 0.015 MW (15 kW), 0.39 PH/s, 38 J/TH. No AI lease.
   - Mine: 38.50 × 26.3 ÷ 24 = $42.20 − 40 = **+$2.20 /MWh** (≈ $0.03 /h)
   - Switch off: $0
   - Result: difference 2.20 < threshold 5.00 → **Mine · keep as is**
   - Here the power price is not from the grid (the tariff is entered manually) → this number has no receipt; it gets a "Your input" badge instead.

The default "keep as is" threshold is **$5 /MWh** (configurable).

### Telegraph receipt next to a number (shared "Receipt chip" component)
> ⚠️ The exact receipt format will be known after the first paid request (stage E1, needs the user's "yes"). Below is a working hypothesis based on the mission page: a short hash like `0x6269…9bd0` and miner numbers. The design must survive field changes.

The component comes in two forms:
- **Collapsed (next to the number):** a small check icon + "Receipt · 14:00 UTC". Tap/click expands it.
- **Expanded (popover or bottom sheet):**
  - Service: `GRID_POWER_PRICE`
  - Provider (miner): `m-1f3` (the miner's rank/ID — as it is called in the response, to be confirmed)
  - Fetched: `8 Nov 2026, 14:00:07 UTC` · "4 min ago"
  - Request cost: `$0.010 USDC` · testnet
  - Receipt: `0x55f8…e138` + a copy button
  - Link: "View proof ↗" — a link to the confirmation (where it leads will be known after the first request)
  - Data source, if returned: "ERCOT, real-time LMP"

Receipt state variants:
- **Verified** — all fine (check mark).
- **Stale** — the data is more than N minutes old (yellow dot, "Fetched 3 h ago").
- **Unavailable** — the request failed, we show the last known value (gray icon, hint "Using last receipt").
- **Your input** — the number was entered manually, no receipt (no check mark, a different person icon).
- **Testnet** — a permanent small "testnet" note in the receipt and in the app header (honesty toward the judges).

### Common states (apply on every screen)
- **Loading** — a skeleton in place of the numbers, not a full-screen spinner. Show the decision only when all three inputs are received; while waiting — "Calculating…".
- **Empty** — each screen has its own text (see below), always with one clear button.
- **Network / provider error** — not a white screen. A banner at the top: "Can't reach Telegraph. Showing the last decision from 13:00." The old numbers stay but are marked Stale; a "Retry" button. If only one provider fails: "Grid price unavailable for North Ridge — decision paused" (we do not issue a decision for that site, so as not to mislead).
- **Spend limit reached** — a global yellow banner on all screens: "Daily spend limit reached ($1.00). Decisions are frozen until 00:00 UTC." Buttons: "Raise limit" (leads to Spend), "Dismiss". Sites show the last decision with a Stale badge instead of disappearing.
- **Close call ("Keep as is")** — the options are close: a "Keep as is" badge, caption "Difference $2.20/MWh is below your $5.00 threshold". Do not use an alarming color — this is a calm state.
- **Testnet** — a permanent badge in the header: "Testnet · no real money".

---

## 1. Sites

**Goal:** show the current decision for each site and what it is worth.
**The user's main question:** "What should I do with each farm right now?"

### Blocks, top to bottom
1. **Header:** the "Hash or Lease" logo, a `Testnet` badge, on the right a spend indicator "Spent today $0.42 / $1.00" (tap → Spend screen).
2. **Market summary (narrow strip):** `Hashprice $38.50 /PH/day` · `ERCOT Houston $32.40 /MWh` · `Updated 14:00 UTC` — each number has a small Receipt chip.
3. **Heading and total:** "Right now" and, large, "+$136 /h vs. mining everything" — the total gain from the advice compared with "mine everywhere" (sum across sites: 136 + 119 + 0 ≈ **+$255 /h**; we show the total, optionally with a footnote).
4. **List of site cards** (one per site):
   - **Houston Hub** · ERCOT Houston · 20 MW
     - Decision: **Lease to AI** (large)
     - **+$136 /h** vs. mining · "Updated 14:00 UTC"
     - Small: "Mine +$47.80 · Lease +$54.60 · Off $0 /MWh"
     - Chevron → Site screen.
   - **North Ridge** · ERCOT North · 12 MW — **Switch off** · "saves $119 /h vs. mining" · small "Power $74.10 /MWh is above mining revenue $64.17".
   - **My tariff (garage)** · Fixed rate $0.040/kWh · 15 kW — **Mine · keep as is** · "+$0.03 /h" · "Below $5.00 threshold".
   - If the decision changed this hour — a dot indicator and the line "Changed from Mine · 14:00".
5. **"Add site" button** (floating or at the end of the list).

### States
- **Loading:** three skeleton cards; gray bars in the summary.
- **Empty (no sites):** an illustration, the heading "No sites yet", the text "Add a site to get an hourly Mine / Lease / Switch off call with receipts." Buttons: "Add site", and a secondary "Try demo data" (if we decide to build a demo — see the questions).
- **Network error:** a banner + cards with a Stale mark.
- **Spend limit:** a banner, cards Stale.
- **Close calls:** card 3 (see above).

---

## 2. Site detail (a site with breakdown and receipts)

**Goal:** show why exactly this decision was made, and give proof under every number.
**Main question:** "Why this one, and can I trust it?"

### Blocks, top to bottom (using Houston Hub as the example)
1. **Navigation:** ← Sites · the name "Houston Hub" · a menu (Edit, Delete).
2. **Decision:** large "Lease to AI", next to it "+$54.60 /MWh" and "+$136 /h vs. mining". Caption "Call for 14:00–15:00 UTC · based on data fetched 14:00".
3. **Comparison of the three options** (three horizontal bars or three cards, the winner highlighted):
   - Mine **+$47.80** /MWh
   - Lease to AI **+$54.60** /MWh ← chosen
   - Switch off **$0**
   Below them — the threshold: "Next best is $6.80 ahead. Threshold: $5.00".
4. **"Where the numbers come from" breakdown** — line by line, each line has a Receipt chip:
   - **Mining revenue:** `$80.20 /MWh` = `Hashprice $38.50 /PH/day` × `50 PH/s per MW` ÷ 24. Receipt: `MINING_HASHPRICE_VERIFY`, m-d9d, 14:00:03, $0.010, `0x6269…9bd0`.
   - **Power price:** `$32.40 /MWh` — "ERCOT HB_HOUSTON, real-time LMP". Next to it day-ahead `$29.80` (small, trend arrow). Receipt: `GRID_POWER_PRICE`, m-1f3, 14:00:07, $0.010, `0x55f8…e138`.
   - **AI lease rate:** `$95 /MWh` — "Your input". Next to it a guide: "Market guide $70–100 /MWh" with a `WEB_SEARCH` receipt, m-080, 13:02, $0.010, `0xb5cf…c607` and the caption "Estimate only, not a quote".
   - **Overhead:** `$8 /MWh` — Your input.
   - **Final formula** as one line: `95 − 32.40 − 8 = 54.60`.
5. **"Proof" block:** "This call used 3 paid requests · 3 receipts · total $0.030" and a "Copy audit summary" button (for the judges: all receipts and the total as one text).
6. **24-hour mini chart:** power price by hour (a line) + the decision by hour (colored strips underneath). A placeholder chart is acceptable.
7. **Buttons:** "Refresh now ($0.02)" — shows the price in advance; "Edit site".

### States
- **Loading:** skeleton rows in the breakdown; "Calculating…".
- **Empty:** you cannot get here without a site; if a site was just added and has no data yet — "Fetching first call…" and progress over the three requests (1/3, 2/3, 3/3).
- **Provider error:** the problem row is highlighted: "Power price unavailable (provider timeout)", receipt Unavailable; the decision is replaced by "Paused — can't decide without power price" + "Retry".
- **Spend limit:** "Refresh now" is disabled, caption "Daily limit reached".
- **Close calls:** in block 3 the threshold is highlighted: "Mine +$47.80 vs. Lease +$46.00 — within $5.00 → Keep as is (currently Mine)".
- **AI rate not entered:** the row "AI lease rate — not set", the Lease option is grayed out, hint "Add a rate to compare leasing".

---

## 3. What-if feed

**Goal:** show the hourly history of decisions and how much money was lost (or saved) when the advice was not followed.
**Main question:** "How much would I have earned if I had listened, and how much did I miss?"

### Blocks, top to bottom
1. **Filters:** site selection (All sites / Houston Hub / …), period (24 h / 7 d / 30 d).
2. **Summary for the period (3 numbers):**
   - "Followed advice: 19 of 24 hours"
   - "Missed gain: **$1,420**" — the gain missed when the operator was in a different mode than the advice
   - "Avoided loss: $310" — when the advice was followed (compared with "always mine")
   Where we get the "actual mode" from is a question for design/product (a manual mark or telemetry data, see the questions).
3. **Hourly feed** (newest on top), a row = an hour:
   - `14:00` · **Lease to AI** (advice) · "You: Mine" · `Missed +$136`
   - `13:00` · **Lease to AI** · "You: Lease to AI" · `On target`
   - `12:00` · **Switch off** (North Ridge) · "You: Mine" · `Missed −$119 loss`
   - `11:00` · **Mine · keep as is** · "You: Mine" · `On target`
   Each row has a Receipt chip (expands all the receipts of that hour) and an "Open breakdown" link.
4. **Grouping by day** with the day's total in the heading ("Yesterday · missed $412").
5. **"Mark what you did" button** — set the actual mode for an hour (if we decide on a manual mark).

### States
- **Loading:** skeleton rows.
- **Empty:** "No history yet. The first call appears after the next full hour." (no button, or "Add site").
- **Network error:** the history from local storage stays; a banner about updates being unavailable.
- **Spend limit:** a gray row appears in the feed, "Paused 09:00–12:00 · daily limit"; an hour without a decision is visible in the history, not hidden.
- **Close calls:** "Keep as is" rows do not count as missed gain; the badge is neutral.

---

## 4. Spend

**Goal:** show how much was spent on requests, and let the user manage the daily limit.
**Main question:** "How much money goes to data, and will it run away to infinity?"

### Blocks, top to bottom
1. **Limit indicator:** large "$0.42 of $1.00 today" + a progress bar; "Resets at 00:00 UTC"; a Testnet badge: "Paid in test USDC".
2. **Limit setting:** a "Daily limit" field ($1.00), a "Stop when limit reached" switch (on by default and cannot be turned off without confirmation), an "Alert at 80%" field.
3. **Forecast:** "At this pace: $0.73 per day" and the caption "2 sites × 24 grid price + 24 hashprice + 1 web search, ~$0.01 each (estimate)".
4. **Breakdown by service:**
   - `MINING_HASHPRICE_VERIFY` · 24 requests · $0.24
   - `GRID_POWER_PRICE` · 17 requests · $0.17
   - `WEB_SEARCH` · 1 request · $0.01
   A bar for each row.
5. **Request log** (newest on top): time · service · site · provider (m-1f3) · price · status (Paid / Failed / Blocked by limit) · receipt hash `0x55f8…e138` · "View proof ↗".
6. **"Export CSV" button** (handy for the judges; decide whether it is needed).

### States
- **Loading:** skeleton of the indicator and the log.
- **Empty:** "No requests yet. Spending starts when your first site makes its first call." The limit and settings are available.
- **Error:** "Can't load spend history" + Retry; the limit itself keeps working on the server — hint "Limit is still enforced".
- **Limit exceeded:** the indicator is red, 100%, heading "Limit reached", caption "Agent paused. Next calls at 00:00 UTC." Buttons "Raise limit", "Resume tomorrow". In the log, requests with the status "Blocked by limit" (gray).
- **Close calls:** not applicable.
- **Failed paid request:** the row "Failed · refunded?" — whether we pay for failed requests will be known after the first request.

---

## 5. Add site

**Goal:** create a site so that a decision can be made without guessing.
**Main question:** "What does the app need to know about my farm?"

### Blocks (a form, one column; on desktop a modal variant is acceptable)
1. **Site type** (a two-way switch):
   - **Grid node** — "Pay the hourly market price" (default)
   - **My tariff** — "I pay a fixed rate"
2. **If Grid node — Power source:**
   - A search field: "Search node, hub or region" → example: `ERCOT Houston hub (HB_HOUSTON)`; quick chips: Houston hub, North hub, West hub.
   - Hint caption: "Availability depends on the data network. Other regions (PJM, CAISO, Europe) may not be covered yet." ⚠️ The list of regions will be known after the first paid request — the design must handle both a short and a long list.
   - **If My tariff:** a `Rate` field ($/kWh or $/MWh with a unit switch), example `0.040 $/kWh = $40 /MWh`, optionally "Time-of-use hours" (not in the MVP).
3. **Name:** "Site name" (for example, Houston Hub).
4. **Fleet:**
   - `Fleet hashrate` — `1000 PH/s`
   - `Power draw` — `20 MW`
   - `Efficiency` — `20 J/TH`
   Auto-calculation under the fields: "≈ 50 PH/s per MW". Hint: any two of the three are enough — the third is computed (ask the designer whether to show this).
5. **AI lease** (optional block, collapsible):
   - `Lease rate` — `$95 /MWh`
   - Checkbox "Power is included in this rate (we won't subtract the power price)": if checked, the rate already includes electricity, and the power price is not subtracted from it
   - `Overhead` — `$8 /MWh`
   - A "See market guide" link — shows the WEB_SEARCH guide (a paid request, the price next to it: "$0.01").
6. **"Keep as is" threshold:** `Threshold — $5 /MWh` with the explanation "Don't switch if the gain is smaller than this."
7. **Buttons:** "Add site" (primary), "Cancel". Next to them a price warning: "Adding a site makes ~24 paid requests per day (≈ $0.24)."

### States
- **Loading:** while searching for a node — "Searching…" in the dropdown; while saving — the button shows a loading state with the text "Fetching first call…".
- **Empty:** an empty form with examples in the placeholders.
- **Input error:** "Power draw must be greater than 0", "Efficiency looks off: 2 J/TH is below any known miner" — hints next to the field, not at the end.
- **Network error / node not found:** "We couldn't confirm this node with the data network. Check the name or use My tariff."
- **Spend limit:** when adding a site that would hit the limit: "This site would exceed your daily limit ($1.00). Raise the limit or add it later." Button "Add anyway (paused)".
- **Close calls:** not applicable.

---

## 6. Telegram bot (bot messages)

**Goal:** deliver the decision without opening the app and nudge the user when it changes.
**Main question:** "Do I need to do anything with the farm right now?"

Format: short text, no tables. Emoji are the same as the decision icons in the app. All messages are in English.

### Decision-change alert (arrives on its own)
```
🔄 Houston Hub: Mine → Lease to AI
+$136/h vs. mining · $54.60/MWh
Power $32.40 · Hashprice $38.50/PH/day
Receipts: 3 · testnet
[Open breakdown]  [Snooze 1h]
```

### The /now command (all sites by default; `/now Houston` — one)
```
Right now · 14:05 UTC
⚡ Houston Hub — Lease to AI · +$136/h
⏻ North Ridge — Switch off · saves $119/h
⛏ My tariff — Mine, keep as is · +$0.03/h
Spent today: $0.42 of $1.00
[Open app]
```
For a single site: add the Mine / Lease / Off lines in $/MWh and "Receipts: 3 · latest 14:00 UTC".

### Other
- **/start** — greeting: "I check every hour whether to mine, lease to AI, or switch off. Add a site in the app first." + an "Open app" button.
- **While there are no sites:** "No sites yet. Add one in the app to get calls here."
- **Close call (no alert):** a change without an alert; in /now the line "Mine, keep as is". Optionally a daily digest — a question for the designer.
- **Provider error:** "⚠️ North Ridge: grid price unavailable. Last call (13:00): Switch off. Retrying in 10 min."
- **Spend limit:** "⛔ Daily spend limit reached ($1.00). Calls are paused until 00:00 UTC. [Raise limit]"
- **Data request failed entirely:** "⚠️ Can't reach Telegraph. I'll keep trying and tell you when it's back."
- **Receipt in the bot:** a "Receipts" button under the message expands a list: `GRID_POWER_PRICE · m-1f3 · 14:00 UTC · $0.010 · 0x55f8…e138`. We will confirm the receipt format after the first request.

---

## Questions for the designer

Decisions were made on 2026-11-09 (the head's recommendations were accepted) and applied in code (E0-c).

1. **How to show the gain: in $/h or in $/MWh?** — ✅ Decided: large $/h, small $/MWh next to it. For sites with tiny amounts (< $1/h, for example My tariff), show $/day in large type.
2. **How much space to give receipts?** — ✅ Decided: option A. A small check mark next to each number, details on tap (a popover on desktop, a bottom sheet on phone). There is no separate "Proof" tab.
3. **"Keep as is" — a separate status or a badge?** — ✅ Decided: it stays a badge next to the decision, but is more prominent on the Sites list: a badge + the caption "Difference $X/MWh is below your $Y threshold", in a calm blue-gray color.
4. **What-if feed: how do we find out what the operator actually did?** — ✅ Decided: the operator marks the hour themselves ("Mark what you did": Followed / Did something else / Skip). Without a mark we do not count missed gain and show "Not marked". Marks are stored in the browser (`localStorage`).
5. **Do we need a demo mode on made-up data?** — ✅ Decided: keep it. The "Demo data" badge is prominent on all screens in demo mode; on an empty Sites screen there are the buttons "Add a site" and "Try demo data". In live mode (`NEXT_PUBLIC_DATA_MODE=live`) demo data is not mixed in, and there is no "Try demo data" button.
