"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowUp, ChevronDown, ChevronRight, CircleHelp, Pause, ReceiptText } from "lucide-react";
import { AppLink, useAsync, useData } from "@/components/DataProvider";
import { Banner, DecisionBadge, Skel } from "@/components/ui";
import { DECISION_LABEL, type Decision } from "@/lib/decision";
import { useMarks } from "@/components/useMarks";
import { useVariant } from "@/components/useVariant";
import { markKey } from "@/lib/marks";
import { changeReasonText, groupByDay, groupPauses, onlyChanges, pauseWhy, resolveFeed, shortChangeReason, summarizeFeed, type PauseRun } from "@/lib/feed";
import { usd, utcDate, utcTime } from "@/lib/format";
import type { FeedEntry, FeedPeriod, FeedRow, Mark } from "@/lib/types";

const PERIODS: FeedPeriod[] = ["24h", "7d", "30d"];
const PAGE = 48;
const PAUSE_VARIANTS = ["a", "b"] as const;

export default function FeedPage() {
  const [period, setPeriod] = useState<FeedPeriod>("24h");
  const [siteId, setSiteId] = useState<string>("all");
  const [shown, setShown] = useState(PAGE);
  const [changesOnly, setChangesOnly] = useState(false);
  const sites = useAsync(async (ds) => (await ds.getOverview()).reports.map((r) => r.site));
  const feed = useAsync((ds) => ds.getFeed(period, siteId), [period, siteId]);
  const status = useAsync((ds) => ds.getStatus());

  return (
    <>
      <div className="page-title history-title">
        <h1>History</h1>
        <div className="filters">
          <label className="sr-only" htmlFor="site-filter">Place</label>
          <div className="place-filter">
            <select
              id="site-filter"
              className="input select-compact"
              value={siteId}
              onChange={(e) => { setSiteId(e.target.value); setShown(PAGE); }}
            >
              <option value="all">All places</option>
              {(sites.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown size={16} strokeWidth={2} aria-hidden />
          </div>
          <div className="seg" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p} aria-pressed={p === period} onClick={() => { setPeriod(p); setShown(PAGE); }}>
                {p === "24h" ? "24 h" : p === "7d" ? "7 d" : "30 d"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {feed.error ? (
        <Banner kind="bad" actions={<button className="btn small" onClick={feed.reload}>Retry</button>}>
          Can&apos;t update the feed: {feed.error.message}
        </Banner>
      ) : feed.loading || !feed.data ? (
        <div className="group" aria-busy="true" aria-label="Loading history">
          <div className="card summary"><div><Skel w={110} /><div className="mt-2"><Skel w={120} h={28} /></div></div></div>
          <div className="card">{[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ margin: "var(--s4) 0" }}><Skel w="90%" h={16} /></div>)}</div>
        </div>
      ) : feed.data.length === 0 ? (
        <div className="card empty">
          <h2>No history yet</h2>
          <p className="muted">The first call appears after the next full hour.</p>
          <AppLink href="/sites/new" className="btn">Add place</AppLink>
        </div>
      ) : (
        <FeedBody
          entries={feed.data}
          now={status.data?.now}
          changesOnly={changesOnly}
          onChangesOnly={(v) => { setChangesOnly(v); setShown(PAGE); }}
          shown={shown}
          onMore={() => setShown((n) => n + PAGE)}
          showSite={siteId === "all"}
        />
      )}
    </>
  );
}

type ChangeMarks = (changes: Record<string, Mark | null>) => void;

