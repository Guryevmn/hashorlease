"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Cpu, Globe, Power, Server, User } from "lucide-react";
import type { Decision } from "@/lib/decision";
import { DECISION_LABEL } from "@/lib/decision";
import type { Receipt } from "@/lib/types";
import { ago, usd, utcDate, utcTime } from "@/lib/format";

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

const STATUS_TITLE: Record<Receipt["status"], string> = {
  verified: "Verified by a Telegraph receipt",
  stale: "Stale: older than expected",
  unavailable: "Unavailable: showing the last known value",
  input: "Your input",
  public: "Public source, not bought via Telegraph",
};

/** Telegraph receipt next to a number: a small icon beside the figure, details on tap (popover; bottom sheet on phone). */
export function ReceiptChip({ receipt, now }: { receipt: Receipt; now: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const r = receipt;

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const title = STATUS_TITLE[r.status];
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
          <div className="receipt-panel" role="dialog" aria-label="Receipt details">
            <div className="receipt-head">
              <b>{title}</b>
              <button type="button" className="btn small" onClick={close}>Close</button>
            </div>
            {r.status === "input" ? (
              <p className="small muted" style={{ margin: 0 }}>You entered this number yourself, so there is no Telegraph receipt for it.</p>
            ) : (
              <dl>
                {r.service && (<><dt>Service</dt><dd><code>{r.service}</code></dd></>)}
                {r.provider && (<><dt>Provider</dt><dd><code>{r.provider}</code></dd></>)}
                {r.fetchedAt && (<><dt>Fetched</dt><dd>{utcDate(r.fetchedAt)}, {utcTime(r.fetchedAt, true)} UTC · {ago(r.fetchedAt, now)}</dd></>)}
                {r.costUsd !== undefined && r.status !== "public" && (<><dt>Request cost</dt><dd>{usd(r.costUsd, 3)} USDC · {r.network}</dd></>)}
                {r.status === "public" && (<><dt>Request cost</dt><dd>Free · no payment, no Telegraph receipt</dd></>)}
                {r.hash && (
                  <>
                    <dt>Receipt</dt>
                    <dd>
                      <code>{r.hash}</code>{" "}
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          copy(r.hash!);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                      >
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </dd>
                  </>
                )}
                {r.source && (<><dt>Source</dt><dd>{r.source}</dd></>)}
                <dt>{r.status === "public" ? "Source data" : "Proof"}</dt>
                <dd>
                  {r.proofUrl ? (
                    <a href={r.proofUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                      {r.status === "public" ? "Open source ↗" : "View payment on Sepolia ↗"}
                    </a>
                  ) : (
                    <span className="muted">{r.hash ? "View proof ↗ (not available in demo)" : "No proof link"}</span>
                  )}
                </dd>
                {r.status !== "public" && (<><dt>Network</dt><dd>{r.network === "testnet" ? "testnet (Sepolia)" : r.network}</dd></>)}
              </dl>
            )}
          </div>
        </>
      )}
    </span>
  );
}

function ReceiptGlyph({ status }: { status: Receipt["status"] }) {
  if (status === "input") return <PersonIcon />;
  if (status === "public") return <Globe size={12} strokeWidth={2.5} aria-hidden />;
  const p = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  if (status === "verified") return <svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (status === "stale") return <svg {...p}><path d="M12 7v6" /><path d="M12 17h.01" /></svg>;
  return <svg {...p}><circle cx="12" cy="12" r="6" /></svg>;
}

function PersonIcon() {
  return <User size={12} strokeWidth={2.5} aria-hidden />;
}
