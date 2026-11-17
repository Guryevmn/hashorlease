// Buys the lease-rate guide (Telegraph WEB_SEARCH_GENERAL, ~$0.01) now if it is due (once per day), and prints the journal line.
//
//   npm run lease-guide              # buy only if today's purchase is still due
//   npm run lease-guide -- --force   # buy anyway (still within the daily spend limit)

import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");

const { buyLeaseGuideIfDue, guideFromLedger, LEASE_GUIDE_INTENT } = await import("@/lib/live/leaseGuide");
const { readLedger } = await import("@/lib/live/telegraph");

const force = process.argv.includes("--force");
const result = await buyLeaseGuideIfDue({ force, log: (l) => console.log(l) });
console.log(`result: ${result}`);
const rows = readLedger().filter((r) => r.intent === LEASE_GUIDE_INTENT);
const last = rows[rows.length - 1];
if (last) {
  const { body, ...rest } = last;
  console.log("ledger row:", JSON.stringify({ ...rest, result: (body as { result?: unknown } | null)?.result }));
}
console.log("on screen:", JSON.stringify(guideFromLedger(readLedger())));
