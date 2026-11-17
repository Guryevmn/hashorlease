import { describe, expect, it } from "vitest";
import type { DecisionRecord } from "../agent/types";
import {
  CALLBACK_DEMO,
  CALLBACK_NOW,
  changeAlert,
  daySegments,
  demoDayReplay,
  esc,
  gainPhrase,
  limitAlert,
  networkAlert,
  networkBackAlert,
  nowReply,
  plainText,
  providerAlert,
  publicAppUrl,
  receiptsMessage,
  startMessage,
  welcomeReply,
} from "./messages";
import { isSnoozed, snooze, subscribe, unsubscribe } from "./chats";

const HOUR = "2026-11-08T14:00:00.000Z";

/** Non-breaking spaces → plain, so expected texts stay readable. */
const flat = (t: string) => t.replace(/\u00a0/g, " ");

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
  it("bold name and call, blocks separated by an empty line, service note last in italics", () => {
    const m = changeAlert(rec({ why: "power fell from $40.10 to $32.40/MWh" }), "https://hol.example");
    expect(flat(m.text)).toBe(
      [
        "🔄 <b>Houston Hub</b>: Mine → <b>Lease to AI</b>",
        "Why: power fell from $40.10 to $32.40/MWh",
        ["<b>+$136/h vs. mining</b> · $54.60/MWh", "Power $32.40 · Hashprice $38.50/PH/day"].join("\n"),
        "<i>Receipts: 2 · testnet</i>",
      ].join("\n\n"),
    );
    expect(m.buttons).toEqual([
      { text: "Open breakdown", url: "https://hol.example/sites/houston" },
      { text: "Snooze 1h", data: "snooze:houston" },
      { text: "Receipts", data: "receipts:houston" },
    ]);
  });

  it("amounts do not break inside: non-breaking spaces in «$1,203/h vs. mining», «Lease to AI», «Power $32.40»", () => {
    const m = changeAlert(rec({ gainVsMiningPerHour: 1203 }), null);
    expect(m.text).toContain("<b>+$1,203/h\u00a0vs.\u00a0mining</b>");
    expect(m.text).toContain("<b>Lease\u00a0to\u00a0AI</b>");
    expect(m.text).toContain("Power\u00a0$32.40 · Hashprice\u00a0$38.50/PH/day");
  });

  it("no link button without a public URL; public price source is named separately", () => {
    const m = changeAlert(
      rec({ receipts: [rec({}).receipts[0], { label: "Power price", status: "public", service: "Day-ahead price", provider: "Energy-Charts", costUsd: 0 }] }),
      null,
    );
    expect(m.text.endsWith("<i>Receipts: 1 · testnet · +1 public source</i>")).toBe(true);
    expect(m.buttons.map((b) => b.text)).toEqual(["Snooze 1h", "Receipts"]);
  });

  it("switch off: 'saves … vs. mining'", () => {
    const [head, numbers] = flat(changeAlert(north, null).text).split("\n\n");
    expect(head).toBe("🔄 <b>North Ridge</b>: Mine → <b>Switch off</b>");
    expect(numbers.split("\n")[0]).toBe("<b>saves $119/h vs. mining</b> · $0.00/MWh");
  });

  it("demo alert: marked as demo on top (never mistaken for a real call) and «no receipts» in the last line; only «Open demo day» as a button", () => {
    const m = changeAlert(rec({ mode: "demo", receipts: [] }), "https://hol.example");
    expect(m.text.startsWith("🧪 <i>Demo data · simulated 14:00 UTC</i>\n\n🔄 ")).toBe(true);
    expect(m.text.split("\n\n").pop()).toBe("<i>Demo data · no Telegraph receipts</i>");
    expect(m.buttons).toEqual([{ text: "Open demo day", url: "https://hol.example/demo-day" }]);
  });

  it("escapes HTML in site name and reason", () => {
    const m = changeAlert(rec({ siteName: "A <b> & Co", why: "x < y & z > w" }), null);
    expect(m.text).toContain("<b>A &lt;b&gt; &amp; Co</b>");
    expect(m.text).toContain("Why: x &lt; y &amp; z &gt; w");
    expect(esc("<&>")).toBe("&lt;&amp;&gt;");
    expect(plainText(m.text)).toContain("A <b> & Co: Mine → Lease to AI");
  });
});

