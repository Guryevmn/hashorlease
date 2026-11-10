// Тексты Telegram-бота (docs/screens.md §6). Чистые функции: без сети и grammY, чтобы покрыть тестами.
// Простой текст без Markdown — не нужно экранировать названия площадок.

import { DECISION_LABEL, type Decision } from "../decision";
import { signedUsd, usd, utcTime } from "../format";
import type { DecisionRecord, RecordedReceipt } from "../agent/types";

export interface Button {
  text: string;
  /** Ссылка (только https: Telegram не принимает localhost). */
  url?: string;
  /** Данные для кнопки-обработчика, например "snooze:houston". */
  data?: string;
}

export type MessageKind = "change" | "provider" | "limit" | "network" | "network-back" | "now" | "start" | "no-sites" | "receipts";

export interface BotMessage {
  kind: MessageKind;
  text: string;
  buttons: Button[];
  /** Площадка, к которой относится оповещение (для «Snooze 1h»). */
  siteId?: string;
}

export const DECISION_EMOJI: Record<Decision, string> = { mine: "⛏", lease: "⚡", off: "⏻" };

/** Адрес приложения для кнопок; только публичный https-адрес. */
export function publicAppUrl(raw: string | undefined): string | null {
  const v = raw?.trim().replace(/\/+$/, "");
  return v && /^https:\/\/[^\s/]+/.test(v) ? v : null;
}

function money(amount: number, unit: string): string {
  const digits = Math.abs(amount) < 10 ? 2 : 0;
  return `${signedUsd(amount, digits)}${unit}`;
}

/** Выгода решения коротко: «+$136/h vs. mining», «saves $119/h», «+$0.79/day». */
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

/** 🔄 Смена решения (приходит само). */
export function changeAlert(r: DecisionRecord, appUrl: string | null): BotMessage {
  const lines = [
    `🔄 ${r.siteName}: ${r.previous ? DECISION_LABEL[r.previous] : "—"} → ${r.decision ? DECISION_LABEL[r.decision] : "on hold"}`,
    `${gainPhrase(r, true)} · ${r.chosenUsdPerMwh !== null ? usd(r.chosenUsdPerMwh) : "—"}/MWh`,
    `Power ${r.powerPrice !== null ? usd(r.powerPrice) : "—"} · Hashprice ${r.hashprice !== null ? usd(r.hashprice) : "—"}/PH/day`,
    receiptsLine(r),
  ];
  return {
    kind: "change",
    siteId: r.siteId,
    text: lines.join("\n"),
    buttons: siteButtons(r, appUrl, [{ text: "Snooze 1h", data: `snooze:${r.siteId}` }]),
  };
}

/** ⚠️ Поставщик цены не ответил по площадке. */
export function providerAlert(r: DecisionRecord, last: DecisionRecord | null): BotMessage {
  const lastText = last?.decision ? `Last call (${utcTime(last.hour)}): ${DECISION_LABEL[last.decision]}.` : "No earlier call.";
  return {
    kind: "provider",
    siteId: r.siteId,
    text: `⚠️ ${r.siteName}: grid price unavailable. ${lastText} Retrying in 10 min.`,
    buttons: [],
  };
}

export function limitAlert(limitUsd: number, appUrl: string | null): BotMessage {
  return {
    kind: "limit",
    text: `⛔ Daily spend limit reached (${usd(limitUsd)}). Calls are paused until 00:00 UTC.`,
    buttons: appUrl ? [{ text: "Raise limit", url: `${appUrl}/spend#settings` }] : [],
  };
}

export function networkAlert(what: "Telegraph" | "market data" = "Telegraph"): BotMessage {
  return { kind: "network", text: `⚠️ Can't reach ${what}. I'll keep trying and tell you when it's back.`, buttons: [] };
}

export function networkBackAlert(): BotMessage {
  return { kind: "network-back", text: "✅ Data is reachable again. Hourly calls are back on.", buttons: [] };
}

export function startMessage(appUrl: string | null): BotMessage {
  return {
    kind: "start",
    text: [
      "I check every hour whether to mine, lease to AI, or switch off. Add a site in the app first.",
      "",
      "/now — the current call for every site",
      "/now Houston — one site",
      "/stop — stop alerts",
    ].join("\n"),
    buttons: appUrl ? [{ text: "Open app", url: appUrl }] : [],
  };
}

export function noSitesMessage(): BotMessage {
  return { kind: "no-sites", text: "No sites yet. Add one in the app to get calls here.", buttons: [] };
}

