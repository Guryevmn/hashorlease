// Live market snapshot: the BTC price is a paid Telegraph request (with a receipt), the Bitcoin network comes from mempool.space,
// the electricity price from Energy-Charts (SMARD, day-ahead). On the Telegraph devnode the hashprice and ERCOT intents
// return empty fields, so we compute those numbers ourselves (docs/PLAN.md §3).

import type { MarketSnapshot, PowerQuote, Receipt, Sourced } from "../types";
import { LIVE_NODES } from "./catalog";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ask, SpendLimitError } from "./telegraph";

export { LIVE_NODES };

const SNAPSHOT_TTL_MS = 30 * 60_000;
const SERIES_TTL_MS = 60 * 60_000;
const HOUR_S = 3600;

export interface HourlySeries {
  /** Hour starts, unix seconds. */
  hours: number[];
  /** $/MWh. */
  usdPerMwh: number[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

// ---- Bitcoin ----

interface BtcNetwork {
  btcUsd: number;
  eurUsd: number;
  hashratePhs: number;
  avgRewardBtc: number;
}

async function fetchBtcNetwork(): Promise<BtcNetwork> {
  const [prices, hr, reward] = await Promise.all([
    getJson<{ USD: number; EUR: number }>("https://mempool.space/api/v1/prices"),
    getJson<{ currentHashrate: number }>("https://mempool.space/api/v1/mining/hashrate/3d"),
    getJson<{ totalReward: string; startBlock: number; endBlock: number }>("https://mempool.space/api/v1/mining/reward-stats/144"),
  ]);
  const blocks = reward.endBlock - reward.startBlock + 1;
  return {
    btcUsd: prices.USD,
    eurUsd: prices.USD / prices.EUR,
    hashratePhs: hr.currentHashrate / 1e15,
    avgRewardBtc: Number(reward.totalReward) / 1e8 / blocks,
  };
}

/** $ per PH/s per day = blocks per day × average reward × price / network hashrate. */
export function hashpriceUsdPerPhDay(n: { btcUsd: number; hashratePhs: number; avgRewardBtc: number }): number {
  return Math.round(((144 * n.avgRewardBtc * n.btcUsd) / n.hashratePhs) * 100) / 100;
}

async function telegraphBtcPrice(): Promise<{ price: number; tx: string | null; miner?: string; at: string } | { error: string; limit: boolean }> {
  try {
    const r = await ask({ query: "What is the current price of Bitcoin (BTC) in USD?" }, "All sites");
    const price = (r.body?.result as { price_usd?: number } | undefined)?.price_usd;
    if (r.status !== 200 || typeof price !== "number" || !r.tx) return { error: `Telegraph answered ${r.status} without a price`, limit: false };
    return { price, tx: r.tx, miner: r.body?.miner_name as string | undefined, at: (r.body?.timestamp as string | undefined) ?? new Date().toISOString() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), limit: e instanceof SpendLimitError };
  }
}

// ---- Electricity ----

const seriesCache = new Map<string, { at: number; series: HourlySeries }>();
const seriesInflight = new Map<string, Promise<HourlySeries>>();
const SERIES_DIR = join(process.cwd(), "data", "series");

/** On-disk cache of price series: Energy-Charts rate-limits requests (429), and the app and the agent are separate processes. */
function seriesFromDisk(node: string): { at: number; series: HourlySeries } | null {
  const f = join(SERIES_DIR, `${node}.json`);
  try {
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { at: number; series: HourlySeries }) : null;
  } catch {
    return null;
  }
}

