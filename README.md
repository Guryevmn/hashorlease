# Hash or Lease

> **Reviewers:** start with [docs/JUDGE.md](docs/JUDGE.md) (English): run, new input, real Telegraph request and payment, failure cases, what is verified. Network: testnet only (Telegraph devnode + Ethereum Sepolia).

A web app and an hourly agent for Telegraph Hackathon Season II, Mission 12 "Mining and Power".
Once an hour, for each miner site: **Mine / Lease to AI / Switch off**, the amount in $, and a receipt for every input number.
Plan: `docs/PLAN.md`, screens: `docs/screens.md`, submission draft: `docs/SUBMISSION.md`.

Live demo (invented data, no wallet, no real calls): https://hashorlease.vercel.app · simulated day: https://hashorlease.vercel.app/demo-day

## Quick start

```
git clone https://github.com/Guryevmn/hashorlease.git
cd hashorlease
npm install
npm run dev        # open http://localhost:3000 — demo mode, no .env or wallet needed
```

For live mode: `cp .env.example .env` and fill in the variables (see "Live mode"). The `data/` folder is not stored in git; the app and the agent create it themselves.

## Commands

Requires Node.js **22.18+** (the agent and the bot run TypeScript using Node itself). Tested on Node 22.23.

```
npm install        # dependencies are installed only into the project folder
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # run the built app
npm test           # tests (vitest)
npm run typecheck  # type check
npm run agent      # hourly agent (see below)
npm run demo:day   # demo data: a simulated day on which the call changes (see "Demo day")
npm run bot        # Telegram bot (needs a token, see below)
```

## Modes

- **Demo** (default, no `.env`): all numbers and receipts are made up, no network and no wallet. Every screen shows the "Testnet" and "Demo data" badges.
- **Live** (`NEXT_PUBLIC_DATA_MODE=live` in `.env`): the BTC price is bought through Telegraph (x402, test USDC on Sepolia); everything else comes from free public sources. Details in "Live mode".

Screen states on demo data: add `?state=…` to the address of any screen (links are in the footer):
`loading` (skeletons), `empty` (no sites), `error` (Telegraph unreachable), `provider-error` (no power price for North Ridge), `limit` (daily limit reached).

## Screens

Places (`/`), site (`/sites/<id>`), edit site (`/sites/<id>/edit`), History (`/feed`), Usage (`/spend`), Add place (`/sites/new`), Demo day (`/demo-day`).

## Demo day

In the live run no call has changed yet (power stayed far above what mining earns), so the moment a call flips is shown on **demo data**: one invented site, one invented day of prices, 24 simulated hours through the same agent cycle. The call goes Lease to AI → Mine at 11:00 and back at 16:00, each time with the reason.

```
npm run demo:day                 # 24 simulated hours, 5 s each (2 minutes); journal → data/agent/demo/
npm run demo:day -- --speed=0    # all at once (seconds per simulated hour, 0–60)
```

- Screen `/demo-day` ("See a call change" on Places): Play, hour-by-hour tape with reasons, highlighted changes, bot alert preview, journal record. Bot: `/demo`.
- No network, no wallet, no Telegraph request, nothing sent to Telegram. Every number has the receipt status `demo`, every record `"mode":"demo"`, the journal has its own folder; the agent refuses demo numbers in live mode.
- The numbers, what they were checked against, and a sample journal: [docs/demo-day/](docs/demo-day/README.md).

## Hourly agent

`npm run agent` runs without an open browser: once an hour (at hh:01 UTC) it recomputes the decisions for all sites, pays for Telegraph data itself within the daily limit, writes the history to disk and sends Telegram alerts (if the bot is set up).

```
npm run agent                                  # first cycle right away, then every hour; Ctrl+C to stop
npm run agent -- --once                        # one cycle, then exit
npm run agent -- --mode=mock                   # demo data: no network, no money
npm run agent -- --mode=mock --once --state=provider-error   # simulate a failure: provider-error | error | limit
npm run agent -- --mode=live --once --fresh    # skip the cached snapshot — to test the limit and failures (only with --once)
```

- The default mode comes from `NEXT_PUBLIC_DATA_MODE`. A second agent instance in the same mode will not start.
- Rule: **no fresh Telegraph receipt, no decision.** If the limit is reached, or Telegraph or the price provider is unavailable, the hour is recorded as a pause with the reason; an alert is sent once per state change. After a failure it retries in 10 minutes.
- Where it is stored: `data/agent/<mode>/decisions.jsonl` (the decision per site per hour, with receipts and a one-line `why`), `runs.jsonl` (cycle summary), `alerts.json` (what has already been reported). Not in git.
- On screen: Usage → "Hourly agent" card; History → hours tagged "Agent call".

## Telegram bot

`npm run bot` (grammY): `/start` subscribes to alerts, `/now` or `/now Leipzig` shows the current decision, `/stop` unsubscribes, `/demo` replays the simulated demo day (marked as demo data), plus the "Snooze 1h" and "Receipts" buttons. A change alert says why the call changed ("Why: power price rose from … to …"). The bot buys nothing: `/now` reads the agent's latest records. Decision-change alerts are sent by the agent.

