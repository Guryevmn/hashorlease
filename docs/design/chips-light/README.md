# Chips, light (branch agent/chips-light)

Feedback (17.11, History at 390): the chips are too heavy and cramped; make them lighter and maybe smaller.

What changed (one chip style for the whole app, `.badge` in `globals.css`):
- **Size**: height 28 → 24 px, padding 0/10 → 0/8, text 13 px Semibold (600) → 12 px Medium (500), icon 14 → 12 px (power glyph 13 → 11 px). New tokens: `--chip-h`, `--t-chip`, `--lh-chip`.
- **Decision chip** (Mine / Lease to AI / Switch off) keeps its color pair, only the weight drops to Medium.
- **Secondary chips are quieter**: Demo · testnet, Testnet, Spent today, Keep as is, Agent call, Set on the server get a softer fill and lower contrast; the Mine/Lease/Off option chips and "was …" have a lighter outline (the line color) and a softer label.
- **Air**: header gap 8 → 12 px; hour row (time · place · chip) gap 8 → 12 px; demo-day tape row 12 px between chips and text; option strip caption gets 4 px more before the first chip; the card's chip stack keeps 8 px.
- The Spent chip in the header is a link: it keeps a 44 px tap target through an invisible hit area.

Pairs (`pairs/`, before above or left, after below or right):
- `01-390-header.png`, `02-390-site-card.png`, `03-390-history-changes-only.png`: phone, 390 px (2x).
- `04-1440-header.png`, `05-1440-site-card.png`, `06-1440-history-changes-only.png`: desktop, 1440 px.

Checked: no horizontal scroll at 390 on Places, place page, History and Usage (`scrollWidth - innerWidth = 0`); measured chip in the browser: 24 px high, 8 px padding, 12 px, weight 500, icon 12 px.
How it was shot: demo mode, headless Chrome, 390 px (2x) and 1440 px; History in 7 d with Changes only on.
