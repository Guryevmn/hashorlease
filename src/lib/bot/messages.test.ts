import { describe, expect, it } from "vitest";
import type { DecisionRecord } from "../agent/types";
import {
  changeAlert,
  gainPhrase,
  limitAlert,
  networkAlert,
  nowReply,
  providerAlert,
  publicAppUrl,
  receiptsMessage,
  startMessage,
} from "./messages";
import { isSnoozed, snooze, subscribe, unsubscribe } from "./chats";

const HOUR = "2026-11-08T14:00:00.000Z";

function rec(p: Partial<DecisionRecord>): DecisionRecord {
  return {
    at: "2026-11-08T14:01:00.000Z",
    hour: HOUR,
    mode: "mock",
    siteId: "houston",
    siteName: "Houston Hub",
    mw: 20,
    status: "ok",
    decision: "lease",
    keepAsIs: false,
    changed: true,
    previous: "mine",
    options: { mine: 47.8, lease: 54.6, off: 0 },
    chosenUsdPerMwh: 54.6,
    gainVsMiningPerHour: 136,
    profitPerHour: 1092,
    hashprice: 38.5,
    powerPrice: 32.4,
    receipts: [
      { label: "Mining income", status: "verified", service: "MINING_HASHPRICE_VERIFY", provider: "m-d9d", fetchedAt: "2026-11-08T14:00:03.000Z", costUsd: 0.01, hash: "0x6269…9bd0" },
      { label: "Power price", status: "verified", service: "GRID_POWER_PRICE", provider: "m-1f3", fetchedAt: "2026-11-08T14:00:07.000Z", costUsd: 0.01, hash: "0x55f8…e138" },
    ],
    ...p,
  };
}

const north = rec({
  siteId: "north-ridge",
  siteName: "North Ridge",
  mw: 12,
  decision: "off",
  previous: "mine",
  options: { mine: -9.93, lease: -12.1, off: 0 },
  chosenUsdPerMwh: 0,
  gainVsMiningPerHour: 119.16,
  profitPerHour: 0,
});
const garage = rec({
  siteId: "garage",
  siteName: "My tariff",
  mw: 0.015,
  decision: "mine",
  keepAsIs: true,
  changed: false,
  previous: "mine",
  options: { mine: 2.2, lease: null, off: 0 },
  chosenUsdPerMwh: 2.2,
  gainVsMiningPerHour: 0,
  profitPerHour: 0.033,
});

describe("decision-change alert (screens.md §6)", () => {
  it("matches the mockup", () => {
    const m = changeAlert(rec({}), "https://hol.example");
    expect(m.text).toBe(
      ["🔄 Houston Hub: Mine → Lease to AI", "+$136/h vs. mining · $54.60/MWh", "Power $32.40 · Hashprice $38.50/PH/day", "Receipts: 2 · testnet"].join("\n"),
    );
    expect(m.buttons).toEqual([
      { text: "Open breakdown", url: "https://hol.example/sites/houston" },
      { text: "Snooze 1h", data: "snooze:houston" },
      { text: "Receipts", data: "receipts:houston" },
    ]);
  });

  it("no link button without a public URL; public price source is named separately", () => {
    const m = changeAlert(
      rec({ receipts: [rec({}).receipts[0], { label: "Power price", status: "public", service: "Day-ahead price", provider: "Energy-Charts", costUsd: 0 }] }),
      null,
    );
    expect(m.text.split("\n")[3]).toBe("Receipts: 1 · testnet · +1 public source");
    expect(m.buttons.map((b) => b.text)).toEqual(["Snooze 1h", "Receipts"]);
  });

  it("switch off: 'saves … vs. mining'", () => {
    expect(changeAlert(north, null).text.split("\n").slice(0, 2)).toEqual(["🔄 North Ridge: Mine → Switch off", "saves $119/h vs. mining · $0.00/MWh"]);
  });
});

