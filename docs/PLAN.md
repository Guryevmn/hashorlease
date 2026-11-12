# Hash or Lease — plan for Telegraph Hackathon Season II

Status as of 2026-11-10: the app, the hourly agent, the bot (runs as @hashorlease_bot since 12 Nov), docs/JUDGE.md and docs/SUBMISSION.md exist; the test wallet works and paid testnet requests go through. The code is public (https://github.com/Guryevmn/hashorlease, MIT) and the demo is hosted at https://hashorlease.vercel.app (updated 12 Nov). Independent assessment by Fable 5.2 (`~/Documents/Claude/fable52-hackathon/CRITERIA.md`): ≈41–49/100 now, ≈65–75 by Dec 1 if the plan below is executed (threshold 70). The earlier estimate of "66–84" is optimistic: users (10) and growth (20) are almost zero.

## 1. Goal

Place in the Apps & Agents track (excellence $700/$350/$150) and/or earn verified delivery ($225 × 8),
mission 12 "Mining and Power". Passing score threshold — 70.

## 2. Product

**Hash or Lease** — every hour, for each miner site, a decision: "Mine" / "Lease to AI" / "Switch off",
with a dollar amount and a Telegraph receipt under every input figure. This is example #1 of the mission ("The allocation agent").

User: operator of a mining farm / hosting facility (Texas and other US markets with hourly pricing).
Secondary: Russian-speaking miners on a flat tariff — "my tariff" mode.

### Screens (MVP)
1. **Sites** — a list; each site shows the decision for the current hour, the gain in $/h, and the update time.
2. **Site** — the decision breakdown: mining revenue, electricity price, AI lease rate, result;
   every figure has a receipt (service, provider, time, request price, link to the proof).
3. **"What if" feed** — hourly decision history and the gain missed when the advice was not followed.
4. **Spend** — how much was spent on requests, the daily limit, and a stop when it is exceeded.
5. **Add a site** — a grid node (for example ERCOT Houston hub) or "my tariff",
   fleet capacity (PH/s), consumption (MW), efficiency (J/TH), AI lease rate ($/MWh).
6. **Telegram bot** — an alert when the decision changes, a "/now" command per site.

### Decision logic (per MWh)
- mining: revenue = hashprice ($/PH/day) × PH/s per MW / 24 − electricity price;
- AI lease: contract rate − electricity price − overhead (if the rate is "all-in", do not subtract electricity — a setting field);
- switch off: 0 (plus demand-response payment, if any);
- pick the maximum; when values are close (< threshold) — "keep as is", so the equipment isn't jerked around.

## 3. Data from the Telegraph network (checked against the free list, docs/research/intents.json)

| Service | Miners | Input | What it gives |
|---|---|---|---|
| MINING_HASHPRICE_VERIFY_GENERAL | 27 | `block_height` (number) | $ per PH/s per day at current difficulty and fees |
| GRID_POWER_PRICE_GENERAL | 26 | `node_or_zone` + `interval_start` (RFC 3339 with time zone) | current (LMP) and day-ahead price from the operator |
| WEB_SEARCH_GENERAL | 26 | text | market GPU/AI lease rates (a rough guide) |
| DATACENTER_TELEMETRY_VERIFY_GENERAL | 12 | site | PUE, temperature, generator (second phase) |
| CRYPTO_PRICE_USD | 53 | coin | BTC price (for cross-checking) |

API: `GET https://devnode.telegraphprotocol.com/engine/v1/intents` (free),
`POST https://devnode.telegraphprotocol.com/engine/v1/ask` (paid, ~$0.01, USDC via x402, test network).

**Result of the first paid requests (Nov 9, Sepolia, 9 requests at $0.01; log `data/ledger.jsonl`, client `scripts/telegraph.mjs`):**
- x402 payment works; the response comes with a `signal_hash`, a receipt (Sepolia transaction) and a `field_status` for every field; body format: `{"intent","params"}` or `{"query"}`;
- hashprice: the numbers are `null` (`missing`), only the block number comes back; a different input gives pool statistics and total hashrate (~814 EH/s);
- ERCOT (HB_HOUSTON, HB_WEST): the price is `null`; each time the engine picks the PREFLIGHT miner (CAISO) rather than the ERCOT miner Pecos, so requests cannot be routed to it;
- conclusion: on devnode Telegraph provides a receipt and proof but not the numbers → we take the numbers from public sources (mempool.space, ERCOT) and use Telegraph for verification and the receipt.

**Was open (partly closed above):**
- which regions GRID_POWER_PRICE really serves (ERCOT is certainly in the example; PJM/CAISO/Europe — ?);
- the response and receipt format — what to show in the interface;
- latency and stability of responses.

**Network gap:** there is no service with AI power-lease rates → the operator enters the rate, WEB_SEARCH is only a guide.

## 4. Hackathon requirements that will be checked (docs/research/rules.txt)

A judge must be able to: **run** it with a new input → **verify** the result → **see** a real Telegraph request
and the proof of payment → **break** it (a reasonable failure) → **reproduce** it from the instructions.
Plus: spend limits, error handling, keys not in code; state the network honestly (testnet) and what was verified;
**a star on github.com/telegraphprotocol/bounties**; autonomous program-to-program purchasing (the agent pays for requests itself).

Scoring (threshold 70): technique 35 (minimum 24), commerce 25, users 10, network use 5,
reproducibility 5, growth 20. Assessment: see the status above; open code, public posts on different days, and third-party users decide it.

## 5. Phases and dates (UTC)

- **P0. Preparation, Nov 8–10** — user: hackathon registration (pick Apps & Agents, mission 12), a "yes" for the test wallet.
  Executor: an app skeleton on made-up data, screen descriptions for Figma.
- **P1. First request, Nov 11–13** — test wallet, one paid hashprice request + ERCOT Houston price,
  the response and receipt on screen. Find out which regions are available. ⚠️ Anything involving the wallet — only after the user's "yes".
- **Nov 14 — integration check** (not a cut): show a working request or what blocks it.
- **P2. Core, Nov 15–20** — decision logic, all 5 screens, the hourly agent with a spend limit,
  decision history, Telegram bot. Nov 20 — public progress showcase.
- **P3. Users, Nov 21–27** — 5–15 real users (mining chats, Telegraph Discord),
  collect feedback and numbers; "my tariff" mode. Publications — only with the user's "yes".
- **P4. Submission, Nov 28–30** — README with instructions, a "break it" scenario, demo video, an honest description of the network,
  a star on the bounties repository. Submitting the form — the user, or with their "yes".
- **Dec 1, 23:59 UTC** — deadline.

## 6. Stack (proposal, to be approved in P0)

Next.js (web app + server functions for the agent), SQLite/a file for history, grammY for the bot,
an x402 client from the Telegraph docs (docs.telegraphprotocol.com). Deployment — free hosting, only with the user's "yes".

## 7. Boundaries

- Without the user's "yes": do not register, do not connect/create wallets, do not make paid requests,
  do not publish, do not submit forms, do not install dependencies system-wide (into the project folder — fine).
- Do not ask the user for keys and secrets; do not put them in code or git (`.env` is in `.gitignore`).
- Do not touch `~/Documents/Claude Bot`.

## 8. Update 2026-11-10: deadlines and what needs a "yes"

**Deadlines (checked against docs/research/rules.txt:37–38, 174, 184):** final submission — **Dec 1, 23:59 UTC**. Nov 14 — progress check (show the first request/attempt/blocker), not a deadline and not a cut. Nov 20 — public progress showcase.

**Without the user's "yes" (can be done right away):**
- fix the error in JUDGE (limit `=0`, not `0.01`), explain the ledger spike, cross-check electricity prices — task 15223;
- update SUBMISSION.md; add a spend-limit test;
- prepare posts and the Discord message text (drafts, not sent);
- WEB_SEARCH / GRID_POWER_PRICE probes on CAISO — only within the already-given "yes" for test requests and the daily limit (costs cents).

**Only with a "yes":** open the repository/first commit; publish the demo; publications (3 posts on different days), Discord/X; the agent running for 2–3 days (≈$0.24/day of test funds); the bot token; finding and inviting third-party users; submitting the application.

**Phases:**
- Nov 10–13: fixes; decision on "open the code and demo?" (gives reproducibility and growth); a blocker note (empty hashprice/ERCOT responses) for Nov 14.
- Nov 14: progress showcase. How exactly — to be clarified in Discord (the site doesn't say).
- Nov 15–23: the agent for 2–3 days, the first public post, Nov 20 showcase; price cross-check and wording of the lease checkbox (in the UI — a separate small task).
- Nov 21–27: 3–5 third-party people following the instructions; the 2nd and 3rd posts on different days.
- Nov 28 – Dec 1: re-read sections 6 and 8 of the rules on the site, final check (test count), video, submission with a "yes".
