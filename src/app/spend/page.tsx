"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock } from "lucide-react";
import { useData, useAsync } from "@/components/DataProvider";
import { Banner, Skel } from "@/components/ui";
import { ago, usd, utcTime } from "@/lib/format";
import { DECISION_LABEL } from "@/lib/decision";
import type { AgentStatus } from "@/lib/agent/types";
import type { SpendLogEntry, SpendState } from "@/lib/types";
import { acknowledgeLimit } from "@/components/limitAck";

export default function SpendPage() {
  const { ds, bump } = useData();
  const { data, error, loading, reload } = useAsync((d) => d.getSpend());

  if (error) {
    return (
      <>
        <h1 className="page-title">Usage</h1>
        <Banner kind="bad" actions={<button className="btn small" onClick={reload}>Retry</button>}>
          Can&apos;t load usage history. Limit is still enforced.
        </Banner>
      </>
    );
  }
  if (loading || !data) {
    return (
      <div aria-busy="true" aria-label="Loading spend">
        <h1 className="page-title">Usage</h1>
        <div className="group">
          <div className="card"><Skel w={220} h={30} /><div className="mt-3"><Skel w="100%" h={10} /></div></div>
          <div className="card">{[0, 1, 2, 3].map((i) => <div key={i} style={{ margin: "var(--s3) 0" }}><Skel w="85%" h={14} /></div>)}</div>
        </div>
      </div>
    );
  }

  return <SpendBody s={data} serverLimit={ds.serverLimit} onSave={async (v) => { await ds.updateSpendSettings(v); bump(); }} />;
}