describe("/now", () => {
  const sites = [
    { id: "houston", name: "Houston Hub" },
    { id: "north-ridge", name: "North Ridge" },
    { id: "garage", name: "My tariff" },
  ];
  const base = { sites, decisions: [rec({}), north, garage], now: new Date("2026-11-08T14:05:00Z"), spentUsd: 0.42, limitUsd: 1, appUrl: null };

  it("all sites — as in the mockup", () => {
    expect(nowReply(base).text).toBe(
      [
        "Right now · 14:05 UTC",
        "⚡ Houston Hub — Lease to AI · +$136/h",
        "⏻ North Ridge — Switch off · saves $119/h",
        "⛏ My tariff — Mine, keep as is · +$0.79/day",
        "Spent today: $0.42 of $1.00",
      ].join("\n"),
    );
  });

  it("one site by partial name: options and receipts", () => {
    const m = nowReply({ ...base, query: "houston" });
    expect(m.text).toBe(
      [
        "Right now · 14:05 UTC",
        "⚡ Houston Hub — Lease to AI · +$136/h",
        "Mine +$47.80 · Lease +$54.60 · Off $0 /MWh",
        "Receipts: 2 · testnet · latest 14:00 UTC",
      ].join("\n"),
    );
    expect(m.buttons).toEqual([{ text: "Receipts", data: "receipts:houston" }]);
  });

  it("no such site / no sites / agent has not run yet", () => {
    expect(nowReply({ ...base, query: "Texas" }).text).toBe("No site matches “Texas”. Your sites: Houston Hub, North Ridge, My tariff.");
    expect(nowReply({ ...base, sites: [] }).text).toBe("No sites yet. Add one in the app to get calls here.");
    expect(nowReply({ ...base, decisions: [] }).text).toMatch(/^No calls yet/);
  });

  it("pause and stale decision are visible in the line", () => {
    const paused = rec({ siteId: "north-ridge", siteName: "North Ridge", status: "paused", decision: null, reason: "Paused · daily limit" });
    const old = rec({ hour: "2026-11-08T10:00:00.000Z", at: "2026-11-08T10:01:00.000Z" });
    const t = nowReply({ ...base, decisions: [old, paused, garage] }).text.split("\n");
    expect(t[1]).toBe("⚡ Houston Hub — Lease to AI · +$136/h (as of 10:00 UTC)");
    expect(t[2]).toBe("⏸ North Ridge — on hold · Paused · daily limit");
  });

  it("takes the latest entry per site", () => {
    const later = rec({ at: "2026-11-08T15:01:00.000Z", hour: "2026-11-08T15:00:00.000Z", decision: "mine", gainVsMiningPerHour: 0, profitPerHour: 956 });
    expect(nowReply({ ...base, now: new Date("2026-11-08T15:05:00Z"), decisions: [rec({}), later] }).text.split("\n")[1]).toBe("⛏ Houston Hub — Mine · +$956/h");
  });
});

describe("other messages", () => {
  it("provider failure, limit, network, /start", () => {
    expect(providerAlert(rec({ siteName: "North Ridge", status: "paused" }), north).text).toBe(
      "⚠️ North Ridge: grid price unavailable. Last call (14:00): Switch off. Retrying in 10 min.",
    );
    expect(limitAlert(1, null).text).toBe("⛔ Daily spend limit reached ($1.00). Calls are paused until 00:00 UTC.");
    expect(limitAlert(1, "https://hol.example").buttons).toEqual([{ text: "Raise limit", url: "https://hol.example/spend#settings" }]);
    expect(networkAlert().text).toBe("⚠️ Can't reach Telegraph. I'll keep trying and tell you when it's back.");
    expect(startMessage(null).text.split("\n")[0]).toBe("I check every hour whether to mine, lease to AI, or switch off. Add a site in the app first.");
  });

  it("receipts: Telegraph, public source, operator input; Sepolia link", () => {
    const m = receiptsMessage(
      rec({
        receipts: [
          { label: "Mining income", status: "verified", service: "CRYPTO_PRICE_USD", provider: "Cp Coinbase", fetchedAt: "2026-11-08T14:00:03Z", costUsd: 0.01, hash: "0xb274…ec4a", proofUrl: "https://sepolia.etherscan.io/tx/0xb2" },
          { label: "Power price", status: "public", service: "Day-ahead price", provider: "Energy-Charts", fetchedAt: "2026-11-08T14:00:09Z", costUsd: 0 },
          { label: "Power price", status: "input" },
        ],
      }),
    );
    expect(m.text).toBe(
      [
        "Receipts · Houston Hub · 14:00 UTC · testnet",
        "CRYPTO_PRICE_USD · Cp Coinbase · 14:00 UTC · $0.010 · 0xb274…ec4a",
        "Power price · Day-ahead price · Energy-Charts · 14:00 UTC · free public source",
        "Power price · your input (no receipt)",
      ].join("\n"),
    );
    expect(m.buttons).toEqual([{ text: "CRYPTO_PRICE_USD on Sepolia ↗", url: "https://sepolia.etherscan.io/tx/0xb2" }]);
  });

  it("small site gain — in $/day", () => {
    expect(gainPhrase(garage)).toBe("+$0.79/day");
  });

  it("app URL for buttons — https only", () => {
    expect(publicAppUrl("https://hol.example/")).toBe("https://hol.example");
    expect(publicAppUrl("http://localhost:3000")).toBeNull();
    expect(publicAppUrl("")).toBeNull();
    expect(publicAppUrl(undefined)).toBeNull();
  });
});

describe("bot subscribers", () => {
  it("subscribe, snooze for an hour, unsubscribe", () => {
    const now = new Date("2026-11-08T14:00:00Z");
    let chats = subscribe({}, "42", now);
    chats = snooze(chats, "42", "houston", new Date(now.getTime() + 3600_000));
    expect(isSnoozed(chats["42"], "houston", now)).toBe(true);
    expect(isSnoozed(chats["42"], "houston", new Date(now.getTime() + 2 * 3600_000))).toBe(false);
    expect(isSnoozed(chats["42"], "north-ridge", now)).toBe(false);
    expect(unsubscribe(chats, "42")).toEqual({});
  });

  it("Snooze in an unsubscribed chat does not re-enable alerts", () => {
    expect(snooze({}, "42", "houston", new Date())).toEqual({});
  });
});
