# History: calm version (branch agent/history-calm)

Feedback: the History screen on a phone was overloaded: three narrow tiles with wrapping text, a three-line explanation,
three rows of filters, and hour rows with four lines each.

What changed:
- **Filters**: place and period on one line. "Changes only" is a switch above the list it filters (with the count on the left: "66 changes" / "72 hours").
- **Summary**: one block with one main number. Nothing marked yet: "0 of 504" marked hours and one short line. Hours marked: "Gained by following" is the main number, missed gain and marked hours are a quiet line under it. The long explanation (and the live-mode note) is behind "?".
- **Hour row**: line 1 is time · place · decision chip; line 2 (changes only) is a short reason on one line: "Was Mine · Power fell $43.74 → $32.40/MWh", with the result (Followed, Missed +$5) on the right once the hour is marked. Tap the row to open it: the rest of the reason ("Lease to AI now beats Mine by $6.79/MWh"), the Followed / Other / Skip marks and a "2 receipts · Breakdown" link.
- "Keep as is" moved from a chip in line 1 into the opened row. The day header lost the "Not marked" text; "Mark N as followed" is a quiet link.
- Chips are unchanged (28 px, 13 Semibold).

Pairs (`pairs/`):
- `01-390-changes-only.png`: phone, Changes only, 7 d, before / after.
- `02-390-all-hours.png`: phone, all hours, 24 h, before / after.
- `03-390-open-and-marked.png`: phone, after: a row opened, and the summary once hours are marked.
- `04-1440-changes-only.png`, `05-1440-all-hours.png`, `06-1440-open-and-marked.png`: the same on desktop.

How it was shot: demo mode, headless Chrome, 390 px (2x) and 1440 px, first screen.
