"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLink, useAsync, useData, useWithState } from "@/components/DataProvider";
import { siteFlag } from "@/lib/flags";
import { Banner, DecisionIcon, ReceiptChip, Skel } from "@/components/ui";
import { updatedAt } from "@/components/SiteCard";
import { gainText } from "@/lib/gain";
import { DECISION_LABEL, type Decision, type DecisionOutcome } from "@/lib/decision";
import { num, signedUsd, usd, utcDate, utcTime } from "@/lib/format";
import type { HourPoint, Receipt, SiteReport } from "@/lib/types";

export default function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ds, bump, live } = useData();
  const withState = useWithState();
  const router = useRouter();
  const report = useAsync((ds) => ds.getSiteReport(id), [id]);
  const history = useAsync((ds) => ds.getSiteHistory(id), [id]);
  const status = useAsync((ds) => ds.getStatus());
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (report.error) {
    return (
      <Banner kind="bad" actions={<button className="btn small" onClick={report.reload}>Retry</button>}>
        Can&apos;t load this site: {report.error.message}
      </Banner>
    );
  }
  if (report.loading) return <DetailSkeleton />;
  if (!report.data) return <NotFound />;
  const r = report.data;
  const { site, result } = r;
  const now = r.asOf;
  const limitReached = status.data?.limitReached ?? false;

  async function refresh() {
    setBusy(true);
    setNote(null);
    try {
      await ds.refreshSite(id);
      setNote(live ? "Refreshed: bought a new BTC price via Telegraph (see Usage)." : "Refreshed (demo — no real request was made).");
      bump();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm(`Delete ${site.name}?`)) return;
    await ds.deleteSite(id);
    router.push(withState("/"));
  }

  return (
    <div className="stack">
      <div className="page-title" style={{ marginBottom: 0 }}>
        <div className="row">
          <AppLink href="/" className="btn small">← Places</AppLink>
          <h1>{siteFlag(site) && <span aria-hidden>{siteFlag(site)} </span>}{site.name}</h1>
          {r.status === "stale" && <span className="badge stale">Outdated</span>}
        </div>
        <div className="menu">
          <button className="btn small" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            ⋯ Menu
          </button>
          {menu && (
            <div className="menu-list" role="menu">
              <button role="menuitem" onClick={() => router.push(withState(`/sites/${id}/edit`))}>Edit</button>
              <button role="menuitem" onClick={remove}>Delete</button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Решение */}
      <section className="card" aria-label="Decision">
        {!result || !result.ok ? (
          <>
            <span className="badge paused">On hold</span>
            <h2 style={{ marginTop: 8 }}>On hold — can&apos;t decide without {r.inputs.power.value === null ? "power price" : "all inputs"}</h2>
            <p className="muted">{r.pausedReason}</p>
            <button className="btn" onClick={report.reload}>Retry</button>
          </>
        ) : (
          <>
            <div className={`decision ${result.chosen}`} style={{ marginTop: 0 }}>
              <DecisionIcon d={result.chosen} size={28} />
              {DECISION_LABEL[result.chosen]}
              {result.keepAsIs && <span className="badge calm">Keep as is</span>}
            </div>
            <div className="gain-row num" style={{ marginTop: 0 }}>
              <span className="gain">{gainText(result).big}</span>
              {gainText(result).small && <span className="gain-small">{gainText(result).small}</span>}
            </div>
            <p className="verdict">{verdict(result.chosen, result.gainVsMiningPerHour, result.keepAsIs)}</p>
            <div className="muted small">
              Call for {hourRange(r)} UTC · based on data fetched {utcTime(updatedAt(r))}
            </div>
          </>
        )}
      </section>

      {/* 3. Сравнение вариантов */}
      {result && result.ok && (
        <section className="card" aria-label="Comparison">
          <h2 style={{ marginBottom: 12 }}>Three options, per MWh</h2>
          <div className="options num">
            <Option d="mine" value={result.options.mine} win={result.chosen === "mine"} />
            <Option d="lease" value={result.options.lease} win={result.chosen === "lease"} />
            <Option d="off" value={result.options.off} win={result.chosen === "off"} />
          </div>
          <p className="small num" style={{ marginTop: 12, marginBottom: 0 }}>{thresholdText(result)}</p>
        </section>
      )}

      {/* 4. Откуда цифры */}
      <section className="card" aria-label="Where the numbers come from">
        <h2 style={{ marginBottom: 8 }}>Where the numbers come from</h2>
        <div className="breakdown num">
          <Row
            label="Mining revenue"
            value={result && result.ok ? `${usd(result.miningRevenue)} /MWh` : "—"}
            detail={
              r.inputs.hashprice.value !== null
                ? `= Mining income ${usd(r.inputs.hashprice.value)} /PH/day × ${num(site.phs / site.mw, 1)} PH/s per MW ÷ 24`
                : "Mining income unavailable"
            }
            receipt={r.inputs.hashprice.receipt}
            now={now}
            problem={r.inputs.hashprice.value === null}
          />
          <Row
            label="Power price"
            value={r.inputs.power.value === null ? "Unavailable" : `${usd(r.inputs.power.value)} /MWh`}
            detail={
              r.inputs.power.value === null
                ? "Power price unavailable (provider timeout)"
                : site.kind === "grid"
                  ? `${site.nodeLabel}, ${live ? "day-ahead, this hour" : "real-time LMP"}${r.inputs.powerDayAhead !== undefined ? ` · ${live ? "next hour" : "day-ahead"} ${usd(r.inputs.powerDayAhead)} ${r.inputs.powerDayAhead < r.inputs.power.value ? "↓" : "↑"}` : ""}`
                  : "Fixed rate from your contract"
            }
            receipt={r.inputs.power.receipt}
            now={now}
            problem={r.inputs.power.value === null}
          />
          {r.inputs.leaseRate && site.lease ? (
            <>
              <Row
                label="AI lease rate"
                value={`${usd(r.inputs.leaseRate.value)} /MWh`}
                detail={site.lease.includesPower ? "Rate includes power" : "Power is on you, so it is subtracted"}
                receipt={r.inputs.leaseRate.receipt}
                now={now}
              />
              {r.inputs.leaseGuide && (
                <Row
                  label="Market guide"
                  value={r.inputs.leaseGuide.value}
                  detail="Estimate only, not a quote"
                  receipt={r.inputs.leaseGuide.receipt}
                  now={now}
                />
              )}
              <Row
                label="Overhead"
                value={`${usd(site.lease.overheadUsdPerMwh)} /MWh`}
                receipt={r.inputs.overhead!.receipt}
                now={now}
              />
            </>
          ) : (
            <div className="brow">
              <div className="muted">AI lease rate — not set</div>
              <div className="hint">Add a rate to compare leasing.</div>
            </div>
          )}
          {result && result.ok && (
            <div className="brow">
              <div className="muted">Formula</div>
              <div><b>Mine:</b> {mineFormula(result, r)}</div>
              {result.options.lease !== null && site.lease && <div><b>Lease:</b> {leaseFormula(result, r)}</div>}
            </div>
          )}
        </div>
      </section>

      {/* 5. Proof */}
      <Proof report={r} demo={!live} />

      {/* 6. График */}
      <section className="card" aria-label="Last 24 hours">
        <h2 style={{ marginBottom: 8 }}>Last 24 hours</h2>
        {history.loading ? (
          <Skel w="100%" h={120} />
        ) : history.error ? (
          <p className="muted small">Can&apos;t load hourly prices: {history.error.message}</p>
        ) : !history.data || history.data.length === 0 ? (
          <p className="muted small">No hourly prices for this place yet.</p>
        ) : (
          <HistoryChart points={history.data} />
        )}
      </section>

      {/* 7. Кнопки */}
      <div className="row">
        <button className="btn primary" disabled={busy || limitReached || r.status === "paused"} onClick={refresh}>
          {busy ? "Refreshing…" : `Refresh now (${usd(ds.refreshCostUsd)})`}
        </button>
        <AppLink href={`/sites/${id}/edit`} className="btn">Edit site</AppLink>
        {limitReached && <span className="muted small">Daily limit reached</span>}
        {note && <span className="small" role="status">{note}</span>}
      </div>
    </div>
  );
}

