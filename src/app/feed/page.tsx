"use client";

import { useState } from "react";
import { AppLink, useAsync, useData } from "@/components/DataProvider";
import { Banner, DecisionBadge, Skel } from "@/components/ui";
import { useMemo } from "react";
import { DECISION_LABEL, type Decision } from "@/lib/decision";
import { useMarks } from "@/components/useMarks";
import { markKey } from "@/lib/marks";
import { groupByDay, resolveFeed, summarizeFeed } from "@/lib/feed";
import { usd, utcDate, utcTime } from "@/lib/format";
import type { FeedEntry, FeedPeriod, FeedRow, Mark } from "@/lib/types";

const PERIODS: FeedPeriod[] = ["24h", "7d", "30d"];
const PAGE = 48;

export default function FeedPage() {
  const [period, setPeriod] = useState<FeedPeriod>("24h");
  const [siteId, setSiteId] = useState<string>("all");
  const [shown, setShown] = useState(PAGE);
  const sites = useAsync(async (ds) => (await ds.getOverview()).reports.map((r) => r.site));
  const feed = useAsync((ds) => ds.getFeed(period, siteId), [period, siteId]);
  const status = useAsync((ds) => ds.getStatus());

  return (
    <>
      <div className="page-title">
        <h1>History</h1>
        <div className="row">
          <label className="sr-only" htmlFor="site-filter">Site</label>
          <select
            id="site-filter"
            className="input"
            style={{ width: "auto" }}
            value={siteId}
            onChange={(e) => { setSiteId(e.target.value); setShown(PAGE); }}
          >
            <option value="all">All places</option>
            {(sites.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
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
        <div className="stack" aria-busy="true" aria-label="Loading history">
          <div className="stats">{[0, 1, 2].map((i) => <div className="card" key={i}><Skel w={120} /><div style={{ marginTop: 8 }}><Skel w={90} h={26} /></div></div>)}</div>
          <div className="card">{[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ margin: "16px 0" }}><Skel w="90%" h={16} /></div>)}</div>
        </div>
      ) : feed.data.length === 0 ? (
        <div className="card empty">
          <h2>No history yet</h2>
          <p className="muted">The first call appears after the next full hour.</p>
          <AppLink href="/sites/new" className="btn">Add place</AppLink>
        </div>
      ) : (
        <FeedBody entries={feed.data} now={status.data?.now} shown={shown} onMore={() => setShown((n) => n + PAGE)} showSite={siteId === "all"} />
      )}
    </>
  );
}

type ChangeMarks = (changes: Record<string, Mark | null>) => void;

function FeedBody({ entries, now, shown, onMore, showSite }: { entries: FeedEntry[]; now?: string; shown: number; onMore: () => void; showSite: boolean }) {
  const { marks, change } = useMarks();
  const { live } = useData();
  const rows = useMemo(() => resolveFeed(entries, marks), [entries, marks]);
  const s = summarizeFeed(rows);
  const visible = rows.slice(0, shown);
  const days = groupByDay(visible);
  const today = (now ?? entries[0].hour).slice(0, 10);
  const yesterday = new Date(new Date(today).getTime() - 86400_000).toISOString().slice(0, 10);
  const none = s.markedHours === 0;

  return (
    <>
      <div className="stats" style={{ marginBottom: 6 }}>
        <div className="card stat">
          <div className="muted small">Marked hours</div>
          <div className="v num">{s.markedHours} of {s.totalHours}</div>
          <div className="tiny muted">{s.followedHours} followed{s.skippedHours > 0 ? ` · ${s.skippedHours} skipped` : ""}</div>
        </div>
        <div className="card stat">
          <div className="muted small">Missed gain</div>
          <div className="v num">{none ? <span className="muted">Not marked</span> : usd(s.missedUsd, 0)}</div>
          <div className="tiny muted">marked hours only</div>
        </div>
        <div className="card stat">
          <div className="muted small">Gained by following</div>
          <div className="v num">{none ? <span className="muted">Not marked</span> : usd(s.gainedUsd, 0)}</div>
          <div className="tiny muted">marked hours only</div>
        </div>
      </div>
      {live && (
        <p className="hint">
          Hours tagged “Agent call” were decided live by the hourly agent with the receipts it bought. Other hours are recomputed from past
          day-ahead power prices with today&apos;s mining income.
        </p>
      )}
      <p className="hint">Mark what you actually did and we&apos;ll show what you missed. Hours you don&apos;t mark are never counted, and “Keep as is” hours are never counted as missed.</p>

      <div className="card" style={{ paddingTop: 4 }}>
        {days.map((d) => {
          const label = d.day === today ? "Today" : d.day === yesterday ? "Yesterday" : utcDate(d.day + "T00:00:00Z");
          const unmarked = d.entries.filter((e) => e.status === "not-marked");
          return (
            <section key={d.day} aria-label={label}>
              <div className="day-head">
                <span>{label}</span>
                <span className="row">
                  {unmarked.length > 0 && (
                    <button
                      className="link-btn"
                      onClick={() => change(Object.fromEntries(unmarked.map((e) => [markKey(e.siteId, e.hour), { kind: "followed" } as Mark])))}
                    >
                      Mark {unmarked.length} as followed
                    </button>
                  )}
                  <span className="muted num">{d.marked ? `missed ${usd(d.missedUsd, 0)}` : "Not marked"}</span>
                </span>
              </div>
              {d.entries.map((e) => (
                <Row key={e.hour + e.siteId} e={e} showSite={showSite} change={change} />
              ))}
            </section>
          );
        })}
        {shown < entries.length && (
          <div style={{ textAlign: "center", padding: 12 }}>
            <button className="btn" onClick={onMore}>Show more ({entries.length - shown} left)</button>
          </div>
        )}
      </div>
    </>
  );
}

