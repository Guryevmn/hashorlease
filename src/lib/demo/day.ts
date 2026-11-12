// Demo day: one invented site and one invented 24-hour price profile on which the hourly call changes.
// Nothing here is real: no Telegraph request, no receipt, no public source. Every number carries the "demo" status,
// records get mode "demo" and go to their own journal (data/agent/demo/), never to the live one.
//
// The profile is shaped after the real series the app caches (Energy-Charts day-ahead, 11 Oct – 12 Nov 2026):
// a low-price day with a midday solar dip. In that month about 5% of hours were under $30/MWh (FR 4.8%, DE-LU 4.7%),
// and the evening peak had a median of $319/MWh; the demo stays inside that range. See docs/demo-day/README.md.

import { runCycle, type CycleResult } from "../agent/cycle";
import { createMemoryStore, type AgentStore } from "../agent/store";
import type { DecisionRecord, RunRecord } from "../agent/types";
import type { BotMessage } from "../bot/messages";
import { miningRevenuePerMwh } from "../decision";
import type { MarketSnapshot, Receipt, Site } from "../types";

/** The same made-up date as the rest of the demo: 8 Nov 2026, 00:00 UTC. */
export const DEMO_DAY_START = Date.UTC(2026, 10, 8, 0, 0, 0);
export const DEMO_DAY_HOURS = 24;
export const DEMO_NODE_ID = "DEMO_DAY";
const HOUR_MS = 3600_000;

/** Network figures behind the demo hashprice; orders of magnitude from our live snapshot of 12 Nov 2026 (955 EH/s, $34.92/PH/day). */
export const DEMO_NETWORK_EHS = 955;
export const DEMO_BLOCK_REWARD_BTC = 3.149;

/** Invented power price by UTC hour, $/MWh: quiet night, morning peak, midday solar dip, evening peak. */
const POWER = [48, 44, 41, 43, 61, 118, 164, 171, 139, 74, 28, 21, 18, 20, 26, 33, 124, 212, 236, 205, 176, 142, 96, 63];
/** Invented BTC price by UTC hour, $: drifts within about ±0.5%. */
const BTC = [
  73480, 73390, 73310, 73350, 73420, 73560, 73690, 73810, 73760, 73650, 73580, 73620,
  73700, 73840, 73950, 74020, 73930, 73800, 73690, 73610, 73540, 73470, 73520, 73590,
];

export interface DemoHour {
  /** Hour of the simulated day, 0–23 (UTC). */
  h: number;
  /** ISO start of the hour. */
  hour: string;
  powerUsdPerMwh: number;
  btcUsd: number;
  /** $ per PH/s per day: 144 blocks × reward × BTC price ÷ network hashrate. */
  hashprice: number;
}

export function demoHashprice(btcUsd: number): number {
  return Math.round(((144 * DEMO_BLOCK_REWARD_BTC * btcUsd) / (DEMO_NETWORK_EHS * 1000)) * 100) / 100;
}

export const DEMO_DAY: DemoHour[] = POWER.map((powerUsdPerMwh, h) => ({
  h,
  hour: new Date(DEMO_DAY_START + h * HOUR_MS).toISOString(),
  powerUsdPerMwh,
  btcUsd: BTC[h],
  hashprice: demoHashprice(BTC[h]),
}));

/** The invented site: a modern 15 J/TH fleet with an AI tenant that pays a fixed rate and its own power. */
export function demoDaySite(): Site {
  return {
    id: "demo-solar-ridge",
    name: "Solar Ridge (demo)",
    kind: "grid",
    nodeId: DEMO_NODE_ID,
    nodeLabel: "Demo power profile",
    mw: 15,
    phs: 1000,
    jPerTh: 15,
    lease: { rateUsdPerMwh: 75, includesPower: true, overheadUsdPerMwh: 8 },
    thresholdUsdPerMwh: 5,
    lastDecision: null,
  };
}

/** Power price at which mining and the lease pay the same in that hour, $/MWh. */
export function demoBreakEvenPower(x: DemoHour, site = demoDaySite()): number {
  const lease = site.lease ? site.lease.rateUsdPerMwh - site.lease.overheadUsdPerMwh : 0;
  return miningRevenuePerMwh(x.hashprice, site.phs, site.mw) - lease;
}

function demoReceipt(h: number, source: string): Receipt {
  return {
    status: "demo",
    network: "testnet",
    service: "Demo profile",
    provider: "none (invented number)",
    fetchedAt: new Date(DEMO_DAY_START + h * HOUR_MS + 7_000).toISOString(),
    costUsd: 0,
    source,
  };
}

export function demoDaySnapshot(h: number): MarketSnapshot {
  const x = DEMO_DAY[h];
  if (!x) throw new Error(`demo day has hours 0–${DEMO_DAY_HOURS - 1}, got ${h}`);
  return {
    asOf: new Date(DEMO_DAY_START + h * HOUR_MS + 60_000).toISOString(),
    hashprice: {
      value: x.hashprice,
      receipt: demoReceipt(h, `Demo day: invented BTC price $${x.btcUsd.toLocaleString("en-US")}, ${DEMO_NETWORK_EHS} EH/s. Not a Telegraph purchase.`),
    },
    power: {
      [DEMO_NODE_ID]: { realTime: { value: x.powerUsdPerMwh, receipt: demoReceipt(h, "Demo day: invented power price profile. Not a market quote.") } },
    },
    leaseGuide: null,
    networkDown: false,
  };
}

/** One simulated hour through the real agent cycle (hh:01 UTC of the demo day). No network, no money, no Telegram. */
export function runDemoHour(h: number, store: AgentStore, appUrl: string | null = null): Promise<CycleResult> {
  return runCycle({
    mode: "demo",
    store,
    loadSites: () => [demoDaySite()],
    getSnapshot: async () => demoDaySnapshot(h),
    spend: () => ({ spentUsd: 0, limitUsd: 0, paidRequests: 0 }),
    now: () => new Date(DEMO_DAY_START + h * HOUR_MS + 60_000),
    appUrl,
  });
}

export interface DemoDayResult {
  site: Site;
  hours: DemoHour[];
  /** One record per hour, in the agent journal format, mode "demo". */
  decisions: DecisionRecord[];
  runs: RunRecord[];
  /** Bot alerts the day produces, with the hour they belong to. */
  alerts: { h: number; message: BotMessage }[];
}

/** The whole demo day at once (deterministic). By default nothing is written to disk. */
export async function simulateDemoDay(opts: { store?: AgentStore; appUrl?: string | null } = {}): Promise<DemoDayResult> {
  const store = opts.store ?? createMemoryStore();
  const out: DemoDayResult = { site: demoDaySite(), hours: DEMO_DAY, decisions: [], runs: [], alerts: [] };
  for (let h = 0; h < DEMO_DAY_HOURS; h++) {
    const r = await runDemoHour(h, store, opts.appUrl ?? null);
    out.decisions.push(...r.decisions);
    out.runs.push(r.run);
    out.alerts.push(...r.messages.map((message) => ({ h, message })));
  }
  return out;
}

/** Short site line for the bot and the screen. */
export function demoSiteLine(site = demoDaySite()): string {
  const l = site.lease;
  return `${site.mw} MW · ${site.phs} PH/s · ${site.jPerTh} J/TH${l ? ` · lease $${l.rateUsdPerMwh}/MWh${l.includesPower ? ", tenant pays power" : ""}` : ""}`;
}