function hourRange(r: SiteReport): string {
  const start = new Date(r.asOf);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 3600_000);
  return `${utcTime(start.toISOString())}–${utcTime(end.toISOString())}`;
}

function thresholdText(r: DecisionOutcome): string {
  const t = usd(r.thresholdUsdPerMwh);
  const v = (d: Decision) => r.options[d] as number;
  if (r.keepAsIs && r.chosen !== r.best) {
    return `${DECISION_LABEL[r.best]} ${signedUsd(v(r.best))} vs. ${DECISION_LABEL[r.chosen]} ${signedUsd(v(r.chosen))} — within ${t} → Keep as is (currently ${DECISION_LABEL[r.chosen]}).`;
  }
  if (r.keepAsIs) {
    return `Difference ${usd(r.marginToNext)}/MWh is below your ${t} threshold → Keep as is.`;
  }
  return `Next best is ${usd(r.marginToNext)} ahead. Threshold: ${t}.`;
}

function par(n: number): string {
  return n < 0 ? `(${num(n)})` : num(n);
}

function mineFormula(r: DecisionOutcome, rep: SiteReport): string {
  return `${num(r.miningRevenue)} − ${par(rep.inputs.power.value ?? 0)} = ${num(r.options.mine)}`;
}

function leaseFormula(r: DecisionOutcome, rep: SiteReport): string {
  const l = rep.site.lease!;
  const parts = l.includesPower
    ? `${num(l.rateUsdPerMwh)} − ${num(l.overheadUsdPerMwh)}`
    : `${num(l.rateUsdPerMwh)} − ${par(rep.inputs.power.value ?? 0)} − ${num(l.overheadUsdPerMwh)}`;
  return `${parts} = ${num(r.options.lease!)}`;
}

