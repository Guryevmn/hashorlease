// Mock data source with made-up numbers from docs/screens.md. No network.
// States for previewing screens: ?state=loading | empty | error | provider-error | limit

import { buildOverview, buildSiteReport } from "../report";
import type {
  AddSiteResult,
  FeedEntry,
  FeedPeriod,
  MarketSnapshot,
  NodeOption,
  Receipt,
  RequestStatus,
  Site,
  SiteInput,
  SpendLogEntry,
  SpendSettings,
  SpendState,
  Sourced,
} from "../types";
import { feedEntries, MOCK_HASHPRICE, MOCK_HOUR_START, MOCK_POWER_DA, MOCK_POWER_RT, previousDecisionOf, siteHistory24 } from "./mockHistory";
import { GUIDE_COST_USD, REFRESH_COST_USD, type AddSiteEstimate, type AppStatus, type DataSource } from "./types";
import { siteInputErrors } from "../siteForm";
import type { AgentStatus } from "../agent/types";

export const MOCK_STATES = ["default", "loading", "empty", "error", "provider-error", "limit"] as const;
export type MockState = (typeof MOCK_STATES)[number];

export function parseMockState(v: string | null | undefined): MockState {
  return (MOCK_STATES as readonly string[]).includes(v ?? "") ? (v as MockState) : "default";
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MockOptions {
  state?: MockState;
  storage?: KeyValueStore | null;
  /** Artificial response delay, ms. */
  latencyMs?: number;
}

export const NODES: NodeOption[] = [
  { id: "HB_HOUSTON", label: "ERCOT Houston hub (HB_HOUSTON)" },
  { id: "HB_NORTH", label: "ERCOT North hub (HB_NORTH)" },
  { id: "HB_WEST", label: "ERCOT West hub (HB_WEST)" },
];

const NOW_MS = MOCK_HOUR_START + 4 * 60_000; // 14:04 UTC
const iso = (h: number, m: number, s: number) => new Date(Date.UTC(2026, 10, 8, h, m, s)).toISOString();
const DAILY_LIMIT_DEFAULT = 1.0;
const REQUEST_COST = 0.01;

function receipt(status: Receipt["status"], p: Omit<Receipt, "status" | "network">): Receipt {
  return { status, network: "testnet", costUsd: REQUEST_COST, ...p };
}

const SEED_SITES: Omit<Site, "lastDecision">[] = [
  {
    id: "houston",
    name: "Houston Hub",
    kind: "grid",
    nodeId: "HB_HOUSTON",
    nodeLabel: "ERCOT Houston",
    mw: 20,
    phs: 1000,
    jPerTh: 20,
    lease: { rateUsdPerMwh: 95, includesPower: false, overheadUsdPerMwh: 8 },
    thresholdUsdPerMwh: 5,
  },
  {
    id: "north-ridge",
    name: "North Ridge",
    kind: "grid",
    nodeId: "HB_NORTH",
    nodeLabel: "ERCOT North",
    mw: 12,
    phs: 480,
    jPerTh: 25,
    lease: { rateUsdPerMwh: 70, includesPower: false, overheadUsdPerMwh: 8 },
    thresholdUsdPerMwh: 5,
  },
  {
    id: "garage",
    name: "My tariff (garage)",
    kind: "tariff",
    nodeLabel: "Fixed rate $0.040/kWh",
    tariffUsdPerMwh: 40,
    mw: 0.015,
    phs: 0.3945,
    jPerTh: 38,
    lease: null,
    thresholdUsdPerMwh: 5,
  },
];

const POWER_META: Record<string, { provider: string; hash: string; source: string }> = {
  HB_HOUSTON: { provider: "m-1f3", hash: "0x55f8…e138", source: "ERCOT, real-time LMP" },
  HB_NORTH: { provider: "m-2a7", hash: "0x91c4…07ad", source: "ERCOT, real-time LMP" },
  HB_WEST: { provider: "m-3b9", hash: "0x4e2a…c1f0", source: "ERCOT, real-time LMP" },
};

export function buildMockSnapshot(state: MockState): MarketSnapshot {
  const stale = state === "error" || state === "limit";
  const status: Receipt["status"] = stale ? "stale" : "verified";
  const at = (m: number, s: number) => (stale ? iso(13, 0, s) : iso(14, m, s));

  const power: MarketSnapshot["power"] = {};
  for (const id of Object.keys(MOCK_POWER_RT)) {
    const meta = POWER_META[id];
    const down = state === "provider-error" && id === "HB_NORTH";
    power[id] = {
      dayAhead: MOCK_POWER_DA[id],
      realTime: down
        ? {
            value: null,
            receipt: receipt("unavailable", { service: "GRID_POWER_PRICE", provider: meta.provider, source: "Provider timeout", costUsd: 0 }),
          }
        : {
            value: MOCK_POWER_RT[id],
            receipt: receipt(status, {
              service: "GRID_POWER_PRICE",
              provider: meta.provider,
              fetchedAt: at(0, 7),
              hash: meta.hash,
              source: meta.source,
            }),
          },
    };
  }

  return {
    asOf: new Date(NOW_MS).toISOString(),
    hashprice: {
      value: MOCK_HASHPRICE,
      receipt: receipt(status, {
        service: "MINING_HASHPRICE_VERIFY",
        provider: "m-d9d",
        fetchedAt: at(0, 3),
        hash: "0x6269…9bd0",
        source: "BTC hashprice, $/PH/day",
      }),
    },
    power,
    leaseGuide: {
      value: "$70–100 /MWh",
      receipt: receipt("verified", {
        service: "WEB_SEARCH",
        provider: "m-080",
        fetchedAt: iso(13, 2, 11),
        hash: "0xb5cf…c607",
        source: "Web search, estimate only",
      }),
    },
    networkDown: state === "error",
    lastGoodAt: state === "error" ? iso(13, 0, 7) : undefined,
    limitReached: state === "limit",
  };
}

/**
 * Snapshot for the hourly agent in mock mode: the same made-up numbers, but for the current hour,
 * and the electricity price wanders by the hour (so decisions sometimes change and there is something to show in notifications).
 */
export function mockAgentSnapshot(state: MockState, now: Date): MarketSnapshot {
  const base = buildMockSnapshot(state);
  const hour = Math.floor(now.getTime() / 3600_000);
  const at = new Date(hour * 3600_000 + 7_000).toISOString();
  const restamp = <T extends { receipt: Receipt }>(x: T): T =>
    x.receipt.fetchedAt ? { ...x, receipt: { ...x.receipt, fetchedAt: state === "error" || state === "limit" ? new Date(hour * 3600_000 - 3593_000).toISOString() : at } } : x;
  const power: MarketSnapshot["power"] = {};
  for (const [id, q] of Object.entries(base.power)) {
    const phase = (id.charCodeAt(3) % 7) / 2;
    const v = q.realTime.value === null ? null : Math.round(q.realTime.value * (1 + 0.45 * Math.sin(0.7 * hour + phase)) * 100) / 100;
    power[id] = { ...q, realTime: restamp({ ...q.realTime, value: v }) };
  }
  return {
    ...base,
    asOf: now.toISOString(),
    hashprice: restamp(base.hashprice),
    power,
    lastGoodAt: base.lastGoodAt ? new Date(hour * 3600_000 - 3593_000).toISOString() : undefined,
  };
}

/** Demo sites (for the agent in mock mode). */
export function mockSeedSites(): Site[] {
  return SEED_SITES.map((s) => ({ ...s, lastDecision: null }));
}

function buildLog(state: MockState): SpendLogEntry[] {
  const e = (at: string, service: string, siteName: string, provider: string, hash: string, status: RequestStatus = "paid"): SpendLogEntry => ({
    at,
    service,
    siteName,
    provider,
    hash: status === "paid" ? hash : undefined,
    costUsd: status === "paid" ? REQUEST_COST : 0,
    status,
  });
  const log: SpendLogEntry[] = [];
  if (state === "limit") {
    log.push(e(iso(14, 0, 7), "GRID_POWER_PRICE", "North Ridge", "m-2a7", "", "blocked"));
    log.push(e(iso(14, 0, 7), "GRID_POWER_PRICE", "Houston Hub", "m-1f3", "", "blocked"));
    log.push(e(iso(14, 0, 3), "MINING_HASHPRICE_VERIFY", "All sites", "m-d9d", "", "blocked"));
  } else {
    log.push(e(iso(14, 0, 7), "GRID_POWER_PRICE", "North Ridge", "m-2a7", "0x91c4…07ad"));
    log.push(e(iso(14, 0, 7), "GRID_POWER_PRICE", "Houston Hub", "m-1f3", "0x55f8…e138"));
    log.push(e(iso(14, 0, 3), "MINING_HASHPRICE_VERIFY", "All sites", "m-d9d", "0x6269…9bd0"));
  }
  log.push(e(iso(13, 2, 11), "WEB_SEARCH", "Houston Hub", "m-080", "0xb5cf…c607"));
  log.push(e(iso(13, 0, 9), "GRID_POWER_PRICE", "North Ridge", "m-2a7", "", "failed"));
  log.push(e(iso(13, 0, 7), "GRID_POWER_PRICE", "Houston Hub", "m-1f3", "0x7d10…a3e2"));
  log.push(e(iso(13, 0, 3), "MINING_HASHPRICE_VERIFY", "All sites", "m-d9d", "0x2c9b…51f7"));
  log.push(e(iso(12, 0, 7), "GRID_POWER_PRICE", "North Ridge", "m-2a7", "0xe03a…9d44"));
  log.push(e(iso(12, 0, 7), "GRID_POWER_PRICE", "Houston Hub", "m-1f3", "0x18bb…70c5"));
  log.push(e(iso(12, 0, 3), "MINING_HASHPRICE_VERIFY", "All sites", "m-d9d", "0xa7f2…3b16"));
  return log;
}

const never = <T,>() => new Promise<T>(() => {});

export function createMockDataSource(opts: MockOptions = {}): DataSource {
  const state = opts.state ?? "default";
  const storage = opts.storage ?? null;
  const latency = opts.latencyMs ?? 200;

  const sitesKey = state === "empty" ? "hol.sites.v1.empty" : "hol.sites.v1";
  const spendKey = "hol.spend.v1";
  let extraSpend = 0;
  const extraLog: SpendLogEntry[] = [];
  let memorySites: Site[] | null = null;
  let memorySettings: SpendSettings | null = null;

  const wait = async <T,>(v: () => T): Promise<T> => {
    if (state === "loading") return never<T>();
    if (latency > 0) await new Promise((r) => setTimeout(r, latency));
    return v();
  };

  function loadSites(): Site[] {
    const raw = storage?.getItem(sitesKey);
    if (raw) {
      try {
        return JSON.parse(raw) as Site[];
      } catch {
        /* corrupted: start over */
      }
    }
    if (memorySites) return memorySites;
    const initial: Site[] =
      state === "empty" ? [] : SEED_SITES.map((s) => ({ ...s, lastDecision: previousDecisionOf({ ...s, lastDecision: null }) }));
    saveSites(initial);
    return initial;
  }
  function saveSites(sites: Site[]) {
    memorySites = sites;
    storage?.setItem(sitesKey, JSON.stringify(sites));
  }

  function loadSettings(): SpendSettings {
    const raw = storage?.getItem(spendKey);
    if (raw) {
      try {
        return JSON.parse(raw) as SpendSettings;
      } catch {
        /* ignore */
      }
    }
    return memorySettings ?? { limitUsd: DAILY_LIMIT_DEFAULT, stopAtLimit: true, alertAtPct: 80 };
  }

  const baseSpent = () => (state === "limit" ? 1.0 : state === "empty" ? 0 : 0.42);
  const spent = () => Math.round((baseSpent() + extraSpend) * 100) / 100;

  function status(): AppStatus {
    const s = loadSettings();
    return {
      now: new Date(NOW_MS).toISOString(),
      spentUsd: spent(),
      limitUsd: s.limitUsd,
      limitReached: s.stopAtLimit && spent() >= s.limitUsd - 1e-9,
      networkDown: state === "error",
      lastGoodAt: state === "error" ? iso(13, 0, 7) : undefined,
      demo: true,
    };
  }

  function spendState(): SpendState {
    const s = loadSettings();
    const sites = loadSites();
    const gridSites = sites.filter((x) => x.kind === "grid" && !x.paused).length;
    const requests = sites.length ? gridSites * 24 + 24 + 1 : 0;
    const by =
      state === "limit"
        ? [
            { service: "MINING_HASHPRICE_VERIFY", requests: 37, costUsd: 0.37 },
            { service: "GRID_POWER_PRICE", requests: 62, costUsd: 0.62 },
            { service: "WEB_SEARCH", requests: 1, costUsd: 0.01 },
          ]
        : [
            { service: "MINING_HASHPRICE_VERIFY", requests: 24, costUsd: 0.24 },
            { service: "GRID_POWER_PRICE", requests: 17, costUsd: 0.17 },
            { service: "WEB_SEARCH", requests: 1, costUsd: 0.01 },
          ];
    if (extraSpend > 0) {
      const g = by.find((b) => b.service === "GRID_POWER_PRICE")!;
      const n = Math.round(extraSpend / REQUEST_COST);
      g.requests += n;
      g.costUsd = Math.round((g.costUsd + n * REQUEST_COST) * 100) / 100;
    }
    return {
      limitUsd: s.limitUsd,
      stopAtLimit: s.stopAtLimit,
      alertAtPct: s.alertAtPct,
      spentUsd: spent(),
      limitReached: status().limitReached,
      forecastPerDayUsd: Math.round(requests * REQUEST_COST * 100) / 100,
      forecastNote: `${gridSites} grid ${gridSites === 1 ? "site" : "sites"} × 24 grid price + 24 hashprice + 1 web search, ~$0.01 each (estimate)`,
      // In the "empty" demo there have been no requests yet.
      byService: state === "empty" ? [] : by,
      log: state === "empty" ? [...extraLog] : [...extraLog, ...buildLog(state)],
    };
  }

  const snapshot = () => buildMockSnapshot(state);

  function checkInput(input: SiteInput): AddSiteResult | null {
    if (Object.keys(siteInputErrors(input)).length > 0) {
      return { ok: false, error: "invalid", message: "Check the highlighted fields." };
    }
    if (input.kind === "grid" && (state === "error" || !NODES.some((n) => n.id === input.nodeId))) {
      return {
        ok: false,
        error: state === "error" ? "network" : "node-not-found",
        message: "We couldn't confirm this node with the data network. Check the name or use My tariff.",
      };
    }
    return null;
  }

  return {
    getStatus: async () => {
      // Status is always available: the limit works even if everything else fails to load.
      return status();
    },

    getOverview: () =>
      wait(() => {
        const sites = loadSites();
        return buildOverview(sites, snapshot());
      }),

    getSiteReport: (id) =>
      wait(() => {
        const site = loadSites().find((s) => s.id === id);
        return site ? buildSiteReport(site, snapshot()) : null;
      }),

    getSite: (id) => wait(() => loadSites().find((s) => s.id === id) ?? null),

    getSiteHistory: (id) =>
      wait(() => {
        const site = loadSites().find((s) => s.id === id);
        return site ? siteHistory24(site) : [];
      }),

    getFeed: (period: FeedPeriod, siteId) =>
      wait(() => {
        const hours = period === "24h" ? 24 : period === "7d" ? 168 : 720;
        const sites = loadSites().filter((s) => siteId === "all" || s.id === siteId);
        const paused = state === "limit" ? [3, 4, 5] : [];
        const all: FeedEntry[] = sites.flatMap((s) => feedEntries(s, hours, paused));
        return all.sort((a, b) => (a.hour === b.hour ? a.siteName.localeCompare(b.siteName) : b.hour.localeCompare(a.hour)));
      }),

    getSpend: () =>
      wait(() => {
        if (state === "error") throw new Error("Can't load spend history");
        return spendState();
      }),

    updateSpendSettings: (settings) =>
      wait(() => {
        memorySettings = settings;
        storage?.setItem(spendKey, JSON.stringify(settings));
        return spendState();
      }),

    searchNodes: (query) =>
      wait(() => {
        const q = query.trim().toLowerCase();
        return NODES.filter((n) => !q || n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q));
      }),

    estimateAddSite: (input) =>
      wait((): AddSiteEstimate => {
        const requestsPerDay = input.kind === "grid" ? 24 : 0;
        const cost = requestsPerDay * REQUEST_COST;
        const s = status();
        const settings = loadSettings();
        return {
          requestsPerDay,
          costPerDayUsd: Math.round(cost * 100) / 100,
          wouldExceedLimit: settings.stopAtLimit && s.spentUsd + cost > s.limitUsd + 1e-9,
          limitUsd: s.limitUsd,
        };
      }),

    addSite: (input: SiteInput) =>
      wait((): AddSiteResult => {
        const bad = checkInput(input);
        if (bad) return bad;
        const sites = loadSites();
        const base = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
        let id = base;
        for (let n = 2; sites.some((s) => s.id === id); n++) id = `${base}-${n}`;
        const site: Site = { ...input, id, name: input.name.trim(), lastDecision: null };
        saveSites([...sites, site]);
        return { ok: true, site };
      }),

    updateSite: (id: string, input: SiteInput) =>
      wait((): AddSiteResult => {
        const bad = checkInput(input);
        if (bad) return bad;
        const sites = loadSites();
        const prev = sites.find((s) => s.id === id);
        if (!prev) return { ok: false, error: "invalid", message: "This place no longer exists." };
        // Keep the current decision: editing the numbers must not reset "keep as is".
        const site: Site = { ...input, id, name: input.name.trim(), lastDecision: prev.lastDecision ?? null };
        saveSites(sites.map((s) => (s.id === id ? site : s)));
        return { ok: true, site };
      }),

    refreshCostUsd: REFRESH_COST_USD,
    serverLimit: false,

    getAgentStatus: async () => {
      // The demo agent (npm run agent -- --mode=mock) writes its cycles on the server; read them from there.
      if (typeof window === "undefined") return null;
      try {
        const res = await fetch("/api/agent?mode=mock", { cache: "no-store" });
        return res.ok ? ((await res.json()) as AgentStatus) : null;
      } catch {
        return null;
      }
    },

    loadDemoSites: () =>
      wait(() => {
        // Demo sites live under the usual key: so they stay even after leaving ?state=empty.
        const seeded: Site[] = SEED_SITES.map((s) => ({ ...s, lastDecision: previousDecisionOf({ ...s, lastDecision: null }) }));
        storage?.setItem("hol.sites.v1", JSON.stringify(seeded));
        memorySites = seeded;
      }),

    deleteSite: (id) =>
      wait(() => {
        saveSites(loadSites().filter((s) => s.id !== id));
      }),

    refreshSite: (id) =>
      wait(() => {
        const s = status();
        if (s.limitReached) throw new Error("Daily limit reached");
        const site = loadSites().find((x) => x.id === id);
        extraSpend += REFRESH_COST_USD;
        const at = new Date(NOW_MS).toISOString();
        extraLog.unshift(
          { at, service: "GRID_POWER_PRICE", siteName: site?.name ?? id, provider: "m-1f3", costUsd: REQUEST_COST, status: "paid", hash: "0x0000…mock" },
          { at, service: "MINING_HASHPRICE_VERIFY", siteName: site?.name ?? id, provider: "m-d9d", costUsd: REQUEST_COST, status: "paid", hash: "0x0000…mock" },
        );
      }),

    fetchLeaseGuide: () =>
      wait((): Sourced<string> | null => {
        const s = status();
        if (s.limitReached) throw new Error("Daily limit reached");
        extraSpend += GUIDE_COST_USD;
        return snapshot().leaseGuide;
      }),
  };
}
