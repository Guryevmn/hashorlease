// Сборка отчёта по площадке из снимка рынка: чеки у входов + решение.
// Не зависит от источника данных (mock или реальный Telegraph).

import { decide } from "./decision";
import type { MarketSnapshot, Overview, Receipt, Site, SiteReport, Sourced } from "./types";

const USER_INPUT: Receipt = { status: "input", network: "testnet" };

export function userInput<T>(value: T): Sourced<T> {
  return { value, receipt: { ...USER_INPUT } };
}

export function buildSiteReport(site: Site, snapshot: MarketSnapshot): SiteReport {
  const hashprice = snapshot.hashprice;

  let power: Sourced<number | null>;
  let powerDayAhead: number | undefined;
  if (site.kind === "tariff") {
    power = userInput<number | null>(site.tariffUsdPerMwh ?? null);
  } else {
    const quote = site.nodeId ? snapshot.power[site.nodeId] : undefined;
    power = quote?.realTime ?? {
      value: null,
      receipt: { status: "unavailable", service: "GRID_POWER_PRICE", network: "testnet" },
    };
    powerDayAhead = quote?.dayAhead;
  }

  const leaseRate = site.lease ? userInput(site.lease.rateUsdPerMwh) : null;
  const overhead = site.lease ? userInput(site.lease.overheadUsdPerMwh) : null;

  const base = {
    site,
    asOf: snapshot.asOf,
    inputs: {
      hashprice,
      power,
      powerDayAhead,
      leaseRate,
      overhead,
      leaseGuide: site.lease ? snapshot.leaseGuide : null,
    },
    previousDecision: site.lastDecision ?? null,
  };

  if (site.paused) {
    return { ...base, status: "paused", pausedReason: "Paused — daily limit", result: null };
  }
  if (hashprice.value === null) {
    return { ...base, status: "paused", pausedReason: "Hashprice unavailable — decision paused", result: null };
  }
  if (power.value === null) {
    return {
      ...base,
      status: "paused",
      pausedReason: `Grid price unavailable for ${site.name} — decision paused`,
      result: null,
    };
  }

  const result = decide({
    hashpriceUsdPerPhDay: hashprice.value,
    powerPriceUsdPerMwh: power.value,
    mw: site.mw,
    phs: site.phs,
    lease: site.lease ?? null,
    thresholdUsdPerMwh: site.thresholdUsdPerMwh,
    current: site.lastDecision ?? null,
  });

  const anyStale =
    snapshot.networkDown ||
    hashprice.receipt.status === "stale" ||
    hashprice.receipt.status === "unavailable" ||
    power.receipt.status === "stale" ||
    power.receipt.status === "unavailable";

  return { ...base, status: anyStale ? "stale" : "ok", result };
}

export function buildOverview(sites: Site[], snapshot: MarketSnapshot): Overview {
  const reports = sites.map((s) => buildSiteReport(s, snapshot));
  const totalGainPerHour = reports.reduce(
    (sum, r) => sum + (r.result && r.result.ok ? Math.max(0, r.result.gainVsMiningPerHour) : 0),
    0,
  );
  return { snapshot, reports, totalGainPerHour };
}