function Option({ d, value, win }: { d: Decision; value: number | null; win: boolean }) {
  const disabled = value === null;
  return (
    <div className={`option ${d} ${win ? "win" : ""} ${disabled ? "disabled" : ""}`}>
      <div className="row" style={{ gap: 8 }}>
        <DecisionIcon d={d} size={18} />
        <b>{DECISION_LABEL[d]}</b>
        {win && <span className="badge keep">chosen</span>}
      </div>
      <div className="v">{disabled ? "—" : d === "off" ? usd(value, 0) : signedUsd(value)}</div>
      <div className="tiny muted">{disabled ? "Add a rate to compare leasing" : "/MWh"}</div>
    </div>
  );
}

function Row({
  label,
  value,
  detail,
  receipt,
  now,
  problem,
}: {
  label: string;
  value: string;
  detail?: string;
  receipt: Receipt;
  now: string;
  problem?: boolean;
}) {
  return (
    <div className={`brow ${problem ? "problem" : ""}`}>
      <div className="muted">{label}</div>
      <div className="v">{value}<ReceiptChip receipt={receipt} now={now} /></div>
      {detail && <div className="small">{detail}</div>}
    </div>
  );
}

function Proof({ report, demo }: { report: SiteReport; demo: boolean }) {
  const [copied, setCopied] = useState(false);
  const receipts: [string, Receipt][] = [
    ["Mining income", report.inputs.hashprice.receipt],
    ["Power price", report.inputs.power.receipt],
    ...(report.inputs.leaseGuide ? ([["Market guide", report.inputs.leaseGuide.receipt]] as [string, Receipt][]) : []),
  ];
  const paid = receipts.filter(([, rc]) => (rc.status === "verified" || rc.status === "stale") && (rc.costUsd ?? 0) > 0);
  const publicSources = receipts.filter(([, rc]) => rc.status === "public");
  const total = paid.reduce((s, [, rc]) => s + (rc.costUsd ?? 0), 0);

  const summary = [
    `Hash or Lease — audit summary (testnet${demo ? ", demo data" : ", Sepolia"})`,
    `Site: ${report.site.name}`,
    report.result && report.result.ok
      ? `Call: ${DECISION_LABEL[report.result.chosen]}${report.result.keepAsIs ? " (no change)" : ""}, ${signedUsd(report.result.chosenUsdPerMwh)}/MWh`
      : `Call: paused`,
    ...paid.map(
      ([label, rc]) =>
        `- ${label}: ${rc.service} · ${rc.provider} · ${rc.fetchedAt ? utcDate(rc.fetchedAt) + " " + utcTime(rc.fetchedAt, true) + " UTC" : "n/a"} · ${usd(rc.costUsd ?? 0, 3)} · ${rc.hash ?? "no hash"} · ${rc.status}`,
    ),
    ...paid.filter(([, rc]) => rc.proofUrl).map(([label, rc]) => `  ${label} payment: ${rc.proofUrl}`),
    ...publicSources.map(([label, rc]) => `- ${label}: ${rc.provider ?? "public source"} (free, not via Telegraph) · ${rc.proofUrl ?? ""}`),
    `Total: ${paid.length} paid requests, ${usd(total, 3)}`,
  ].join("\n");

  return (
    <section className="card" aria-label="Receipts">
      <h2>Receipts</h2>
      <p className="small" style={{ margin: "8px 0 12px" }}>
        This call used {paid.length} paid {paid.length === 1 ? "request" : "requests"} · {paid.length} {paid.length === 1 ? "receipt" : "receipts"} · total {usd(total, 3)}
        {publicSources.length > 0 && ` · plus ${publicSources.length} free public ${publicSources.length === 1 ? "source" : "sources"} (not via Telegraph)`}
      </p>
      <button
        className="btn small"
        onClick={() => {
          try {
            void navigator.clipboard?.writeText(summary);
          } catch {
            /* буфер недоступен */
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy audit summary"}
      </button>
    </section>
  );
}

const COLORS: Record<Decision, string> = { mine: "#1e7a46", lease: "#5b3fd1", off: "#8b95a3" };

function HistoryChart({ points }: { points: HourPoint[] }) {
  const W = 600;
  const H = 130;
  const padX = 8;
  const chartH = 90;
  const prices = points.map((p) => p.powerPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const step = (W - padX * 2) / points.length;
  const x = (i: number) => padX + step * i + step / 2;
  const y = (v: number) => 6 + (chartH - 12) * (1 - (v - min) / span);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.powerPrice).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Power price over the last 24 hours, from ${usd(min)} to ${usd(max)} per MWh, with the hourly decision below`}>
        <path d={line} fill="none" stroke="#1d4ed8" strokeWidth="2" />
        {points.map((p, i) => (
          <rect key={p.hour} x={padX + step * i + 1} y={chartH + 8} width={Math.max(step - 2, 1)} height={14} rx="2" fill={p.decision ? COLORS[p.decision] : "#d5dae1"}>
            <title>{`${utcTime(p.hour)} UTC · ${p.decision ? DECISION_LABEL[p.decision] : "paused"} · ${usd(p.powerPrice)}/MWh`}</title>
          </rect>
        ))}
        <text x={padX} y={H - 2} fontSize="11" fill="#5d6673">{utcTime(points[0].hour)}</text>
        <text x={W - padX} y={H - 2} fontSize="11" fill="#5d6673" textAnchor="end">{utcTime(points[points.length - 1].hour)} UTC</text>
      </svg>
      <div className="row small muted">
        <span>Line: power price ($/MWh)</span>
        {(["mine", "lease", "off"] as Decision[]).map((d) => (
          <span key={d}><span aria-hidden style={{ color: COLORS[d] }}>■</span> {DECISION_LABEL[d]}</span>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Calculating…">
      <div className="row"><Skel w={80} h={28} /><Skel w={160} h={24} /></div>
      <div className="card"><Skel w={200} h={30} /><div style={{ marginTop: 12 }}><Skel w={240} h={16} /></div><div className="muted small" style={{ marginTop: 8 }}>Calculating…</div></div>
      <div className="card"><Skel w="100%" h={70} /></div>
      <div className="card">{[0, 1, 2, 3].map((i) => <div key={i} style={{ margin: "12px 0" }}><Skel w={`${60 - i * 8}%`} h={16} /></div>)}</div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="card empty">
      <h2>Place not found</h2>
      <p className="muted">It may have been deleted.</p>
      <AppLink href="/" className="btn primary">Back to Places</AppLink>
    </div>
  );
}

function verdict(chosen: Decision, gain: number, keep: boolean): string {
  if (keep) return "The difference is tiny, so keep things as they are.";
  if (chosen === "lease") return `Leasing to AI beats mining by ${usd(gain, 0)} every hour.`;
  if (chosen === "off") return gain > 0.005 ? `Power costs more than mining earns. Switching off saves ${usd(gain, 0)} every hour.` : "Nothing beats staying off right now.";
  return "Mining is the best use of this power right now.";
}
