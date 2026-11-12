"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AppLink } from "./DataProvider";
import { DecisionBadge, DecisionIcon } from "./ui";
import { DECISION_LABEL, type Decision } from "@/lib/decision";
import type { DemoDayResult } from "@/lib/demo/day";
import type { DecisionRecord } from "@/lib/agent/types";
import { signedUsd, usd, utcTime } from "@/lib/format";

const SPEEDS = [
  { sec: 5, label: "Day in 2 min" },
  { sec: 1, label: "Day in 24 s" },
];
const COLORS: Record<Decision, string> = { mine: "#1e7a46", lease: "#5b3fd1", off: "#8b95a3" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function DemoDayView({ day, siteLine, breakEven }: { day: DemoDayResult; siteLine: string; breakEven: number }) {
  const last = day.hours.length - 1;
  const params = useSearchParams();
  const fromUrl = Number(params.get("hour"));
  const initial = params.get("hour") !== null && Number.isInteger(fromUrl) && fromUrl >= 0 && fromUrl <= last ? fromUrl : last;
  // Playhead: hour of the simulated day shown as "now". Opens on the finished day; Play restarts from 00:00.
  const [at, setAt] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[0].sec);

  useEffect(() => {
    if (!playing) return;
    if (at >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setAt((h) => Math.min(h + 1, last)), speed * 1000);
    return () => clearTimeout(t);
  }, [playing, at, last, speed]);

  const rec = day.decisions[at];
  const shown = useMemo(() => day.decisions.slice(0, at + 1).reverse(), [day.decisions, at]);
  const alerts = day.alerts.filter((a) => a.h <= at).reverse();
  const lastChange = [...day.decisions.slice(0, at + 1)].reverse().find((r) => r.changed);
  const changesTotal = day.decisions.filter((r) => r.changed).length;

  function play() {
    if (at >= last) setAt(0);
    setPlaying(true);
  }

  return (
    <>
      <div className="page-title">
        <h1>Demo day</h1>
        <span className="badge demo">Demo data · simulated</span>
      </div>
      <p className="hint" style={{ marginBottom: 16 }}>
        One invented site and one invented day of prices, run hour by hour through the same agent that makes the real calls.
        No Telegraph requests, no receipts, no money. Real calls are on <AppLink href="/" style={{ textDecoration: "underline" }}>Places</AppLink>.
      </p>

      <div className="stack">
        <section className="card" aria-label="Simulated hour">
          <div className="site-head">
            <div className="site-title">
              <h2>{day.site.name}</h2>
              <div className="muted small">{siteLine}</div>
            </div>
            <div className="pills">
              {rec.keepAsIs && <span className="badge calm pill">Keep as is</span>}
              {rec.decision && (
                <span className={`badge ${rec.decision} pill`}>
                  <DecisionIcon d={rec.decision} />
                  {DECISION_LABEL[rec.decision]}
                </span>
              )}
            </div>
          </div>

          <div className="demo-clock num" aria-live="polite">
            <span className="demo-time">{utcTime(rec.hour)}</span>
            <span className="muted small">simulated UTC · hour {at + 1} of {day.hours.length}</span>
          </div>

          {rec.changed && rec.previous && rec.decision ? (
            <div className={`change-note ${rec.decision}`} role="status">
              <b>Call changed: {DECISION_LABEL[rec.previous]} → {DECISION_LABEL[rec.decision]}</b>
              <span>{cap(rec.why ?? "")}</span>
            </div>
          ) : (
            <div className="verdict">{cap(rec.why ?? "")}.{lastChange && !rec.changed ? ` Last change at ${utcTime(lastChange.hour)}.` : ""}</div>
          )}

          {rec.options && (
            <div className="options num" aria-label="Profit per MWh by option in this hour">
              {(["mine", "lease", "off"] as Decision[]).map((d) => (
                <div key={d} className={`option ${rec.decision === d ? `win ${d}` : ""}`}>
                  <div className="small">{DECISION_LABEL[d]}</div>
                  <div className="v">{rec.options![d] === null ? "—" : d === "off" ? usd(rec.options![d]!, 0) : signedUsd(rec.options![d]!)}</div>
                  <div className="tiny">per MWh</div>
                </div>
              ))}
            </div>
          )}
          <div className="muted small num" style={{ marginTop: 12 }}>
            Demo inputs this hour: power {usd(rec.powerPrice ?? 0)}/MWh · mining income {usd(rec.hashprice ?? 0)}/PH/day (BTC {usd(day.hours[at].btcUsd, 0)}) · lease pays{" "}
            {rec.options?.lease != null ? usd(rec.options.lease) : "—"}/MWh after overhead
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            {playing ? (
              <button className="btn primary" onClick={() => setPlaying(false)}><Pause size={16} aria-hidden /> Pause</button>
            ) : (
              <button className="btn primary" onClick={play}>
                {at >= last ? <RotateCcw size={16} aria-hidden /> : <Play size={16} aria-hidden />}
                {at >= last ? "Play the day" : "Continue"}
              </button>
            )}
            <div className="seg" role="group" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button key={s.sec} aria-pressed={speed === s.sec} onClick={() => setSpeed(s.sec)}>{s.label}</button>
              ))}
            </div>
          </div>
        </section>

        <section className="card" aria-label="Power price through the demo day">
          <h2>Power price through the day</h2>
          <p className="hint">Invented profile: quiet night, morning peak, midday solar dip, evening peak. Tap an hour to jump to it.</p>
          <DayChart day={day} at={at} breakEven={breakEven} onPick={(h) => { setPlaying(false); setAt(h); }} />
        </section>

        <section className="card" aria-label="Hour by hour">
          <div className="row between">
            <h2>Hour by hour</h2>
            <span className="muted small num">{shown.filter((r) => r.changed).length} of {changesTotal} changes so far</span>
          </div>
          <div className="tape" role="table" aria-label="Hour, call and reason">
            {shown.map((r) => <TapeRow key={r.hour} r={r} />)}
          </div>
        </section>

        <section className="card" aria-label="Bot messages">
          <h2>What the Telegram bot sends</h2>
          <p className="hint">Preview of the exact alert text. Demo: nothing is sent from this screen; in Telegram the same replay is the <code>/demo</code> command.</p>
          <div className="tg">
            {alerts.length === 0 ? (
              <div className="tg-empty">No change yet — the bot stays quiet until the call changes.</div>
            ) : (
              alerts.map((a) => (
                <div key={a.h} className="tg-msg">
                  <div className="tg-text">{a.message.text}</div>
                  <div className="tg-meta">Hash or Lease bot · preview, not sent</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card" aria-label="Demo journal">
          <h2>Journal</h2>
          <p className="hint">
            Every simulated hour is recorded in the hourly agent&apos;s journal format, marked <code>&quot;mode&quot;:&quot;demo&quot;</code> and kept
            apart from the live journal. <code>npm run demo:day</code> writes it to <code>data/agent/demo/</code>.{" "}
            <a href="/api/demo-day" style={{ textDecoration: "underline" }}>Download the day (JSONL)</a>
          </p>
          <pre className="journal" tabIndex={0} aria-label={`Journal record for ${utcTime(rec.hour)}`}>{JSON.stringify(rec, null, 1)}</pre>
        </section>
      </div>
    </>
  );
}

function TapeRow({ r }: { r: DecisionRecord }) {
  return (
    <div className={`tape-row ${r.changed && r.decision ? `changed ${r.decision}` : ""}`} role="row">
      <span className="num" role="cell">{utcTime(r.hour)}</span>
      <span className="mid" role="cell">
        {r.decision && <DecisionBadge d={r.decision} />}
        {r.changed && r.previous && <span className="badge changed">Changed from {DECISION_LABEL[r.previous]}</span>}
        {r.keepAsIs && <span className="badge calm">Keep as is</span>}
        <span className="tape-why">{cap(r.why ?? r.reason ?? "")}</span>
      </span>
      <span className="num muted small" role="cell" style={{ textAlign: "right" }}>{usd(r.powerPrice ?? 0, 0)}/MWh</span>
    </div>
  );
}

function useWidth(fallback: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Power price by hour with the break-even line, and the call for every hour underneath. Hours after the playhead are dimmed. */
function DayChart({ day, at, breakEven, onPick }: { day: DemoDayResult; at: number; breakEven: number; onPick: (h: number) => void }) {
  const [ref, W] = useWidth(600);
  const n = day.hours.length;
  const padL = 40;
  const padR = 8;
  const top = 22;
  const plotH = 150;
  const bandY = top + plotH + 10;
  const H = bandY + 16 + 20;
  const max = Math.ceil(Math.max(...day.hours.map((x) => x.powerUsdPerMwh)) / 50) * 50;
  const step = (W - padL - padR) / n;
  const x = (i: number) => padL + step * i + step / 2;
  const y = (v: number) => top + plotH * (1 - v / max);
  const path = (to: number) => day.hours.slice(0, to + 1).map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.powerUsdPerMwh).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: max / 50 + 1 }, (_, i) => i * 50).filter((v) => v % 100 === 0);
  const now = day.hours[at];
  const narrow = W < 480;
  const changes = day.decisions.map((r, i) => ({ r, i })).filter(({ r, i }) => r.changed && i <= at);

  return (
    <div ref={ref}>
      <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Demo power price by hour, from ${usd(Math.min(...day.hours.map((p) => p.powerUsdPerMwh)), 0)} to ${usd(Math.max(...day.hours.map((p) => p.powerUsdPerMwh)), 0)} per MWh, with the hourly call below. Mining beats the lease when power is under about ${usd(breakEven, 0)}.`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#e1e5ea" strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 4} fontSize="12" fill="#5d6673" textAnchor="end">${v}</text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={y(breakEven)} y2={y(breakEven)} stroke="#1e7a46" strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={padL + 4} y={y(breakEven) + 14} fontSize="12" fill="#14171c">{narrow ? `under ${usd(breakEven, 0)}: mine` : `below ${usd(breakEven, 0)} mining beats the lease`}</text>
        <path d={path(n - 1)} fill="none" stroke="#c4cbd4" strokeWidth="2" strokeLinejoin="round" />
        <path d={path(at)} fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinejoin="round" />
        {changes.map(({ r, i }) => (
          <g key={r.hour}>
            <line x1={x(i)} x2={x(i)} y1={top - 4} y2={bandY + 16} stroke={COLORS[r.decision!]} strokeWidth="1.5" />
            <text x={x(i) + (i > n * 0.6 ? 5 : -5)} y={top - 8} fontSize="12" fontWeight="600" fill="#14171c" textAnchor={i > n * 0.6 ? "start" : "end"}>
              {narrow ? "" : `${utcTime(r.hour)} `}→ {DECISION_LABEL[r.decision!]}
            </text>
          </g>
        ))}
        <circle cx={x(at)} cy={y(now.powerUsdPerMwh)} r="5" fill="#1d4ed8" stroke="#fff" strokeWidth="2" />
        {day.decisions.map((r, i) => (
          <rect key={r.hour} x={padL + step * i + 1} y={bandY} width={Math.max(step - 2, 1)} height={16} rx="3" fill={r.decision ? COLORS[r.decision] : "#d5dae1"} opacity={i <= at ? 1 : 0.22} />
        ))}
        {[0, 6, 12, 18].map((h) => (
          <text key={h} x={padL + step * h + 1} y={H - 4} fontSize="12" fill="#5d6673">{utcTime(day.hours[h].hour)}</text>
        ))}
        {day.decisions.map((r, i) => (
          <rect key={r.hour} x={padL + step * i} y={0} width={step} height={H} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onPick(i)}>
            <title>{`${utcTime(r.hour)} UTC · ${r.decision ? DECISION_LABEL[r.decision] : "on hold"} · power ${usd(r.powerPrice ?? 0, 0)}/MWh (demo)`}</title>
          </rect>
        ))}
      </svg>
      <div className="row small muted">
        <span><span aria-hidden style={{ color: "#1d4ed8" }}>━</span> Power price, $/MWh (demo)</span>
        {(["mine", "lease"] as Decision[]).map((d) => (
          <span key={d}><span aria-hidden style={{ color: COLORS[d] }}>■</span> {DECISION_LABEL[d]}</span>
        ))}
      </div>
    </div>
  );
}