- Needs a token from @BotFather in `.env`: `HASHORLEASE_BOT_TOKEN=…`. **Without it the bot does not start** and says what to do. The app and the agent work without the bot (the agent logs what it would have sent).
- The variable has its own name, not `TELEGRAM_BOT_TOKEN`: the machine may hold another bot's token, and the app must not pick it up.
- Link buttons ("Open app", "Open breakdown") appear only if `.env` sets a public `APP_URL` with https (Telegram does not accept localhost).
- Subscribers are stored in `data/bot-chats.json` (not in git). Message texts are covered by tests; the bot has not yet been run against real Telegram.

## Live mode

`NEXT_PUBLIC_DATA_MODE=live` in `.env` turns on real data.

- **Wallet:** `node scripts/create-wallet.mjs` creates a test key in `.env` (do not commit it). You need Sepolia ETH (gas for `mint`) and test USDC `0xcc19…Ae17` (the token's `mint` is open). x402 payments need no gas.
- **What is paid:** one Telegraph request per market snapshot: the BTC price (`CRYPTO_PRICE_USD`, $0.01). The snapshot is shared by the app and the agent and lives 30 minutes (`data/snapshot.json`); without a fresh receipt it is retried after 5 minutes. The agent costs about $0.24 a day.
- **Hashprice** is computed by us: 144 blocks × average reward × price (Telegraph) / network hashrate (mempool.space). The `MINING_HASHPRICE_VERIFY_GENERAL` Intent returns empty numbers on the devnode (see `docs/PLAN.md` §3).
- **Electricity:** Energy-Charts (SMARD), day-ahead prices for zones DE-LU, FR, PL, AT, NL, free of charge. On screen this number carries the "Public source, not bought via Telegraph" badge. ERCOT through Telegraph returns empty prices on the devnode.
- **Sites** are stored on the server in `data/sites.json` (not in git) so the agent can see them without a browser. A corrupted file is not overwritten: the screen and the agent show an error. API: `GET/POST /api/live/sites`, `PUT/DELETE /api/live/sites/<id>`, with the same validation as the form.
- **Spend limit:** `DAILY_SPEND_LIMIT_USD` in `.env` (default 0.50). It is checked before every payment against the `data/ledger.jsonl` ledger under a disk lock (`data/.payment.lock`): the app and the agent pay strictly one at a time. A payment that went out without a response is recorded as spent. A single payment is at most $0.02 and only in test USDC. A paid request is made only after the free data; after a failure there is a 5-minute pause. "Refresh now" is allowed at most once every 2 minutes. The limit cannot be changed from the UI (Usage shows it read-only).
- **Receipts:** Sepolia transactions in the ledger, on the site screen (a receipt next to each number), on Usage and in the agent log, with an etherscan link.
- **Script client:** `node scripts/telegraph.mjs query "…"` or `node scripts/telegraph.mjs INTENT '{"param":…}'` (paid, with the limit and the ledger).

## Architecture

- `src/lib/decision.ts` — pure decision logic (formulas per MWh), `src/lib/report.ts` — the site report built from the market snapshot.
- `src/lib/data/` — the `DataSource` interface and two sources: `mock.ts` (demo) and `live.ts` (server). Screens work only through it.
- `src/lib/live/` — Telegraph client with the limit (`telegraph.ts`), market snapshot (`market.ts`), server-side sites (`sites.ts`), spend (`spend.ts`).
- `src/lib/agent/` — agent cycle (`cycle.ts`, dependencies are passed in from outside so it can be tested), storage (`store.ts`), per-mode assembly (`runner.ts`). Entry point: `scripts/agent.ts`.
- `src/lib/agent/why.ts` — the one-line reason for a call. `src/lib/demo/day.ts` — the demo day: invented site and price profile, run through the same cycle. Entry point: `scripts/demo-day.ts`; screen: `src/components/DemoDayView.tsx`.
- `src/lib/bot/` — bot texts (`messages.ts`), subscribers (`chats.ts`), sending (`notify.ts`). Entry point: `scripts/bot.ts`.
- `scripts/register-ts.mjs` — wires up `@/…` paths when running `.ts` scripts through Node.
- `src/app/api/` — server routes: `live/*` (snapshot, price series, spend, sites), `agent/*` (agent state and its decisions).

## Known simplifications

- In demo mode everything is made up: prices, receipts, hourly history; "View proof" links do not work. In live mode the sites are examples; there are no real users yet.
- Testnet only (Telegraph devnode, Sepolia). No real money and no mainnet.
- Hashprice is computed by us, electricity comes from Energy-Charts (Europe). US sites (ERCOT) exist only in the demo.
- The AI lease rate is entered by the operator; the market guide (`WEB_SEARCH`) exists only in the demo.
- History before the agent started is recomputed from past electricity prices with today's hashprice; "Agent call" marks only the hours the agent decided live.
- We do not know what the operator did in each hour: they mark it themselves on History ("Followed" / "Did something else" / "Skip"). Marks are stored in the browser's `localStorage`. Missed gain is computed only for marked hours; "Keep as is" hours are never counted as missed.
- There is no login: the sites API is designed for a local single-operator install, not for a public server.
- The agent and the web app are separate processes: they share the market snapshot through a file and pay one at a time through a disk lock.
- The agent decides only from the snapshot of the current UTC hour: when running every hour, that is one purchase per hour.
- The Telegram bot has not been run with a real token.
- Time in the demo is fixed: 8 Nov 2026, 14:04 UTC.
- No call has changed in live operation yet. The change of call is shown on the demo day (`/demo-day`): invented prices on an invented site, chosen so that the power price crosses the break-even point; it is not evidence of live behaviour.

## License

MIT — see [LICENSE](LICENSE).