describe("/now", () => {
  const sites = [
    { id: "houston", name: "Houston Hub" },
    { id: "north-ridge", name: "North Ridge" },
    { id: "garage", name: "My tariff" },
  ];
  const base = { sites, decisions: [rec({}), north, garage], now: new Date("2026-11-08T14:05:00Z"), spentUsd: 0.42, limitUsd: 1, appUrl: null };

  it("all sites — name in bold, call and amount under it, blocks apart, spend note last", () => {
    expect(flat(nowReply(base).text)).toBe(
      [
        "<b>Right now</b> · 14:05 UTC",
        "⚡ <b>Houston Hub</b>\nLease to AI · <b>+$136/h</b>",
        "⏻ <b>North Ridge</b>\nSwitch off · <b>saves $119/h</b>",
        "⛏ <b>My tariff</b>\nMine, keep as is · <b>+$0.79/day</b>",
        "<i>Spent today: $0.42 of $1.00</i>",
      ].join("\n\n"),
    );
  });

  it("one site by partial name: options and receipts", () => {
    const m = nowReply({ ...base, query: "houston" });
    expect(flat(m.text)).toBe(
      [
        "<b>Right now</b> · 14:05 UTC",
        "⚡ <b>Houston Hub</b>\nLease to AI · <b>+$136/h</b>",
        "Per MWh: Mine +$47.80 · Lease +$54.60 · Off $0",
        "<i>Receipts: 2 · testnet · latest 14:00 UTC</i>",
      ].join("\n\n"),
    );
    expect(m.buttons).toEqual([{ text: "Receipts", data: "receipts:houston" }]);
  });

  it("no such site / no sites / agent has not run yet", () => {
    expect(nowReply({ ...base, query: "Texas" }).text).toBe("No site matches “Texas”. Your sites: Houston Hub, North Ridge, My tariff.");
    expect(nowReply({ ...base, query: "<i>" }).text).toContain("No site matches “&lt;i&gt;”");
    expect(nowReply({ ...base, sites: [] }).text).toBe("No sites to report yet.");
    expect(nowReply({ ...base, decisions: [] }).text).toMatch(/^No calls yet/);
    expect(nowReply({ ...base, decisions: [] }).text).not.toMatch(/npm run/);
  });

  it("pause and stale decision are visible in the block", () => {
    const paused = rec({ siteId: "north-ridge", siteName: "North Ridge", status: "paused", decision: null, reason: "Paused · daily limit" });
    const old = rec({ hour: "2026-11-08T10:00:00.000Z", at: "2026-11-08T10:01:00.000Z" });
    const t = flat(nowReply({ ...base, decisions: [old, paused, garage] }).text).split("\n\n");
    expect(t[1]).toBe("⚡ <b>Houston Hub</b>\nLease to AI · <b>+$136/h</b> · <i>as of 10:00 UTC</i>");
    expect(t[2]).toBe("⏸ <b>North Ridge</b>\non hold · Paused · daily limit");
  });

  it("takes the latest entry per site", () => {
    const later = rec({ at: "2026-11-08T15:01:00.000Z", hour: "2026-11-08T15:00:00.000Z", decision: "mine", gainVsMiningPerHour: 0, profitPerHour: 956 });
    expect(flat(nowReply({ ...base, now: new Date("2026-11-08T15:05:00Z"), decisions: [rec({}), later] }).text).split("\n\n")[1]).toBe("⛏ <b>Houston Hub</b>\nMine · <b>+$956/h</b>");
  });
});

