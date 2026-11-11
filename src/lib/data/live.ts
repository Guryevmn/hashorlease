// Data source for real mode: numbers, sites and the agent history come from the server (/api/live/*, /api/agent/*).
// Sites live on the server (data/sites.json) so the hourly agent works without an open browser.
// Feed: hours recorded by the agent are shown as is (with receipts); the rest are computed from real hourly
// electricity prices with the current hashprice (we have no historical hashprice). Operator marks live in the browser (marks.ts).

import { decide, type Decision } from "../decision";
import { entryFromOutcome } from "../feed";
import { buildOverview, buildSiteReport } from "../report";
import type { AgentStatus, DecisionRecord } from "../agent/types";
import { LIVE_NODES } from "../live/catalog";
import type {
  AddSiteResult,
  FeedEntry,
  FeedPeriod,
  HourPoint,
  MarketSnapshot,
  NodeOption,
  Site,
  SiteInput,
  SpendSettings,
  SpendState,
} from "../types";
import type { AddSiteEstimate, AppStatus, DataSource } from "./types";
import type { KeyValueStore } from "./mock";

export const LIVE_NODE_OPTIONS: NodeOption[] = LIVE_NODES;

/** One purchase: the BTC price via Telegraph, $0.01 (testnet USDC). */
export const LIVE_REFRESH_COST_USD = 0.01;

interface Series {
  hours: number[];
  usdPerMwh: number[];
}
interface SpendApi {
  limitUsd: number;
  spentUsd: number;
  limitReached: boolean;
  forecastPerDayUsd: number;
  forecastNote: string;
  byService: SpendState["byService"];
  log: SpendState["log"];
}

const HOUR_S = 3600;
const SNAP_CLIENT_TTL_MS = 60_000;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

/** Agent record → feed row. */
export function entryFromRecord(r: DecisionRecord): FeedEntry {
  return {
    hour: r.hour,
    siteId: r.siteId,
    siteName: r.siteName,
    advice: r.decision,
    pauseReason: r.status === "paused" ? r.reason : undefined,
    keepAsIs: r.keepAsIs,
    options: r.options,
    mw: r.mw,
    adviceGainUsd: r.gainVsMiningPerHour ?? 0,
    powerPrice: r.powerPrice ?? 0,
    receiptCount: r.receipts.filter((x) => x.status !== "input" && x.status !== "unavailable").length,
    recorded: true,
  };
}

async function writeSite(path: string, method: "POST" | "PUT", input: SiteInput): Promise<AddSiteResult> {
  try {
    const res = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const body = (await res.json().catch(() => null)) as AddSiteResult | null;
    if (body && typeof body === "object" && "ok" in body) return body;
    return { ok: false, error: "network", message: `Server answered ${res.status}. Try again.` };
  } catch {
    return { ok: false, error: "network", message: "Can't reach the app server. Check that it is running and try again." };
  }
}

