// Live-mode reference data with no server dependencies: read by the browser, the server and the agent alike.

import type { NodeOption, Site } from "../types";

/** Market zones with hourly Energy-Charts prices (day-ahead). ERCOT via Telegraph on the devnode returns empty prices. */
export const LIVE_NODES: NodeOption[] = [
  { id: "DE-LU", label: "Germany–Luxembourg (DE-LU), day-ahead" },
  { id: "FR", label: "France (FR), day-ahead" },
  { id: "PL", label: "Poland (PL), day-ahead" },
  { id: "AT", label: "Austria (AT), day-ahead" },
  { id: "NL", label: "Netherlands (NL), day-ahead" },
];

/** Sites live mode starts with until the operator adds their own (data/sites.json). */
export const LIVE_SEED_SITES: Site[] = [
  {
    id: "leipzig",
    name: "Leipzig Hub",
    kind: "grid",
    nodeId: "DE-LU",
    nodeLabel: "Germany–Luxembourg",
    mw: 20,
    phs: 1000,
    jPerTh: 20,
    lease: { rateUsdPerMwh: 120, includesPower: true, overheadUsdPerMwh: 8 },
    thresholdUsdPerMwh: 5,
  },
  {
    id: "silesia",
    name: "Silesia Farm",
    kind: "grid",
    nodeId: "PL",
    nodeLabel: "Poland",
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
