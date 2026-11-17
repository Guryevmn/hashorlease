"use client";

import { useEffect, useState } from "react";
import { AppLink } from "./DataProvider";
import { Equal } from "lucide-react";
import { DecisionIcon, Skel } from "./ui";
import type { DecisionOutcome } from "@/lib/decision";
import { gainText } from "@/lib/gain";
import { DECISION_LABEL } from "@/lib/decision";
import { siteFlag } from "@/lib/flags";
import { signedUsd, usd, utcTime } from "@/lib/format";
import type { SiteReport } from "@/lib/types";

export function updatedAt(r: SiteReport): string {
  return r.inputs.power.receipt.fetchedAt ?? r.inputs.hashprice.receipt.fetchedAt ?? r.asOf;
}

export function SiteCard({ report }: { report: SiteReport }) {
  const { site, result } = report;
  const changeStyle = useChangeStyle();
  const changedAt = result && result.ok && result.changed ? utcTime(report.asOf.slice(0, 13) + ":00:00Z") : null;
  const sub =
    site.kind === "grid" ? `${site.nodeLabel} · ${site.mw} MW` : `${site.nodeLabel} · ${Math.round(site.mw * 1000)} kW`;

  return (
    <AppLink href={`/sites/${site.id}`} className="card site-card" aria-label={`${site.name}: open breakdown`}>
      <div className="site-head">
        <div className="site-title">
          <h2>{site.name}</h2>
          <div className="muted small">{siteFlag(site) && <span aria-hidden>{siteFlag(site)} </span>}{sub}</div>
        </div>
        {!result || !result.ok ? (
          <span className="badge paused pill">On hold</span>
        ) : (
          <div className="pills">
            {result.keepAsIs && <span className="badge calm pill">Keep as is</span>}
            <span className={`badge ${result.chosen} pill`}>
              <DecisionIcon d={result.chosen} size={14} />
              {DECISION_LABEL[result.chosen]}
            </span>
            {changeStyle === "chip" && changedAt && report.previousDecision && (
              <span className="badge was pill" title={`Changed at ${changedAt} UTC`}>was {DECISION_LABEL[report.previousDecision]}</span>
            )}
          </div>
        )}
      </div>

      {!result || !result.ok ? (
        <div className="small mt-3">
          {report.pausedReason ?? "Decision unavailable"}
        </div>
      ) : (
        <>
          <GainRow r={result} />
          {result.keepAsIs && (
            <div className="keep-note num">
              <Equal size={16} aria-hidden />
              <span>Difference {usd(keepDifference(result))}/MWh is below your {usd(result.thresholdUsdPerMwh)} threshold</span>
            </div>
          )}
          {/* The update time lives in the market strip above; a card only speaks up when its data is old. */}
          {report.status === "stale" && (
            <div className="muted small num mt-2">
              Updated {utcTime(updatedAt(report))} UTC <span className="badge stale" style={{ marginLeft: "var(--s2)" }}>Outdated</span>
            </div>
          )}
          <div className="opts num" aria-label="Profit per MWh by option">
            <span className="opts-cap">Profit per MWh</span>
            <Opt label="Mine" value={signedUsd(result.options.mine)} best={result.chosen === "mine"} d="mine" />
            {result.options.lease !== null && <Opt label="Lease" value={signedUsd(result.options.lease)} best={result.chosen === "lease"} d="lease" />}
            <Opt label="Off" value={usd(result.options.off, 0)} best={result.chosen === "off"} d="off" />
          </div>
          {changeStyle === "line" && changedAt && report.previousDecision && (
            <div className="change-line num">
              <span className="dot" aria-hidden />
              Changed from {DECISION_LABEL[report.previousDecision]} · {changedAt}
            </div>
          )}
        </>
      )}
    </AppLink>
  );
}

function Opt({ label, value, best, d }: { label: string; value: string; best: boolean; d: string }) {
  return (
    <span className={best ? `badge opt best ${d}` : "badge opt"}>
      <span className="opt-label">{label}</span>
      <span>{value}</span>
    </span>
  );
}

/**
 * How a decision change shows on the card (design review 2026-11, two variants to choose from):
 * "line" (A, default) — a quiet "Changed from Mine · 14:00" line under the options;
 * "chip" (B, open with ?change=chip) — a secondary "was Mine" chip next to the decision.
 */
function useChangeStyle(): "line" | "chip" {
  const [style, setStyle] = useState<"line" | "chip">("line");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("change") === "chip") setStyle("chip");
  }, []);
  return style;
}

/** Margin that made us keep everything as is, $/MWh. */
export function keepDifference(r: DecisionOutcome): number {
  if (r.chosen === r.best) return r.marginToNext;
  return (r.options[r.best] as number) - (r.options[r.chosen] as number);
}

function GainRow({ r }: { r: DecisionOutcome }) {
  const g = gainText(r);
  return (
    <div className="gain-row num">
      <span className="gain">{g.big}</span>
      {g.small && <span className="gain-small">{g.small}</span>}
    </div>
  );
}

export function SiteCardSkeleton() {
  return (
    <div className="card" aria-hidden>
      <Skel w={140} h={18} />
      <div className="mt-2"><Skel w={200} h={12} /></div>
      <div className="mt-4"><Skel w={180} h={26} /></div>
      <div className="mt-3"><Skel w={120} h={16} /></div>
      <div className="mt-4"><Skel w={260} h={12} /></div>
    </div>
  );
}

