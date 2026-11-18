"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Check, ChevronDown, Copy, Cpu, Globe, Power, Server, User, X } from "lucide-react";
import type { Decision } from "@/lib/decision";
import { DECISION_LABEL } from "@/lib/decision";
import type { Receipt } from "@/lib/types";
import { ago, usd, utcDate, utcTime } from "@/lib/format";
import { RECEIPT_STATUS, receiptSummary, receiptTitle } from "@/lib/receipt";
import { useVariant } from "./useVariant";

export function DecisionIcon({ d, size = 22 }: { d: Decision; size?: number }) {
  const Icon = d === "mine" ? Cpu : d === "lease" ? Server : Power;
  return <Icon size={size} strokeWidth={2.25} aria-hidden />;
}

export function DecisionBadge({ d }: { d: Decision }) {
  return (
    <span className={`badge ${d}`}>
      <DecisionIcon d={d} size={14} />
      {DECISION_LABEL[d]}
    </span>
  );
}

export function Skel({ w = 80, h = 14, style }: { w?: number | string; h?: number; style?: React.CSSProperties }) {
  return <span className="skel" style={{ width: w, height: h, ...style }} aria-hidden />;
}

export function Banner({ kind, children, actions }: { kind: "warn" | "bad"; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className={`banner ${kind}`} role={kind === "bad" ? "alert" : "status"}>
      <div className="grow">{children}</div>
      {actions}
    </div>
  );
}

function copy(text: string) {
  try {
    void navigator.clipboard?.writeText(text);
  } catch {
    /* clipboard unavailable — silently ignore */
  }
}

const RECEIPT_VARIANTS = ["a", "b"] as const;

/**
 * Telegraph receipt next to a number: a small icon beside the figure, details on tap (popover; bottom sheet on phone).
 * The sheet reads top-down: status, what was bought and for how much, the proof link, then the technical fields, quieter.
 * Variant A (default): big number, filled button, details always visible. Variant B (`?receipt=b`): two tiles, tinted button,
 * details folded under "Technical details".
 */