function FeedBody({ entries, now, changesOnly, onChangesOnly, shown, onMore, showSite }: {
  entries: FeedEntry[];
  now?: string;
  changesOnly: boolean;
  onChangesOnly: (v: boolean) => void;
  shown: number;
  onMore: () => void;
  showSite: boolean;
}) {
  const { marks, change } = useMarks();
  const { live } = useData();
  const [help, setHelp] = useState(false);
  const rows = useMemo(() => resolveFeed(entries, marks), [entries, marks]);
  const s = summarizeFeed(rows);
  // "Changes only" narrows the list below; the summary above always covers every hour of the period.
  const changes = onlyChanges(rows);
  const listed = changesOnly ? changes : rows;
  const visible = listed.slice(0, shown);
  const days = groupByDay(visible);
  const today = (now ?? entries[0].hour).slice(0, 10);
  const yesterday = new Date(new Date(today).getTime() - 86400_000).toISOString().slice(0, 10);
  const none = s.markedHours === 0;
  // Pauses: A (default) folds a run of paused hours into one block; B (`?pause=b`) keeps a row per hour with a "Paused" chip.
  const pauseVariant = useVariant("pause", "a", PAUSE_VARIANTS);
  let newerAbove = false;

  return (
    <div className="group">
      {/* Summary: one main number, the rest is a quiet line; the long explanation sits behind "?". */}
      <section className="card summary" aria-label="Summary">
        <div className="summary-main">
          <div className="summary-label">{none ? "Marked hours" : "Gained by following"}</div>
          <div className="summary-v num">
            {none ? <>0 <span className="summary-of">of {s.totalHours}</span></> : usd(s.gainedUsd, 0)}
          </div>
        </div>
        <p className="summary-side">
          {none ? (
            "Mark what you did to see what you missed."
          ) : (
            <>
              <b className="num">{usd(s.missedUsd, 0)}</b> missed · <span className="num">{s.markedHours} of {s.totalHours}</span> hours marked
              {s.skippedHours > 0 ? <> · <span className="num">{s.skippedHours}</span> skipped</> : null}
            </>
          )}
        </p>
        <button className="help-btn" aria-expanded={help} aria-controls="summary-help" aria-label="How this is counted" onClick={() => setHelp((h) => !h)}>
          <CircleHelp size={18} aria-hidden />
        </button>
        {help && (
          <div id="summary-help" className="summary-help">
            <p>Hours you don&apos;t mark are never counted, and “Keep as is” hours are never counted as missed.</p>
            {live && (
              <p>
                Hours tagged “Agent call” were decided live by the hourly agent with the receipts it bought. Other hours are recomputed from past
                day-ahead power prices with today&apos;s mining income.
              </p>
            )}
          </div>
        )}
      </section>

      <div className={`card hours${showSite ? " all-places" : ""}`}>
        <div className="list-head">
          <span className="muted num">{changesOnly ? `${changes.length} ${changes.length === 1 ? "change" : "changes"}` : `${rows.length} hours`}</span>
          <button className="switch" role="switch" aria-checked={changesOnly} onClick={() => onChangesOnly(!changesOnly)}>
            Changes only
            <span className="switch-track" aria-hidden />
          </button>
        </div>
        {listed.length === 0 && (
          <p className="hint" style={{ padding: "var(--space-block) 0" }}>No changes of the call in this period. Try 7 d or 30 d.</p>
        )}
        {days.map((d) => {
          const label = d.day === today ? "Today" : d.day === yesterday ? "Yesterday" : utcDate(d.day + "T00:00:00Z");
          const unmarked = d.entries.filter((e) => e.status === "not-marked");
          return (
            <section key={d.day} aria-label={label}>
              <div className="day-head">
                <span>{label}</span>
                <span className="row">
                  {d.marked && <span className="muted num">missed {usd(d.missedUsd, 0)}</span>}
                  {unmarked.length > 0 && (
                    <button
                      className="link-btn quiet"
                      onClick={() => change(Object.fromEntries(unmarked.map((e) => [markKey(e.siteId, e.hour), { kind: "followed" } as Mark])))}
                    >
                      Mark {unmarked.length} as followed
                    </button>
                  )}
                </span>
              </div>
              {(() => {
                const items = groupPauses(d.entries, newerAbove);
                const last = items[items.length - 1];
                newerAbove = last?.kind === "row";
                return items.map((it) =>
                  it.kind === "row" ? (
                    <Row key={it.row.hour + it.row.siteId} e={it.row} showSite={showSite} change={change} />
                  ) : (
                    <PauseItems key={"p" + it.to + it.rows.length} run={it} variant={pauseVariant} showSite={showSite} />
                  ),
                );
              })()}
            </section>
          );
        })}
        {shown < listed.length && (
          <div style={{ textAlign: "center", padding: "var(--s3)" }}>
            <button className="btn" onClick={onMore}>Show more ({listed.length - shown} left)</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Result of a marked hour; an unmarked hour says nothing (its row opens to mark it). */
function statusText(e: FeedRow): ReactNode {
  if (e.status === "not-marked") return null;
  if (e.status === "skipped") return <span className="muted">Skipped</span>;
  if (e.status === "followed") return <span style={{ color: "var(--accent)" }}>Followed</span>;
  if (e.keepAsIs) return <span className="muted">Keep as is</span>;
  if (e.missedUsd < 0.5) return <span className="muted">Nothing missed</span>;
  return <>{e.advice === "off" ? `Lost ${usd(e.missedUsd, 0)}` : `Missed +${usd(e.missedUsd, 0)}`}</>;
}

function Row({ e, showSite, change }: { e: FeedRow; showSite: boolean; change: ChangeMarks }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  if (e.status === "paused" || !e.advice) return <PausedRow e={e} showSite={showSite} />;
  const key = markKey(e.siteId, e.hour);
  const kind = e.mark?.kind;
  const set = (m: Mark | null) => {
    setPicking(false);
    change({ [key]: m });
  };
  const choices = (["mine", "lease", "off"] as Decision[]).filter((d) => d !== e.advice);
  const showChoices = picking || kind === "other";
  const who = `${utcTime(e.hour)}${showSite ? ` ${e.siteName}` : ""}`;
  const panelId = `hour-${key}`;
  const short = e.changedFrom ? shortChangeReason(e.changeReason) : null;
  const sub = e.changedFrom ? `Was ${DECISION_LABEL[e.changedFrom]}${short ? ` · ${short}` : ""}` : null;
  const status = statusText(e);
  // The opened row adds what the short line leaves out ("Lease to AI now beats Mine by …"), not the same words again.
  const rest = changeReasonText(e.changeReason?.split(";").slice(1).join(";"));

  return (
    <div className={`hour${open ? " open" : ""}`}>
      <button className="hour-head" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span className="hour-line">
          <span className="hour-time num">{utcTime(e.hour)}</span>
          {showSite && <span className="hour-site">{e.siteName}</span>}
          <DecisionBadge d={e.advice} />
          {e.recorded && <span className="badge keep hour-agent" title="Decided live by the hourly agent with the receipts it bought">Agent call</span>}
        </span>
        <ChevronDown className="hour-chev" size={18} aria-hidden />
        {(sub || status) && (
          <span className="hour-sub">
            <span className={`hour-why${e.changedFrom ? " changed" : ""}`}>{sub}</span>
            {status && <span className="hour-status num">{status}</span>}
          </span>
        )}
      </button>
      {open && (
        <div className="hour-more" id={panelId}>
          {e.changedFrom && (
            <p className="hour-full">
              Changed from {DECISION_LABEL[e.changedFrom]} to {DECISION_LABEL[e.advice]}.{rest ? ` ${rest}.` : ""}
            </p>
          )}
          {e.keepAsIs && <p className="hour-full">Keep as is: the gap to the next option is below the switch threshold.</p>}
          {e.recorded && <p className="hour-full hour-agent-note">Agent call: decided live by the hourly agent with the receipts it bought.</p>}
          <div className="hour-actions">
            <div className="hour-marks">
              <div className="mark-row" role="group" aria-label={`Mark what you did, ${who}`}>
                <span className="mark-label">You:</span>
                <button className="mark-btn" aria-pressed={kind === "followed"} onClick={() => set(kind === "followed" ? null : { kind: "followed" })}>Followed</button>
                <button className="mark-btn" aria-pressed={showChoices} onClick={() => (kind === "other" ? set(null) : setPicking((p) => !p))}>Other</button>
                <button className="mark-btn" aria-pressed={kind === "skip"} onClick={() => set(kind === "skip" ? null : { kind: "skip" })}>Skip</button>
              </div>
              {showChoices && (
                <div className="mark-row" role="group" aria-label={`What did you do, ${who}`}>
                  <span className="mark-label">I ran:</span>
                  {choices.map((d) => (
                    <button
                      key={d}
                      className="mark-btn"
                      aria-pressed={e.mark?.kind === "other" && e.mark.actual === d}
                      disabled={d === "lease" && e.options?.lease === null}
                      onClick={() => set({ kind: "other", actual: d })}
                    >
                      {DECISION_LABEL[d]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <AppLink href={`/sites/${e.siteId}`} className="hour-link">
              <ReceiptText size={16} aria-hidden />
              {e.receiptCount} {e.receiptCount === 1 ? "receipt" : "receipts"} · Breakdown
              <ChevronRight size={16} aria-hidden />
            </AppLink>
          </div>
        </div>
      )}
    </div>
  );
}

/** Above a pause, where decisions came back: the newer rows sit above it (newest first). */
function ResumeLine({ at }: { at: string }) {
  return (
    <div className="resume-line">
      <ArrowUp size={14} strokeWidth={2.5} aria-hidden />
      Back to decisions from {utcTime(at)}
    </div>
  );
}

function PauseItems({ run, variant, showSite }: { run: PauseRun; variant: "a" | "b"; showSite: boolean }) {
  return (
    <>
      {run.resumedAt && <ResumeLine at={run.resumedAt} />}
      {variant === "a" ? <PauseBlock run={run} showSite={showSite} /> : run.rows.map((e) => <PausedRow key={e.hour + e.siteId} e={e} showSite={showSite} />)}
    </>
  );
}

/** Variant A: a run of paused hours is one block: when, why, which places; the hours open on tap. */
function PauseBlock({ run, showSite }: { run: PauseRun; showSite: boolean }) {
  const [open, setOpen] = useState(false);
  const id = `pause-${run.from}`;
  const range = run.hours === 1 ? utcTime(run.from) : `${utcTime(run.from)}–${utcTime(run.to)}`;
  const byHour = [...new Set(run.rows.map((r) => r.hour))].map((h) => ({ h, sites: run.rows.filter((r) => r.hour === h).map((r) => r.siteName) }));
  return (
    <div className={`pause-block${open ? " open" : ""}`} data-paused>
      <button className="pause-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="pause-line">
          <span className="badge paused"><Pause size={12} aria-hidden />Paused</span>
          <span className="pause-range num">{range} UTC</span>
          <span className="pause-count num">· {run.hours} h</span>
        </span>
        <ChevronDown className="hour-chev" size={18} aria-hidden />
        <span className="pause-why">{run.why}</span>
        <span className="pause-what">
          No calls{showSite || run.sites.length > 1 ? ` for ${run.sites.join(", ")}` : ""}: the agent never decides without a fresh receipt.
        </span>
      </button>
      {open && (
        <ul className="pause-hours" id={id}>
          {byHour.map(({ h, sites }) => (
            <li key={h}>
              <span className="hour-time num">{utcTime(h)}</span>
              <span>{sites.join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Variant B (and a lone paused hour): the row keeps its place, a "Paused" chip and the reason on the second line. */
function PausedRow({ e, showSite }: { e: FeedRow; showSite: boolean }) {
  return (
    <div className="hour paused" data-paused>
      <span className="hour-line">
        <span className="hour-time num">{utcTime(e.hour)}</span>
        {showSite && <span className="hour-site">{e.siteName}</span>}
        <span className="badge paused"><Pause size={12} aria-hidden />Paused</span>
      </span>
      <span className="hour-sub">
        <span className="hour-why">{pauseWhy(e.pauseReason)}</span>
      </span>
    </div>
  );
}
