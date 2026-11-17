// Telegram bot texts (docs/screens.md §6). Pure functions: no network or grammY, so they are easy to test.
// Text is Telegram HTML (parse_mode "HTML"): bold for what matters, a blank line between blocks,
// italics for service notes. Everything dynamic goes through esc()/chip(), so "<" and "&" cannot break a message.

import { DECISION_LABEL, type Decision } from "../decision";
import { signedUsd, usd, utcTime } from "../format";
import type { DecisionRecord, RecordedReceipt } from "../agent/types";

export interface Button {
  text: string;
  /** Link (https only: Telegram does not accept localhost). */
  url?: string;
  /** Callback data for the button handler, e.g. "snooze:houston". */
  data?: string;
  /** Start a new keyboard row before this button. */
  newRow?: boolean;
}

export type MessageKind = "change" | "provider" | "limit" | "network" | "network-back" | "now" | "start" | "no-sites" | "receipts" | "demo";

export interface BotMessage {
  kind: MessageKind;
  /** Telegram HTML. Use plainText() for logs. */
  text: string;
  buttons: Button[];
  /** Site the alert refers to (for "Snooze 1h"). */
  siteId?: string;
}

export const DECISION_EMOJI: Record<Decision, string> = { mine: "⛏", lease: "⚡", off: "⏻" };

const NBSP = "\u00a0";

/** Escape for Telegram HTML. */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escaped text whose spaces do not break ("$54.60/MWh", "saves $119/h vs. mining" stay in one piece). */
function chip(s: string): string {
  return esc(s).replace(/ /g, NBSP);
}

const b = (s: string): string => `<b>${s}</b>`;
const i = (s: string): string => `<i>${s}</i>`;

/** Message text without tags, for logs and the console. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\u00a0/g, " ");
}

/** Buttons of the welcome message; the bot answers them with the same replies as /demo and /now. */
export const CALLBACK_DEMO = "demo";
export const CALLBACK_NOW = "now";
const entryButtons = (): Button[] => [
  { text: "See a demo day", data: CALLBACK_DEMO },
  { text: "Current calls", data: CALLBACK_NOW },
];

/** App URL for buttons; public https URL only. */
export function publicAppUrl(raw: string | undefined): string | null {
  const v = raw?.trim().replace(/\/+$/, "");
  return v && /^https:\/\/[^\s/]+/.test(v) ? v : null;
}

function money(amount: number, unit: string): string {
  const digits = Math.abs(amount) < 10 ? 2 : 0;
  return `${signedUsd(amount, digits)}${unit}`;
}

/** Decision gain, short: «+$136/h vs. mining», «saves $119/h», «+$0.79/day». */
export function gainPhrase(r: Pick<DecisionRecord, "decision" | "gainVsMiningPerHour" | "profitPerHour">, vsMining = false): string {
  if (!r.decision) return "";
  const hourly = (r.decision === "mine" ? r.profitPerHour : r.gainVsMiningPerHour) ?? 0;
  const perDay = Math.abs(hourly) < 1;
  const amount = perDay ? hourly * 24 : hourly;
  const unit = perDay ? "/day" : "/h";
  if (r.decision === "off") {
    if (amount <= 0.005) return "nothing to save";
    const digits = Math.abs(amount) < 10 ? 2 : 0;
    return `saves ${usd(amount, digits)}${unit}${vsMining ? " vs. mining" : ""}`;
  }
  return `${money(amount, unit)}${r.decision === "lease" && vsMining ? " vs. mining" : ""}`;
}

function decisionText(r: DecisionRecord): string {
  if (!r.decision) return "on hold";
  return `${DECISION_LABEL[r.decision]}${r.keepAsIs ? ", keep as is" : ""}`;
}

const paidReceipts = (r: DecisionRecord) => r.receipts.filter((x) => (x.costUsd ?? 0) > 0 && x.status === "verified");
const publicReceipts = (r: DecisionRecord) => r.receipts.filter((x) => x.status === "public");