export function createLiveDataSource(opts: { storage?: KeyValueStore | null } = {}): DataSource {
  const storage = opts.storage ?? null;
  const settingsKey = "hol.spend.live.v1";
  let snap: { at: number; value: MarketSnapshot } | null = null;
  const series = new Map<string, Promise<Series>>();

  const loadSites = () => api<Site[]>("/api/live/sites");
  const recorded = (hours: number) => api<DecisionRecord[]>(`/api/agent/decisions?mode=live&hours=${hours}`).catch(() => [] as DecisionRecord[]);

  function loadSettings(): { alertAtPct: number } {
    try {
      const raw = storage?.getItem(settingsKey);
      if (raw) return { alertAtPct: Number(JSON.parse(raw).alertAtPct) || 80 };
    } catch {
      /* ignore */
    }
    return { alertAtPct: 80 };
  }

  async function snapshot(force = false): Promise<MarketSnapshot> {
    if (!force && snap && Date.now() - snap.at < SNAP_CLIENT_TTL_MS) return snap.value;
    const value = await api<MarketSnapshot>(`/api/live/snapshot${force ? "?refresh=1" : ""}`);
    snap = { at: Date.now(), value };
    return value;
  }

  const seriesOf = (node: string) => {
    let p = series.get(node);
    if (!p) {
      p = api<Series>(`/api/live/series?node=${encodeURIComponent(node)}`);
      p.catch(() => series.delete(node));
      series.set(node, p);
    }
    return p;
  };

  /** Hours from oldest to newest up to and including the current one: the "as advised" decision, computed from price history. */
  async function history(site: Site, hours: number) {
    const snapshotNow = await snapshot();
    const hashprice = snapshotNow.hashprice.value;
    if (hashprice === null) return [];
    const nowH = Math.floor(Date.now() / 1000 / HOUR_S) * HOUR_S;
    let prices: { hour: number; price: number }[];
    if (site.kind === "tariff") {
      prices = Array.from({ length: hours }, (_, i) => ({ hour: nowH - (hours - 1 - i) * HOUR_S, price: site.tariffUsdPerMwh ?? 0 }));
    } else {
      const s = await seriesOf(site.nodeId ?? "");
      prices = s.hours.map((h, i) => ({ hour: h, price: s.usdPerMwh[i] })).filter((p) => p.hour <= nowH && p.hour > nowH - hours * HOUR_S);
    }
    let current: Decision | null = null;
    const out = [];
    for (const p of prices) {
      const r = decide({
        hashpriceUsdPerPhDay: hashprice,
        powerPriceUsdPerMwh: p.price,
        mw: site.mw,
        phs: site.phs,
        lease: site.lease ?? null,
        thresholdUsdPerMwh: site.thresholdUsdPerMwh,
        current,
      });
      if (!r.ok) continue;
      out.push({ hour: new Date(p.hour * 1000).toISOString(), price: p.price, outcome: r });
      current = r.chosen;
    }
    return out;
  }

  /** The decision in effect before the current hour: from agent records, or from price history if there are none. */
  async function withPrevious(site: Site, rows: DecisionRecord[]): Promise<Site> {
    const hourStart = new Date(Math.floor(Date.now() / 3600_000) * 3600_000).toISOString();
    const prev = rows.filter((r) => r.siteId === site.id && r.status === "ok" && r.hour < hourStart).sort((a, b) => a.at.localeCompare(b.at)).pop();
    if (prev?.decision) return { ...site, lastDecision: prev.decision };
    try {
      const h = await history(site, 48);
      return { ...site, lastDecision: h.length >= 2 ? h[h.length - 2].outcome.chosen : null };
    } catch {
      return site;
    }
  }

  async function spend(): Promise<SpendState> {
    const s = await api<SpendApi>("/api/live/spend");
    // The limit and stopping at the limit are on the server (DAILY_SPEND_LIMIT_USD); the browser can't turn them off.
    return { ...s, stopAtLimit: true, ...loadSettings() };
  }

  return {
    refreshCostUsd: LIVE_REFRESH_COST_USD,
    serverLimit: true,

    getStatus: async (): Promise<AppStatus> => {
      const [s, snapshotNow] = await Promise.all([spend(), snapshot().catch(() => null)]);
      return {
        now: new Date().toISOString(),
        spentUsd: s.spentUsd,
        limitUsd: s.limitUsd,
        limitReached: s.limitReached,
        networkDown: snapshotNow?.networkDown ?? true,
        lastGoodAt: snapshotNow?.lastGoodAt,
        demo: false,
      };
    },

    getOverview: async () => {
      const [sites, rows, snapshotNow] = await Promise.all([loadSites(), recorded(48), snapshot()]);
      return buildOverview(await Promise.all(sites.map((s) => withPrevious(s, rows))), snapshotNow);
    },

    getSiteReport: async (id) => {
      const site = (await loadSites()).find((s) => s.id === id);
      if (!site) return null;
      const [rows, snapshotNow] = await Promise.all([recorded(48), snapshot()]);
      return buildSiteReport(await withPrevious(site, rows), snapshotNow);
    },

    getSite: async (id) => (await loadSites()).find((s) => s.id === id) ?? null,

    getSiteHistory: async (id): Promise<HourPoint[]> => {
      const site = (await loadSites()).find((s) => s.id === id);
      if (!site) return [];
      return (await history(site, 24)).map((h) => ({ hour: h.hour, powerPrice: h.price, decision: h.outcome.chosen, keepAsIs: h.outcome.keepAsIs }));
    },

    getFeed: async (period: FeedPeriod, siteId): Promise<FeedEntry[]> => {
      const hours = period === "24h" ? 24 : period === "7d" ? 168 : 720;
      const [allSites, rows] = await Promise.all([loadSites(), recorded(hours)]);
      const sites = allSites.filter((s) => siteId === "all" || s.id === siteId);
      const agentRows = new Map(rows.map((r) => [`${r.siteId}|${r.hour}`, r]));
      const all = await Promise.all(
        sites.map(async (site): Promise<FeedEntry[]> => {
          const hist = await history(site, hours).catch(() => []);
          const entries = hist.map((h) => {
            const rec = agentRows.get(`${site.id}|${h.hour}`);
            return rec ? { ...entryFromRecord(rec), siteName: site.name } : entryFromOutcome(site, h.hour, h.price, h.outcome);
          });
          // Agent hours missing from the price history (e.g. a pause with no data) are shown too.
          const seen = new Set(entries.map((e) => e.hour));
          for (const r of rows) if (r.siteId === site.id && !seen.has(r.hour)) entries.push({ ...entryFromRecord(r), siteName: site.name });
          return entries;
        }),
      );
      return all.flat().sort((a, b) => (a.hour === b.hour ? a.siteName.localeCompare(b.siteName) : b.hour.localeCompare(a.hour)));
    },

    getSpend: spend,

    updateSpendSettings: async (settings: SpendSettings) => {
      storage?.setItem(settingsKey, JSON.stringify({ alertAtPct: settings.alertAtPct }));
      return spend();
    },

    searchNodes: async (query) => {
      const q = query.trim().toLowerCase();
      return LIVE_NODE_OPTIONS.filter((n) => !q || n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q));
    },

    estimateAddSite: async (): Promise<AddSiteEstimate> => {
      const s = await spend();
      // A new site needs no new paid requests: the BTC price is shared across all sites, and electricity prices are free.
      return { requestsPerDay: 0, costPerDayUsd: 0, wouldExceedLimit: false, limitUsd: s.limitUsd };
    },

    addSite: (input) => writeSite("/api/live/sites", "POST", input),
    updateSite: (id, input) => writeSite(`/api/live/sites/${encodeURIComponent(id)}`, "PUT", input),

    deleteSite: async (id) => {
      const res = await fetch(`/api/live/sites/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`);
    },

    refreshSite: async () => {
      const s = await spend();
      if (s.limitReached) throw new Error("Daily limit reached");
      await snapshot(true);
    },

    getAgentStatus: () => api<AgentStatus>("/api/agent?mode=live").catch(() => null),
  };
}