async function downloadSeries(node: string, eurUsd: number): Promise<HourlySeries> {
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const end = Date.now() + 2 * 86_400_000;
  const url = `https://api.energy-charts.info/price?bzn=${encodeURIComponent(node)}&start=${day(Date.now() - 31 * 86_400_000)}&end=${day(end)}`;
  type Prices = { unix_seconds: number[]; price: (number | null)[] };
  // Energy-Charts sometimes answers 429 / an error: two retries with a pause.
  let d: Prices | null = null;
  for (let attempt = 0; !d; attempt++) {
    try {
      d = await getJson<Prices>(url);
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  const buckets = new Map<number, number[]>();
  d.unix_seconds.forEach((t, i) => {
    const p = d.price[i];
    if (p === null || p === undefined) return;
    const h = Math.floor(t / HOUR_S) * HOUR_S;
    (buckets.get(h) ?? buckets.set(h, []).get(h)!).push(p);
  });
  const hours = [...buckets.keys()].sort((a, b) => a - b);
  return {
    hours,
    usdPerMwh: hours.map((h) => {
      const v = buckets.get(h)!;
      return Math.round((v.reduce((s, x) => s + x, 0) / v.length) * eurUsd * 100) / 100;
    }),
  };
}

/** Hourly prices for the last ~31 days, averaged from 15-minute ones. If the source fails, the last saved series. */
export async function fetchSeries(node: string, eurUsd: number): Promise<HourlySeries> {
  const hit = seriesCache.get(node) ?? seriesFromDisk(node);
  if (hit && Date.now() - hit.at < SERIES_TTL_MS) {
    seriesCache.set(node, hit);
    return hit.series;
  }
  let p = seriesInflight.get(node);
  if (!p) {
    p = downloadSeries(node, eurUsd)
      .then((series) => {
        const entry = { at: Date.now(), series };
        seriesCache.set(node, entry);
        try {
          if (!existsSync(SERIES_DIR)) mkdirSync(SERIES_DIR, { recursive: true });
          writeFileSync(join(SERIES_DIR, `${node}.json`), JSON.stringify(entry));
        } catch {
          /* disk cache is optional */
        }
        return series;
      })
      .catch((e) => {
        if (hit) return hit.series;
        throw e;
      })
      .finally(() => seriesInflight.delete(node));
    seriesInflight.set(node, p);
  }
  return p;
}

function currentAndNext(series: HourlySeries, nowS: number): { current?: number; next?: number } {
  const h = Math.floor(nowS / HOUR_S) * HOUR_S;
  const i = series.hours.indexOf(h);
  return i < 0 ? {} : { current: series.usdPerMwh[i], next: series.usdPerMwh[i + 1] };
}

// ---- Snapshot ----

let snapCache: { at: number; value: MarketSnapshot; fx: number } | null = null;
let lastGoodAt: string | undefined;

function receipt(status: Receipt["status"], p: Omit<Receipt, "status" | "network">): Receipt {
  return { status, network: "testnet", ...p };
}

async function buildSnapshot(): Promise<{ snapshot: MarketSnapshot; fx: number }> {
  // Free data first: if mempool.space did not answer, we skip the paid request (otherwise the purchase would be wasted).
  const net = await fetchBtcNetwork();
  const tg = await telegraphBtcPrice();
  const now = new Date();

  let hashprice: Sourced<number | null>;
  if ("price" in tg) {
    hashprice = {
      value: hashpriceUsdPerPhDay({ ...net, btcUsd: tg.price }),
      receipt: receipt("verified", {
        service: "CRYPTO_PRICE_USD",
        provider: tg.miner,
        fetchedAt: tg.at,
        costUsd: 0.01,
        hash: tg.tx ? shortHash(tg.tx) : undefined,
        proofUrl: tg.tx ? `https://sepolia.etherscan.io/tx/${tg.tx}` : undefined,
        source: `BTC $${Math.round(tg.price).toLocaleString("en-US")} via Telegraph; hashrate ${(net.hashratePhs / 1000).toFixed(0)} EH/s and rewards from mempool.space`,
      }),
    };
  } else {
    // Telegraph unavailable or rate-limited: compute from the mempool.space price and mark the receipt.
    hashprice = {
      value: hashpriceUsdPerPhDay(net),
      receipt: receipt(tg.limit ? "stale" : "unavailable", {
        service: "CRYPTO_PRICE_USD",
        fetchedAt: now.toISOString(),
        costUsd: 0,
        source: `${tg.limit ? "Daily limit reached" : "Telegraph unavailable"} — BTC price from mempool.space`,
      }),
    };
  }

  const nowS = Math.floor(now.getTime() / 1000);
  const power: Record<string, PowerQuote> = {};
  await Promise.all(
    LIVE_NODES.map(async (n) => {
      try {
        const series = await fetchSeries(n.id, net.eurUsd);
        const { current, next } = currentAndNext(series, nowS);
        power[n.id] = {
          dayAhead: next,
          realTime: {
            value: current ?? null,
            // Energy-Charts is a free public source, not Telegraph: there is no payment receipt.
            receipt: receipt(current === undefined ? "unavailable" : "public", {
              service: "Day-ahead price",
              provider: "Energy-Charts",
              fetchedAt: now.toISOString(),
              costUsd: 0,
              source: "Energy-Charts (Bundesnetzagentur | SMARD.de), current hour, EUR→USD at market rate",
              proofUrl: `https://api.energy-charts.info/price?bzn=${n.id}`,
            }),
          },
        };
      } catch {
        power[n.id] = { realTime: { value: null, receipt: receipt("unavailable", { service: "Day-ahead price", provider: "Energy-Charts", costUsd: 0 }) } };
      }
    }),
  );

  // Telegraph did not answer (not a rate limit): screens will show "Can't reach Telegraph" and the time of the last receipt.
  const telegraphDown = "error" in tg && !tg.limit;
  if (!telegraphDown) lastGoodAt = now.toISOString();
  return {
    fx: net.eurUsd,
    snapshot: {
      asOf: now.toISOString(),
      hashprice,
      power,
      leaseGuide: null,
      networkDown: telegraphDown,
      lastGoodAt,
      limitReached: "limit" in tg && tg.limit,
    },
  };
}

/** A snapshot without a Telegraph receipt (rate limit, network) lives in the cache for 5 minutes, not 30: then we try again. */
const UNVERIFIED_TTL_MS = 5 * 60_000;

const SNAPSHOT_FILE = join(process.cwd(), "data", "snapshot.json");
let inflight: Promise<MarketSnapshot> | null = null;

/** Takes the snapshot from disk if it is newer than the in-memory cache: the web app and the agent (a separate process) share one purchase. */
function loadFromDisk() {
  if (!existsSync(SNAPSHOT_FILE)) return;
  try {
    if (snapCache && statSync(SNAPSHOT_FILE).mtimeMs <= snapCache.at) return;
    const d = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as { at: number; value: MarketSnapshot; fx: number };
    if (snapCache && d.at <= snapCache.at) return;
    snapCache = d;
    lastGoodAt = d.value.lastGoodAt;
  } catch {
    /* corrupted: rebuild it */
  }
}

function refresh(): Promise<MarketSnapshot> {
  inflight ??= buildSnapshot()
    .then(({ snapshot, fx }) => {
      const verified = snapshot.hashprice.receipt.status === "verified";
      snapCache = { at: verified ? Date.now() : Date.now() - SNAPSHOT_TTL_MS + UNVERIFIED_TTL_MS, value: snapshot, fx };
      if (!existsSync(dirname(SNAPSHOT_FILE))) mkdirSync(dirname(SNAPSHOT_FILE));
      writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapCache));
      return snapshot;
    })
    .catch((e) => {
      if (snapCache) {
        // The next attempt is no sooner than in 5 minutes, not on every request.
        snapCache = { ...snapCache, at: Math.min(snapCache.at, Date.now() - SNAPSHOT_TTL_MS + UNVERIFIED_TTL_MS) };
        return { ...snapCache.value, networkDown: true, lastGoodAt };
      }
      throw e;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Fresh snapshot from cache; a stale one is returned immediately while refreshing in the background (x402 payment takes up to a minute). */
export async function getLiveSnapshot(force = false, opts: { minForceIntervalMs?: number } = {}): Promise<MarketSnapshot> {
  loadFromDisk();
  // "Refresh now" from the browser at most once per minForceIntervalMs: repeated clicks don't eat the limit.
  const realAge = snapCache ? Date.now() - new Date(snapCache.value.asOf).getTime() : Infinity;
  if (force && opts.minForceIntervalMs && snapCache && realAge < opts.minForceIntervalMs) return snapCache.value;
  if (force) return refresh();
  if (!snapCache) return refresh();
  if (Date.now() - snapCache.at >= SNAPSHOT_TTL_MS) void refresh();
  return snapCache.value;
}

/**
 * For the hourly agent: waits for a fresh snapshot, no older than 30 minutes and built in the current UTC hour
 * (the electricity price is taken for the build hour). If the cache is like that, there is no new payment.
 */
export async function getFreshSnapshot(): Promise<MarketSnapshot> {
  loadFromDisk();
  const hour = (ms: number) => Math.floor(ms / 3600_000);
  if (snapCache && Date.now() - snapCache.at < SNAPSHOT_TTL_MS && hour(new Date(snapCache.value.asOf).getTime()) === hour(Date.now())) {
    return snapCache.value;
  }
  return refresh();
}

export async function getLiveSeries(node: string): Promise<HourlySeries> {
  const snap = await getLiveSnapshot();
  void snap;
  return fetchSeries(node, snapCache?.fx ?? 1.1);
}