function SpendBody({
  s,
  serverLimit,
  onSave,
}: {
  s: SpendState;
  /** Limit is set on the server (.env): the UI only displays it. */
  serverLimit: boolean;
  onSave: (v: { limitUsd: number; stopAtLimit: boolean; alertAtPct: number }) => Promise<void>;
}) {
  const { bump } = useData();
  const agent = useAsync((d) => d.getAgentStatus());
  const [resumeNote, setResumeNote] = useState(false);
  const pct = Math.min(100, (s.spentUsd / s.limitUsd) * 100);
  const limitInput = useRef<HTMLInputElement>(null);
  const [limit, setLimit] = useState(String(s.limitUsd));
  const [stop, setStop] = useState(s.stopAtLimit);
  const [alertPct, setAlertPct] = useState(String(s.alertAtPct));
  const [errs, setErrs] = useState<{ limit?: string; alert?: string }>({});
  const [saved, setSaved] = useState(false);
  const maxReq = Math.max(...s.byService.map((b) => b.requests), 1);

  useEffect(() => {
    if (window.location.hash === "#settings") limitInput.current?.focus();
  }, []);

  async function save() {
    const l = Number(limit.replace(",", "."));
    const a = Number(alertPct);
    const e: typeof errs = {};
    if (!serverLimit && (!Number.isFinite(l) || l <= 0)) e.limit = "Daily limit must be greater than 0";
    if (!Number.isFinite(a) || a < 1 || a > 100) e.alert = "Alert must be between 1 and 100%";
    setErrs(e);
    if (e.limit || e.alert) return;
    await onSave({ limitUsd: serverLimit ? s.limitUsd : l, stopAtLimit: serverLimit ? true : stop, alertAtPct: a });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function toggleStop(next: boolean) {
    if (!next && !window.confirm("Turn off the safety stop? Requests could keep costing money past your limit.")) return;
    setStop(next);
  }

  function exportCsv() {
    const rows = [["time_utc", "service", "site", "provider", "cost_usd", "status", "receipt"]].concat(
      s.log.map((l) => [l.at, l.service, l.siteName, l.provider ?? "", l.costUsd.toFixed(3), l.status, l.hash ?? ""]),
    );
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hash-or-lease-spend.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <h1 className="page-title">Usage</h1>

      {/* Group 1: today's spend and the limit that caps it. */}
      <div className="group">
      <section className="card" aria-label="Daily limit">
        {s.limitReached ? (
          <>
            <h2 style={{ color: "var(--bad)" }}>Limit reached</h2>
            <p className="small card-sub">Agent paused. Next calls at 00:00 UTC.</p>
          </>
        ) : null}
        <div className="num" style={{ fontSize: "var(--t-title1)", lineHeight: "var(--lh-title1)", fontWeight: 700 }}>{usd(s.spentUsd)} <span className="muted" style={{ fontSize: "var(--t-body)", fontWeight: 400 }}>of {usd(s.limitUsd)} today</span></div>
        <div className={`meter ${s.limitReached ? "over" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Spent today" style={{ margin: "var(--s3) 0" }}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="muted small">Resets at 00:00 UTC · Paid in test USDC (testnet)</div>
        {s.limitReached && (
          <div className="row actions">
            <button className="btn" onClick={() => { limitInput.current?.focus(); limitInput.current?.scrollIntoView({ block: "center" }); }}>Raise limit</button>
            <button className="btn" onClick={() => { acknowledgeLimit(); setResumeNote(true); bump(); }}>Resume tomorrow</button>
            {resumeNote && <span className="small" role="status">OK — the agent resumes on its own at 00:00 UTC. Banner hidden for today.</span>}
          </div>
        )}
      </section>

      <section className="card" id="settings" aria-label="Limit settings">
        <h2>Daily limit</h2>
        <div className="grid2">
          <div className="field">
            {serverLimit ? (
              <>
                {/* Read-only value: plain text with a lock, not an input that looks editable. */}
                <span className="label">Daily limit</span>
                <div className="static-value num" aria-describedby="limit-hint">
                  {usd(s.limitUsd)}
                  <span className="badge keep"><Lock size={14} aria-hidden /> Set on the server</span>
                </div>
                <span id="limit-hint" className="hint">
                  To change it, edit <code>DAILY_SPEND_LIMIT_USD</code> and restart. The app can&apos;t raise its own limit.
                </span>
              </>
            ) : (
              <>
                <label htmlFor="limit">Daily limit ($)</label>
                <input id="limit" ref={limitInput} className="input" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} aria-invalid={!!errs.limit} aria-describedby={errs.limit ? "limit-err" : undefined} />
                {errs.limit && <span id="limit-err" className="error-text">{errs.limit}</span>}
              </>
            )}
          </div>
          <div className="field">
            <label htmlFor="alert">Alert at (%)</label>
            <input id="alert" className="input" inputMode="numeric" value={alertPct} onChange={(e) => setAlertPct(e.target.value)} aria-invalid={!!errs.alert} aria-describedby={errs.alert ? "alert-err" : undefined} />
            {errs.alert && <span id="alert-err" className="error-text">{errs.alert}</span>}
          </div>
        </div>
        {serverLimit ? (
          <div className="row small mt-4">
            <Check size={16} aria-hidden style={{ color: "var(--mine)" }} />
            <span><b>Stops at the limit</b> <span className="muted">· always on, checked by the server before every payment</span></span>
          </div>
        ) : (
          <label className="row mt-4">
            <input type="checkbox" checked={stop} onChange={(e) => toggleStop(e.target.checked)} />
            <span><b>Stop when limit reached</b> <span className="muted small">(on by default)</span></span>
          </label>
        )}
        <div className="row actions">
          <button className="btn primary" onClick={save}>Save</button>
          {saved && <span className="small" role="status">Saved</span>}
        </div>
      </section>
      </div>

      {/* Group 2: the agent that spends. */}
      <div className="group section">
        <AgentCard status={agent.data ?? null} loading={agent.loading} />
      </div>

      {/* Group 3: where the money goes. */}
      <div className="group section">
      <section className="card" aria-label="Projected cost">
        <h2>Projected cost</h2>
        <p style={{ marginBottom: "var(--space-tight)" }}>At this pace: <b className="num">{usd(s.forecastPerDayUsd)}</b> per day</p>
        <div className="muted small">{s.forecastNote}</div>
      </section>

      <section className="card" aria-label="By data source">
        <h2>By data source</h2>
        <div className="group">
        {s.byService.map((b) => (
          <div key={b.service}>
            <div className="row between small num">
              <code>{b.service}</code>
              <span>{b.requests} {b.requests === 1 ? "request" : "requests"} · {usd(b.costUsd)}</span>
            </div>
            <div className="meter mt-1"><i style={{ width: `${(b.requests / maxReq) * 100}%` }} /></div>
          </div>
        ))}
        </div>
      </section>

      <section className="card" aria-label="Paid requests">
        <div className="row between card-head">
          <h2>Paid requests</h2>
          <button className="btn small" onClick={exportCsv}>Export CSV</button>
        </div>
        {s.log.length === 0 ? (
          <p className="muted">No requests yet. Spending starts when your first site makes its first call.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Data</th><th>Place</th><th>Provider</th><th>Cost</th><th>Status</th><th>Receipt</th></tr>
              </thead>
              <tbody>
                {s.log.map((l, i) => (
                  <LogRow key={i} l={l} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

function LogRow({ l }: { l: SpendLogEntry }) {
  return (
    <tr className={l.status === "blocked" ? "blocked" : undefined}>
      <td className="num">{utcTime(l.at, true)}</td>
      <td><code>{l.service}</code></td>
      <td>{l.siteName}</td>
      <td>{l.provider ?? "—"}</td>
      <td className="num">{usd(l.costUsd, 3)}</td>
      <td>{l.status === "paid" ? "Paid" : l.status === "failed" ? "Failed · refunded?" : "Blocked by limit"}</td>
      <td>{l.hash ? <><code>{l.hash}</code> {l.proofUrl ? <a href={l.proofUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>proof ↗</a> : <span className="muted" title="Not available in demo">proof ↗</span>}</> : "—"}</td>
    </tr>
  );
}

function AgentCard({ status, loading }: { status: AgentStatus | null; loading: boolean }) {
  const now = new Date().toISOString();
  const run = status?.lastRun ?? null;
  return (
    <section className="card" aria-label="Hourly agent">
      <h2>Hourly agent</h2>
      {loading ? (
        <Skel w={260} />
      ) : !run ? (
        <p className="small">
          The agent hasn&apos;t run yet{status?.mode === "mock" ? " in demo mode" : ""}. Start it on the server with <code>npm run agent</code>: it
          recalculates every place {status?.schedule ?? "every hour"} without this page open and buys the data it needs within the daily limit.
        </p>
      ) : (
        <div className="lines">
          <p className="small num">
            Last run <b>{utcTime(run.at)} UTC</b> ({ago(run.at, now)}) · {run.decided} of {run.sites} places decided
            {run.paused > 0 ? ` · ${run.paused} on hold` : ""} · {run.paidRequests} paid {run.paidRequests === 1 ? "request" : "requests"}
          </p>
          {run.error && <p className="small" style={{ color: "var(--warn)" }}>{run.error}</p>}
          {run.changes.length > 0 && (
            <p className="small">
              Changed: {run.changes.map((c) => `${c.siteName} ${DECISION_LABEL[c.from]} → ${DECISION_LABEL[c.to]}`).join(", ")}
            </p>
          )}
          <div className="muted small">
            Today: {status!.runsToday} {status!.runsToday === 1 ? "run" : "runs"}, {status!.paidRequestsToday} paid {status!.paidRequestsToday === 1 ? "request" : "requests"} · runs {status!.schedule}
            {status!.mode === "mock" ? " · demo agent, no real requests" : ""}
          </div>
        </div>
      )}
    </section>
  );
}
