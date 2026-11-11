"use client";

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
              <DecisionIcon d={result.chosen} />
              {DECISION_LABEL[result.chosen]}
            </span>
          </div>
        )}
      </div>

      {!result || !result.ok ? (
        <div className="small" style={{ marginTop: 12 }}>
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
          <div className="muted small num" style={{ marginTop: 8 }}>
            Updated {utcTime(updatedAt(report))} UTC
            {report.status === "stale" && <span className="badge stale" style={{ marginLeft: 8 }}>Outdated</span>}
          </div>
          <div className="opts num" aria-label="Profit per MWh by option">
            <Opt label="Mine" value={signedUsd(result.options.mine)} best={result.chosen === "mine"} />
            {result.options.lease !== null && <Opt label="Lease" value={signedUsd(result.options.lease)} best={result.chosen === "lease"} />}
            <Opt label="Off" value={usd(result.options.off, 0)} best={result.chosen === "off"} />
          </div>
          {result.changed && report.previousDecision && (
            <div className="small" style={{ marginTop: 8 }}>
              <span className="dot" aria-hidden />
              Changed from {DECISION_LABEL[report.previousDecision]} · {utcTime(report.asOf.slice(0, 13) + ":00:00Z")}
            </div>
          )}
        </>
      )}
    </AppLink>
  );
}

function Opt({ label, value, best }: { label: string; value: string; best: boolean }) {
  return (
    <div className={best ? "opt best" : "opt"}>
      <span className="muted">{label}</span>
      <span>{value}</span>
    </div>
  );
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
      <div style={{ marginTop: 8 }}><Skel w={200} h={12} /></div>
      <div style={{ marginTop: 16 }}><Skel w={180} h={26} /></div>
      <div style={{ marginTop: 12 }}><Skel w={120} h={16} /></div>
      <div style={{ marginTop: 12 }}><Skel w={260} h={12} /></div>
    </div>
  );
}