function receiptsLine(r: DecisionRecord, withLatest = false): string {
  if (r.mode === "demo") return "Demo data · no Telegraph receipts";
  const paid = paidReceipts(r);
  const pub = publicReceipts(r).length;
  const latest = r.receipts
    .map((x) => x.fetchedAt)
    .filter((x): x is string => !!x)
    .sort()
    .pop();
  return [
    `Receipts: ${paid.length}`,
    "testnet",
    pub > 0 ? `+${pub} public ${pub === 1 ? "source" : "sources"}` : null,
    withLatest && latest ? `latest ${utcTime(latest)} UTC` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function siteButtons(r: DecisionRecord, appUrl: string | null, extra: Button[] = []): Button[] {
  const b: Button[] = [];
  if (appUrl) b.push({ text: "Open breakdown", url: `${appUrl}/sites/${encodeURIComponent(r.siteId)}` });
  return [...b, ...extra, { text: "Receipts", data: `receipts:${r.siteId}` }];
}

/** 🔄 Decision change (sent automatically). */
export function changeAlert(r: DecisionRecord, appUrl: string | null): BotMessage {
  const demo = r.mode === "demo";
  const blocks = [
    demo ? `🧪 ${i(esc(`Demo data · simulated ${utcTime(r.hour)} UTC`))}` : null,
    `🔄 ${b(esc(r.siteName))}: ${r.previous ? chip(DECISION_LABEL[r.previous]) : "—"} → ${b(r.decision ? chip(DECISION_LABEL[r.decision]) : `on${NBSP}hold`)}`,
    r.why ? `Why: ${esc(r.why)}` : null,
    [
      `${b(chip(gainPhrase(r, true)))} · ${chip(`${r.chosenUsdPerMwh !== null ? usd(r.chosenUsdPerMwh) : "—"}/MWh`)}`,
      `${chip(`Power ${r.powerPrice !== null ? usd(r.powerPrice) : "—"}`)} · ${chip(`Hashprice ${r.hashprice !== null ? usd(r.hashprice) : "—"}/PH/day`)}`,
    ].join("\n"),
    i(esc(demo ? "Demo data · no Telegraph receipts" : receiptsLine(r))),
  ].filter((x): x is string => x !== null);
  // The demo site exists only on the demo-day screen: no breakdown, receipts or snooze for it.
  const buttons = demo
    ? appUrl
      ? [{ text: "Open demo day", url: `${appUrl}/demo-day` }]
      : []
    : siteButtons(r, appUrl, [{ text: "Snooze 1h", data: `snooze:${r.siteId}` }]);
  return { kind: "change", siteId: r.siteId, text: blocks.join("\n\n"), buttons };
}

/** ⚠️ The price provider did not respond for the site. */
export function providerAlert(r: DecisionRecord, last: DecisionRecord | null): BotMessage {
  const lastText = last?.decision ? `Last call (${utcTime(last.hour)}): ${b(chip(DECISION_LABEL[last.decision]))}.` : "No earlier call.";
  return {
    kind: "provider",
    siteId: r.siteId,
    text: [`⚠️ ${b(esc(r.siteName))}: grid price unavailable`, lastText, i("Retrying in 10 min.")].join("\n\n"),
    buttons: [],
  };
}

export function limitAlert(limitUsd: number, appUrl: string | null): BotMessage {
  return {
    kind: "limit",
    text: [`⛔ ${b("Daily spend limit reached")}`, `Limit ${b(chip(usd(limitUsd)))} a day. Calls are paused until 00:00${NBSP}UTC.`].join("\n\n"),
    buttons: appUrl ? [{ text: "Raise limit", url: `${appUrl}/spend#settings` }] : [],
  };
}

export function networkAlert(what: "Telegraph" | "market data" = "Telegraph"): BotMessage {
  return { kind: "network", text: [`⚠️ ${b(`Can't reach ${esc(what)}`)}`, "I'll keep trying and tell you when it's back."].join("\n\n"), buttons: [] };
}

/** Reminder while the outage lasts (every few hours), so a single morning message is not the only signal. */
export function networkStillDownAlert(what: "Telegraph" | "market data", hours: number): BotMessage {
  const h = Math.max(1, Math.round(hours));
  return {
    kind: "network",
    text: [`⚠️ ${b(`Still can't get ${esc(what)} · ${h} h`)}`, "Decisions stay paused until fresh paid data arrives. I keep retrying every 10 minutes."].join("\n\n"),
    buttons: [],
  };
}

export function networkBackAlert(): BotMessage {
  return { kind: "network-back", text: [`✅ ${b("Data is reachable again")}`, "Hourly calls are back on."].join("\n\n"), buttons: [] };
}

/** The honest line about which sites the bot covers. */
function sitesNote(names: string[]): string {
  if (names.length === 0) return "No example sites are set up yet.";
  const word = names.length === 3 ? "three" : String(names.length);
  return `The bot tracks ${word} example ${names.length === 1 ? "site" : "sites"}: ${names.map(esc).join(", ")}. Sites you add in the web app are not tracked here yet.`;
}

/** Greeting: what the bot does, what to tap next, which sites it covers. Buttons call the same replies as /demo and /now. */
function greeting(appUrl: string | null, siteNames: string[]): BotMessage {
  return {
    kind: "start",
    text: [
      `👋 ${b("Hash or Lease")} decides every hour: mine, lease to AI, or switch off. Alerts are on — I'll message you when a call changes.`,
      `Not sure where to start? Tap ${b("See a demo day")} to watch a simulated day, or ${b("Current calls")} to see where the sites stand now.`,
      i(`${sitesNote(siteNames)}\nCommands: /now · /demo · /stop`),
    ].join("\n\n"),
    buttons: [...entryButtons(), ...(appUrl ? [{ text: "Open app", url: appUrl, newRow: true }] : [])],
  };
}

export function startMessage(appUrl: string | null, siteNames: string[] = []): BotMessage {
  return greeting(appUrl, siteNames);
}

export function noSitesMessage(): BotMessage {
  return { kind: "no-sites", text: "No sites to report yet.", buttons: [] };
}

export interface NowInput {
  /** Latest decision for each site, in site order. */
  records: DecisionRecord[];
  now: Date;
  spentUsd: number;
  limitUsd: number;
  /** Text after /now, e.g. "Houston". */
  query?: string;
  appUrl: string | null;
}

/** One site: name and call on separate lines; a stale entry gets an italic "as of". */
function nowBlock(r: DecisionRecord, now: Date): string {
  const emoji = r.decision ? DECISION_EMOJI[r.decision] : "⏸";
  const tail = r.decision ? b(chip(gainPhrase(r))) : esc(r.reason ?? "no data");
  const old = now.getTime() - new Date(r.hour).getTime() > 2 * 3600_000 ? ` · ${i(chip(`as of ${utcTime(r.hour)} UTC`))}` : "";
  return `${emoji} ${b(esc(r.siteName))}\n${chip(decisionText(r))} · ${tail}${old}`;
}

/** Reply to /now: all sites or one (by partial name). */
export function nowMessage(input: NowInput): BotMessage {
  const { records, now, appUrl } = input;
  if (records.length === 0) {
    return { kind: "now", text: "No calls yet. The hourly agent hasn't run yet.", buttons: [] };
  }
  const head = `${b("Right now")} · ${chip(`${utcTime(now.toISOString())} UTC`)}`;
  const q = input.query?.trim().toLowerCase();
  if (q) {
    const r = records.find((x) => x.siteName.toLowerCase().includes(q) || x.siteId === q);
    if (!r) {
      return {
        kind: "now",
        text: `No site matches “${esc(input.query!.trim())}”. Your sites: ${records.map((x) => esc(x.siteName)).join(", ")}.`,
        buttons: [],
      };
    }
    const blocks = [head, nowBlock(r, now)];
    if (r.options) {
      const o = r.options;
      blocks.push(`Per MWh: ${chip(`Mine ${signedUsd(o.mine)}`)} · ${chip(`Lease ${o.lease === null ? "—" : signedUsd(o.lease)}`)} · ${chip(`Off ${usd(o.off, 0)}`)}`);
    }
    blocks.push(i(esc(receiptsLine(r, true))));
    return { kind: "now", siteId: r.siteId, text: blocks.join("\n\n"), buttons: siteButtons(r, appUrl) };
  }
  const blocks = [head, ...records.map((r) => nowBlock(r, now)), i(chip(`Spent today: ${usd(input.spentUsd)} of ${usd(input.limitUsd)}`))];
  return { kind: "now", text: blocks.join("\n\n"), buttons: appUrl ? [{ text: "Open app", url: appUrl }] : [] };
}

function receiptLine(x: RecordedReceipt): string {
  const at = x.fetchedAt ? `${utcTime(x.fetchedAt)} UTC` : "time n/a";
  if (x.status === "input") return `${esc(x.label)} · your input (no receipt)`;
  if (x.status === "demo") return `${esc(x.label)} · demo number (invented, no receipt)`;
  if (x.status === "public") return `${esc(x.label)} · ${esc(x.service ?? "public data")} · ${esc(x.provider ?? "public source")} · ${at} · free public source`;
  if (x.status === "unavailable") return `${esc(x.label)} · ${esc(x.service ?? "—")} · unavailable`;
  return [b(esc(x.service ?? x.label)), esc(x.provider ?? "—"), at, usd(x.costUsd ?? 0, 3), esc(x.hash ?? "no hash"), x.status === "stale" ? "stale" : null].filter(Boolean).join(" · ");
}

/** "Receipts" button: list of receipts for the latest decision. */
export function receiptsMessage(r: DecisionRecord): BotMessage {
  const head = `${b("Receipts")} · ${esc(r.siteName)} · ${utcTime(r.hour)} UTC · testnet`;
  const links = r.receipts.filter((x) => x.status === "verified" && x.proofUrl?.startsWith("https://"));
  return {
    kind: "receipts",
    siteId: r.siteId,
    text: [head, r.receipts.map(receiptLine).join("\n\n")].join("\n\n"),
    buttons: links.map((x) => ({ text: `${x.service ?? x.label} ${x.proofUrl!.includes("etherscan.io") ? "on Sepolia" : "receipt"} ↗`, url: x.proofUrl! })),
  };
}

interface NowReplyInput {
  sites: { id: string; name: string }[];
  decisions: DecisionRecord[];
  now: Date;
  spentUsd: number;
  limitUsd: number;
  query?: string;
  appUrl: string | null;
}

/** Latest agent entry for each known site, in site order. */
function latestRecords(input: Pick<NowReplyInput, "sites" | "decisions">): DecisionRecord[] {
  const latest = new Map<string, DecisionRecord>();
  for (const r of input.decisions) {
    const prev = latest.get(r.siteId);
    if (!prev || r.at >= prev.at) latest.set(r.siteId, r);
  }
  return input.sites
    .map((s) => latest.get(s.id))
    .filter((r): r is DecisionRecord => !!r)
    .map((r) => ({ ...r, siteName: input.sites.find((s) => s.id === r.siteId)!.name }));
}

/** Full /now: sites + agent entries → reply (no sites, no entries, all, one). */
export function nowReply(input: NowReplyInput): BotMessage {
  if (input.sites.length === 0) return noSitesMessage();
  const records = latestRecords(input);
  return nowMessage({ records, now: input.now, spentUsd: input.spentUsd, limitUsd: input.limitUsd, query: input.query, appUrl: input.appUrl });
}

/** Stretches of the day with the same call: [range, call], e.g. ["00:00–11:00", "⚡ Lease to AI"]. */
function segments(decisions: DecisionRecord[]): [string, string][] {
  const out: { from: string; to: number; text: string }[] = [];
  for (const r of [...decisions].sort((a, b) => a.hour.localeCompare(b.hour))) {
    const text = r.decision ? `${DECISION_EMOJI[r.decision]} ${DECISION_LABEL[r.decision]}` : "⏸ on hold";
    const end = new Date(r.hour).getTime() + 3600_000;
    const last = out[out.length - 1];
    if (last && last.text === text && last.to === new Date(r.hour).getTime()) last.to = end;
    else out.push({ from: r.hour, to: end, text });
  }
  return out.map((s) => {
    const to = utcTime(new Date(s.to).toISOString());
    return [`${utcTime(s.from)}–${to === "00:00" ? "24:00" : to}`, s.text];
  });
}

/** Stretches of the day as plain lines: "00:00–11:00 ⚡ Lease to AI". */
export function daySegments(decisions: DecisionRecord[]): string[] {
  return segments(decisions).map(([range, text]) => `${range} ${text}`);
}

/** Reply to /demo: the simulated demo day replayed into the chat — intro, every change alert, the day at a glance. */
export function demoDayReplay(input: { siteName: string; siteLine: string; decisions: DecisionRecord[]; appUrl: string | null }): BotMessage[] {
  const changes = input.decisions.filter((r) => r.status === "ok" && r.changed);
  const button = input.appUrl ? [{ text: "Open demo day", url: `${input.appUrl}/demo-day` }] : [];
  const intro: BotMessage = {
    kind: "demo",
    text: [
      `🧪 ${b("Demo day")}`,
      `${b(esc(input.siteName))}\n${input.siteLine.split(" · ").map(chip).join(" · ")}`,
      `One simulated day, hour by hour. The call changes ${b(`${changes.length} ${changes.length === 1 ? "time" : "times"}`)}; here is what I would send.`,
      i("Invented prices · no Telegraph requests · no receipts"),
    ].join("\n\n"),
    buttons: [],
  };
  const summary: BotMessage = {
    kind: "demo",
    text: [
      `🧪 ${b("Demo day at a glance")}`,
      segments(input.decisions)
        .map(([range, text]) => `${range}  ${b(chip(text))}`)
        .join("\n"),
      i("Simulated, UTC · real calls: /now"),
    ].join("\n\n"),
    buttons: [...button, { text: "Current calls", data: CALLBACK_NOW, newRow: button.length > 0 }],
  };
  return [intro, ...changes.map((r) => changeAlert(r, input.appUrl)), summary];
}

/**
 * Replies to /start (and to a repeated /start): a greeting with two buttons, then the current call for every site
 * from the agent's latest entries — the same text as /now. No entries yet → an honest "first call within the hour".
 * Reads only; sends nothing and buys nothing.
 */
export function welcomeReply(input: NowReplyInput): BotMessage[] {
  // No sites: the greeting alone (its buttons still work).
  const hello = greeting(input.appUrl, input.sites.map((x) => x.name));
  if (input.sites.length === 0) return [hello];
  if (latestRecords(input).length === 0) {
    return [hello, { kind: "now", text: "The first call will arrive within the next hour.", buttons: [] }];
  }
  // The query is ignored: the welcome always shows every site.
  return [hello, nowReply({ ...input, query: undefined })];
}