describe("welcome after /start", () => {
  const base = {
    sites: [
      { id: "houston", name: "Houston Hub" },
      { id: "north-ridge", name: "North Ridge" },
    ],
    decisions: [rec({}), north],
    now: new Date("2026-11-08T14:05:00Z"),
    spentUsd: 0.42,
    limitUsd: 1,
    appUrl: null as string | null,
  };

  it("greeting: what the bot does, what to tap, two buttons; then the same text as /now", () => {
    const [hello, current, ...rest] = welcomeReply(base);
    expect(rest).toEqual([]);
    const [what, tap, note] = hello.text.split("\n\n");
    expect(what).toBe("👋 <b>Hash or Lease</b> decides every hour: mine, lease to AI, or switch off. Alerts are on — I'll message you when a call changes.");
    expect(tap).toContain("<b>See a demo day</b>");
    expect(tap).toContain("<b>Current calls</b>");
    expect(note).toContain("Commands: /now · /demo · /stop");
    expect(hello.buttons).toEqual([
      { text: "See a demo day", data: CALLBACK_DEMO },
      { text: "Current calls", data: CALLBACK_NOW },
    ]);
    expect(current.text).toBe(nowReply(base).text);
    expect(flat(current.text).split("\n\n")[1]).toBe("⚡ <b>Houston Hub</b>\nLease to AI · <b>+$136/h</b>");
  });

  it("honest about sites: names the example sites, says web-app sites are not tracked, no «add a site in the app first»", () => {
    const [hello] = welcomeReply(base);
    expect(hello.text).toContain("The bot tracks 2 example sites: Houston Hub, North Ridge. Sites you add in the web app are not tracked here yet.");
    expect(welcomeReply({ ...base, sites: [...base.sites, { id: "g", name: "My tariff" }] })[0].text).toContain("three example sites: Houston Hub, North Ridge, My tariff");
    for (const m of [...welcomeReply(base), startMessage(null)]) expect(m.text).not.toMatch(/Add a site in the app first/i);
  });

  it("a repeated /start gives the same answer", () => {
    expect(welcomeReply(base)).toEqual(welcomeReply(base));
  });

  it("no agent entries yet: honest first-call phrase, no repo commands", () => {
    const m = welcomeReply({ ...base, decisions: [] });
    expect(m).toHaveLength(2);
    expect(m[1].text).toBe("The first call will arrive within the next hour.");
    expect(m[1].text).not.toMatch(/npm run/);
  });

  it("entries of unknown sites do not count as data", () => {
    const m = welcomeReply({ ...base, decisions: [rec({ siteId: "elsewhere", siteName: "Elsewhere" })] });
    expect(m[1].text).toBe("The first call will arrive within the next hour.");
  });

  it("no sites: only the greeting (buttons still work)", () => {
    const m = welcomeReply({ ...base, sites: [] });
    expect(m).toHaveLength(1);
    expect(m[0].text).toContain("No example sites are set up yet.");
    expect(m[0].buttons.map((b) => b.data)).toEqual([CALLBACK_DEMO, CALLBACK_NOW]);
  });

  it("a stale entry shows when it is from; a query after /start is ignored", () => {
    const old = rec({ hour: "2026-11-08T10:00:00.000Z", at: "2026-11-08T10:01:00.000Z" });
    const m = welcomeReply({ ...base, decisions: [old], query: "houston" });
    expect(flat(m[1].text).split("\n\n")[1]).toBe("⚡ <b>Houston Hub</b>\nLease to AI · <b>+$136/h</b> · <i>as of 10:00 UTC</i>");
    expect(m[1].text).toContain("Spent");
  });

  it("Open app button only with a public https address, on its own row under the two entry buttons", () => {
    expect(welcomeReply(base)[0].buttons.map((b) => b.text)).toEqual(["See a demo day", "Current calls"]);
    expect(welcomeReply({ ...base, appUrl: "https://hol.example" })[0].buttons[2]).toEqual({ text: "Open app", url: "https://hol.example", newRow: true });
  });
});