export function ReceiptChip({ receipt, now }: { receipt: Receipt; now: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const variant = useVariant("receipt", "a", RECEIPT_VARIANTS);
  const r = receipt;

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const title = receiptTitle(r.status);
  const st = RECEIPT_STATUS[r.status];
  return (
    <span className="chip-wrap">
      <button
        ref={trigger}
        type="button"
        className={`rcpt ${r.status === "input" ? "is-input" : r.status}`}
        aria-label={`${title}. Show details`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ReceiptGlyph status={r.status} />
      </button>
      {open && (
        <>
          <div className="sheet-backdrop" onClick={close} aria-hidden />
          <div className={`receipt-panel rs rs-${variant}`} role="dialog" aria-label={title}>
            <span className="rs-grabber" aria-hidden />
            <div className="rs-head">
              {variant === "a" ? (
                <>
                  <span className={`rs-seal ${r.status}`} aria-hidden>
                    <ReceiptGlyph status={r.status} size={16} />
                  </span>
                  <span className="rs-title">
                    <b>{st.title}</b>
                    <span className="rs-sub">{st.sub}</span>
                  </span>
                </>
              ) : (
                <span className="rs-title rs-title-b">
                  <span className={`badge rs-status ${r.status}`}>
                    <ReceiptGlyph status={r.status} />
                    {st.title}
                  </span>
                  <span className="rs-sub">{st.sub}</span>
                </span>
              )}
              <button ref={closeBtn} type="button" className="rs-close" onClick={close} aria-label="Close">
                <X size={16} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
            {r.status === "input" ? (
              <p className="rs-text">You entered this number yourself, so there is no Telegraph receipt for it.</p>
            ) : r.status === "demo" ? (
              <p className="rs-text">Invented number for the demo day. Nothing was requested or paid, so there is no receipt.</p>
            ) : (
              <ReceiptBody r={r} now={now} variant={variant} />
            )}
          </div>
        </>
      )}
    </span>
  );
}

function ReceiptBody({ r, now, variant }: { r: Receipt; now: string; variant: "a" | "b" }) {
  const sum = receiptSummary(r);
  const paid = r.status === "public" ? "Free" : r.costUsd ? `${usd(r.costUsd, 3)} USDC` : "Nothing paid";
  const paidNote =
    r.status === "public" ? "public source, no receipt" : r.costUsd ? (r.network === "testnet" ? "testnet" : r.network) : "no Telegraph receipt";
  const proof = r.proofUrl ? (
    <a href={r.proofUrl} target="_blank" rel="noreferrer" className={`btn rs-proof ${variant === "a" && r.status !== "public" ? "accent" : "tint"}`}>
      {r.status === "public" ? "Open source" : r.proofUrl.includes("etherscan.io") ? "View payment on Sepolia" : "View Telegraph receipt"}
      <ArrowUpRight size={18} strokeWidth={2.25} aria-hidden />
    </a>
  ) : r.hash ? (
    <p className="rs-note">The proof link is not available in the demo.</p>
  ) : null;
  const details = <ReceiptDetails r={r} now={now} />;
  const also = sum.value && sum.note ? <p className="rs-note">Also used: {sum.note[0].toLowerCase() + sum.note.slice(1)}.</p> : null;

  if (variant === "b") {
    return (
      <>
        <div className="rs-tiles">
          <div className="rs-tile">
            <span className="rs-label">{sum.label}</span>
            {sum.value ? <span className="rs-tile-v num">{sum.value}</span> : <span className="rs-tile-t">{sum.note ?? "—"}</span>}
          </div>
          <div className="rs-tile">
            <span className="rs-label">Paid</span>
            <span className="rs-tile-v rs-tile-v2 num">{paid}</span>
            <span className="rs-tile-n">{paidNote}</span>
          </div>
        </div>
        {proof && <div className="rs-action">{proof}</div>}
        <details className="rs-more">
          <summary>
            Technical details
            <ChevronDown size={16} strokeWidth={2.25} aria-hidden />
          </summary>
          {details}
          {also}
        </details>
      </>
    );
  }
  return (
    <>
      <div className="rs-main">
        <span className="rs-label">{sum.label}</span>
        {sum.value ? <span className="rs-value num">{sum.value}</span> : sum.note && <p className="rs-text">{sum.note}</p>}
        <span className="rs-cost num">
          {r.costUsd ? "Paid " : ""}
          <b>{paid}</b> · {paidNote}
        </span>
      </div>
      {proof && <div className="rs-action">{proof}</div>}
      <div className="rs-details">
        <h3 className="rs-details-h">Details</h3>
        {details}
        {also}
      </div>
    </>
  );
}

function ReceiptDetails({ r, now }: { r: Receipt; now: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <dl className="rs-list">
      {r.service && (
        <div>
          <dt>Service</dt>
          <dd><code>{r.service}</code></dd>
        </div>
      )}
      {r.provider && (
        <div>
          <dt>Provider</dt>
          <dd>{r.provider}</dd>
        </div>
      )}
      {r.fetchedAt && (
        <div>
          <dt>Fetched</dt>
          <dd className="num">
            {utcTime(r.fetchedAt, true)} UTC · {ago(r.fetchedAt, now)}
            <span className="rs-dd-sub">{utcDate(r.fetchedAt)}</span>
          </dd>
        </div>
      )}
      {r.hash && (
        <div>
          <dt>Receipt</dt>
          <dd className="rs-hash">
            <code>{r.hash}</code>
            <button
              type="button"
              className="rs-copy"
              aria-label={copied ? "Copied" : "Copy receipt hash"}
              onClick={() => {
                copy(r.hash!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={14} strokeWidth={2.5} aria-hidden /> : <Copy size={14} strokeWidth={2.25} aria-hidden />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </dd>
        </div>
      )}
      {r.status !== "public" && (
        <div>
          <dt>Network</dt>
          <dd>{r.network === "testnet" ? "Testnet (Sepolia)" : r.network}</dd>
        </div>
      )}
    </dl>
  );
}

function ReceiptGlyph({ status, size = 12 }: { status: Receipt["status"]; size?: number }) {
  if (status === "input") return <User size={size} strokeWidth={2.5} aria-hidden />;
  if (status === "public") return <Globe size={size} strokeWidth={2.5} aria-hidden />;
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  if (status === "verified") return <svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (status === "stale") return <svg {...p}><path d="M12 7v6" /><path d="M12 17h.01" /></svg>;
  return <svg {...p}><circle cx="12" cy="12" r="6" /></svg>;
}
