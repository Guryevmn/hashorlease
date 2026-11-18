// Receipt sheet copy: what was bought, for how much, and the status line. Pure, so the sheet and tests share it.

import type { Receipt } from "./types";

export const RECEIPT_STATUS: Record<Receipt["status"], { title: string; sub: string }> = {
  verified: { title: "Verified", sub: "by a Telegraph receipt" },
  stale: { title: "Stale", sub: "older than expected" },
  unavailable: { title: "Unavailable", sub: "showing the last known value" },
  input: { title: "Your input", sub: "no Telegraph receipt" },
  public: { title: "Public source", sub: "not bought via Telegraph" },
  demo: { title: "Demo number", sub: "invented, no request and no receipt" },
};

/** One sentence for screen readers and the trigger label, e.g. "Verified by a Telegraph receipt". */
export function receiptTitle(status: Receipt["status"]): string {
  const s = RECEIPT_STATUS[status];
  return status === "input" ? s.title : `${s.title} ${s.sub}`;
}

const LABEL: Record<string, string> = {
  CRYPTO_PRICE_USD: "BTC price",
  WEB_SEARCH_GENERAL: "Lease-rate web search",
  GRID_POWER_PRICE: "Power price",
  "Day-ahead price": "Power price",
};

export interface ReceiptSummary {
  /** What was bought or read, e.g. "BTC price". */
  label: string;
  /** The bought number when the receipt states it, e.g. "$64,547"; otherwise null. */
  value: string | null;
  /** The rest of the source line, e.g. "Hashrate 983 EH/s and rewards from mempool.space". */
  note: string | null;
}

export function receiptSummary(r: Receipt): ReceiptSummary {
  const label = (r.service && LABEL[r.service]) ?? r.service ?? "Data";
  const src = (r.source ?? "").trim();
  const btc = r.service === "CRYPTO_PRICE_USD" && r.status !== "unavailable" ? /^BTC\s+(\$[\d,]+(?:\.\d+)?)/.exec(src) : null;
  if (btc) {
    const rest = src.split(";").slice(1).join(";").trim();
    return { label, value: btc[1], note: rest ? rest[0].toUpperCase() + rest.slice(1) : null };
  }
  return { label, value: null, note: src || null };
}