export interface NowInput {
  /** Последнее решение по каждой площадке, в порядке площадок. */
  records: DecisionRecord[];
  now: Date;
  spentUsd: number;
  limitUsd: number;
  /** Текст после /now, например «Houston». */
  query?: string;
  appUrl: string | null;
}

function nowLine(r: DecisionRecord, now: Date): string {
  const emoji = r.decision ? DECISION_EMOJI[r.decision] : "⏸";
  const tail = r.decision ? gainPhrase(r) : (r.reason ?? "no data");
  const old = now.getTime() - new Date(r.hour).getTime() > 2 * 3600_000 ? ` (as of ${utcTime(r.hour)} UTC)` : "";
  return `${emoji} ${r.siteName} — ${decisionText(r)} · ${tail}${old}`;
}

/** Ответ на /now: все площадки или одна (по части названия). */
export function nowMessage(input: NowInput): BotMessage {
  const { records, now, appUrl } = input;
  if (records.length === 0) {
    return { kind: "now", text: "No calls yet. The hourly agent hasn't run yet (npm run agent).", buttons: [] };
  }
  const head = `Right now · ${utcTime(now.toISOString())} UTC`;
  const q = input.query?.trim().toLowerCase();
  if (q) {
    const r = records.find((x) => x.siteName.toLowerCase().includes(q) || x.siteId === q);
    if (!r) {
      return {
        kind: "now",
        text: `No site matches “${input.query!.trim()}”. Your sites: ${records.map((x) => x.siteName).join(", ")}.`,
        buttons: [],
      };
    }
    const lines = [head, nowLine(r, now)];
    if (r.options) {
      const o = r.options;
      lines.push(`Mine ${signedUsd(o.mine)} · Lease ${o.lease === null ? "—" : signedUsd(o.lease)} · Off ${usd(o.off, 0)} /MWh`);
    }
    lines.push(receiptsLine(r, true));
    return { kind: "now", siteId: r.siteId, text: lines.join("\n"), buttons: siteButtons(r, appUrl) };
  }
  const lines = [head, ...records.map((r) => nowLine(r, now)), `Spent today: ${usd(input.spentUsd)} of ${usd(input.limitUsd)}`];
  return { kind: "now", text: lines.join("\n"), buttons: appUrl ? [{ text: "Open app", url: appUrl }] : [] };
}

function receiptLine(x: RecordedReceipt): string {
  const at = x.fetchedAt ? `${utcTime(x.fetchedAt)} UTC` : "time n/a";
  if (x.status === "input") return `${x.label} · your input (no receipt)`;
  if (x.status === "public") return `${x.label} · ${x.service ?? "public data"} · ${x.provider ?? "public source"} · ${at} · free public source`;
  if (x.status === "unavailable") return `${x.label} · ${x.service ?? "—"} · unavailable`;
  return [x.service ?? x.label, x.provider ?? "—", at, usd(x.costUsd ?? 0, 3), x.hash ?? "no hash", x.status === "stale" ? "stale" : null]
    .filter(Boolean)
    .join(" · ");
}

/** Кнопка «Receipts»: список чеков последнего решения. */
export function receiptsMessage(r: DecisionRecord): BotMessage {
  const lines = [`Receipts · ${r.siteName} · ${utcTime(r.hour)} UTC · testnet`, ...r.receipts.map(receiptLine)];
  const links = r.receipts.filter((x) => x.status === "verified" && x.proofUrl?.startsWith("https://"));
  return {
    kind: "receipts",
    siteId: r.siteId,
    text: lines.join("\n"),
    buttons: links.map((x) => ({ text: `${x.service ?? x.label} on Sepolia ↗`, url: x.proofUrl! })),
  };
}

/** /now целиком: площадки + записи агента → ответ (нет площадок, нет записей, все, одна). */
export function nowReply(input: {
  sites: { id: string; name: string }[];
  decisions: DecisionRecord[];
  now: Date;
  spentUsd: number;
  limitUsd: number;
  query?: string;
  appUrl: string | null;
}): BotMessage {
  if (input.sites.length === 0) return noSitesMessage();
  const latest = new Map<string, DecisionRecord>();
  for (const r of input.decisions) {
    const prev = latest.get(r.siteId);
    if (!prev || r.at >= prev.at) latest.set(r.siteId, r);
  }
  const records = input.sites
    .map((s) => latest.get(s.id))
    .filter((r): r is DecisionRecord => !!r)
    .map((r) => ({ ...r, siteName: input.sites.find((s) => s.id === r.siteId)!.name }));
  return nowMessage({ records, now: input.now, spentUsd: input.spentUsd, limitUsd: input.limitUsd, query: input.query, appUrl: input.appUrl });
}