function StatusText({ e }: { e: FeedRow }) {
  if (e.status === "not-marked") return <span className="muted">Not marked</span>;
  if (e.status === "skipped") return <span className="muted">Skipped</span>;
  if (e.status === "followed") return <span style={{ color: "var(--mine)" }}>Followed</span>;
  if (e.keepAsIs) return <span className="muted">Keep as is</span>;
  if (e.missedUsd < 0.5) return <span className="muted">Nothing missed</span>;
  return <>{e.advice === "off" ? `Lost ${usd(e.missedUsd, 0)}` : `Missed +${usd(e.missedUsd, 0)}`}</>;
}

function Row({ e, showSite, change }: { e: FeedRow; showSite: boolean; change: ChangeMarks }) {
  const [picking, setPicking] = useState(false);
  if (e.status === "paused" || !e.advice) {
    return (
      <div className="feed-row paused">
        <span className="num">{utcTime(e.hour)}</span>
        <span>{showSite ? `${e.siteName} · ` : ""}{e.pauseReason ?? "Paused · daily limit"}</span>
        <span />
      </div>
    );
  }
  const key = markKey(e.siteId, e.hour);
  const kind = e.mark?.kind;
  const set = (m: Mark | null) => {
    setPicking(false);
    change({ [key]: m });
  };
  const choices = (["mine", "lease", "off"] as Decision[]).filter((d) => d !== e.advice);
  const showChoices = picking || kind === "other";
  const who = `${utcTime(e.hour)}${showSite ? ` ${e.siteName}` : ""}`;

  return (
    <div className="feed-row">
      <span className="num">{utcTime(e.hour)}</span>
      <span className="mid">
        {showSite && <b>{e.siteName}</b>}
        <DecisionBadge d={e.advice} />
        {e.keepAsIs && <span className="badge calm">Keep as is</span>}
        {e.recorded && <span className="badge keep" title="Decided live by the hourly agent with the receipts it bought">Agent call</span>}
        <span className="muted tiny">{e.receiptCount} {e.receiptCount === 1 ? "receipt" : "receipts"} · </span>
        <AppLink href={`/sites/${e.siteId}`} className="small" style={{ textDecoration: "underline" }}>Open breakdown</AppLink>
      </span>
      <span className="num" style={{ fontWeight: 600, textAlign: "right" }}><StatusText e={e} /></span>

      <div className="mark-row" role="group" aria-label={`Mark what you did, ${who}`}>
        <span className="mark-label">You:</span>
        <button className="mark-btn" aria-pressed={kind === "followed"} onClick={() => set(kind === "followed" ? null : { kind: "followed" })}>Followed</button>
        <button className="mark-btn" aria-pressed={showChoices} onClick={() => (kind === "other" ? set(null) : setPicking((p) => !p))}>Did something else</button>
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
  );
}