describe("/demo replay", () => {
  const second = rec({ hour: "2026-11-08T15:00:00.000Z", at: "2026-11-08T15:01:00.000Z", decision: "off", previous: "lease", gainVsMiningPerHour: 50, mode: "demo", receipts: [] });
  const first = rec({ mode: "demo", receipts: [] });
  const replay = demoDayReplay({ siteName: "Demo <Hub>", siteLine: "20 MW · 4 PH/s · lease $50/MWh", decisions: [first, second], appUrl: null });

  it("intro (bold title and site, escaped), one alert per change, summary with the day at a glance", () => {
    expect(replay.map((m) => m.kind)).toEqual(["demo", "change", "change", "demo"]);
    const [title, site, what, note] = flat(replay[0].text).split("\n\n");
    expect(title).toBe("🧪 <b>Demo day</b>");
    expect(site).toBe("<b>Demo &lt;Hub&gt;</b>\n20 MW · 4 PH/s · lease $50/MWh");
    expect(what).toBe("One simulated day, hour by hour. The call changes <b>2 times</b>; here is what I would send.");
    expect(note).toBe("<i>Invented prices · no Telegraph requests · no receipts</i>");
    expect(flat(replay[3].text)).toBe(["🧪 <b>Demo day at a glance</b>", "14:00–15:00  <b>⚡ Lease to AI</b>\n15:00–16:00  <b>⏻ Switch off</b>", "<i>Simulated, UTC · real calls: /now</i>"].join("\n\n"));
    expect(replay[3].buttons).toEqual([{ text: "Current calls", data: CALLBACK_NOW, newRow: false }]);
  });

  it("every demo alert carries the demo note", () => {
    for (const m of replay) expect(m.text.startsWith("🧪")).toBe(true);
  });

  it("plain day segments (console) stay without tags", () => {
    expect(daySegments([first, second])).toEqual(["14:00–15:00 ⚡ Lease to AI", "15:00–16:00 ⏻ Switch off"]);
  });
});

describe("other messages", () => {
  it("provider failure, limit, network: bold headline, blocks apart", () => {
    expect(flat(providerAlert(rec({ siteName: "North Ridge", status: "paused" }), north).text)).toBe(
      ["⚠️ <b>North Ridge</b>: grid price unavailable", "Last call (14:00): <b>Switch off</b>.", "<i>Retrying in 10 min.</i>"].join("\n\n"),
    );
    expect(flat(limitAlert(1, null).text)).toBe(["⛔ <b>Daily spend limit reached</b>", "Limit <b>$1.00</b> a day. Calls are paused until 00:00 UTC."].join("\n\n"));
    expect(limitAlert(1, "https://hol.example").buttons).toEqual([{ text: "Raise limit", url: "https://hol.example/spend#settings" }]);
    expect(networkAlert().text).toBe(["⚠️ <b>Can't reach Telegraph</b>", "I'll keep trying and tell you when it's back."].join("\n\n"));
    expect(networkBackAlert().text).toBe(["✅ <b>Data is reachable again</b>", "Hourly calls are back on."].join("\n\n"));
  });

  it("every text is valid Telegram HTML: tags balanced, no stray < or &", () => {
    const all = [
      changeAlert(rec({}), null).text,
      nowReply({ sites: [{ id: "houston", name: "Houston Hub" }], decisions: [rec({})], now: new Date("2026-11-08T14:05:00Z"), spentUsd: 0, limitUsd: 1, appUrl: null }).text,
      ...welcomeReply({ sites: [{ id: "x", name: "A & B" }], decisions: [], now: new Date(), spentUsd: 0, limitUsd: 1, appUrl: null }).map((m) => m.text),
      providerAlert(rec({}), null).text,
      limitAlert(1, null).text,
      networkAlert().text,
      networkBackAlert().text,
      receiptsMessage(rec({})).text,
    ];
    for (const t of all) {
      const opens = (t.match(/<(b|i)>/g) ?? []).length;
      const closes = (t.match(/<\/(b|i)>/g) ?? []).length;
      expect(opens).toBe(closes);
      expect(t.replace(/<\/?(b|i)>/g, "")).not.toMatch(/<|&(?!amp;|lt;|gt;)/);
    }
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
        "<b>Receipts</b> · Houston Hub · 14:00 UTC · testnet",
        "<b>CRYPTO_PRICE_USD</b> · Cp Coinbase · 14:00 UTC · $0.010 · 0xb274…ec4a",
        "Power price · Day-ahead price · Energy-Charts · 14:00 UTC · free public source",
        "Power price · your input (no receipt)",
      ].join("\n\n"),
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
