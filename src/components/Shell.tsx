"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Gauge, History, MapPin } from "lucide-react";
import { AppLink, LIVE, useAsync, useData } from "./DataProvider";
import { Banner, Skel } from "./ui";
import { MOCK_STATES } from "@/lib/data/mock";
import { usd, utcTime } from "@/lib/format";
import { acknowledgeLimit, limitAcknowledged } from "./limitAck";

const NAV = [
  { href: "/", label: "Places", Icon: MapPin },
  { href: "/feed", label: "History", Icon: History },
  { href: "/spend", label: "Usage", Icon: Gauge },
];

export function Shell({ children }: { children: ReactNode }) {
  const { state, bump } = useData();
  const pathname = usePathname();
  const status = useAsync((ds) => ds.getStatus());
  const [dismissed, setDismissed] = useState(false);
  const s = status.data;
  // Баннер лимита, скрытый сегодня («Dismiss» / «Resume tomorrow»), не возвращается при переходах; в просмотре ?state=limit — всегда виден.
  useEffect(() => setDismissed(state === "default" && limitAcknowledged()), [state, status.data]);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <AppLink href="/" className="logo">Hash or Lease</AppLink>
          <span className="badge testnet" title="Testnet · no real money">Testnet · no real money</span>
          {(s ? s.demo : !LIVE) && <span className="badge demo">Demo data</span>}
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" || pathname.startsWith("/sites") : pathname.startsWith(n.href);
              return (
                <AppLink key={n.href} href={n.href} aria-current={active ? "page" : undefined}>
                  <n.Icon size={22} strokeWidth={2} aria-hidden />
                  <span>{n.label}</span>
                </AppLink>
              );
            })}
          </nav>
          <AppLink href="/spend" className={`spent num ${s?.limitReached ? "over" : ""}`}>
            {s ? `Spent today ${usd(s.spentUsd)} / ${usd(s.limitUsd)}` : <Skel w={150} />}
          </AppLink>
        </div>
      </header>
      <div className="demo-strip" role="note">
        {(s ? !s.demo : LIVE) ? (
          <>
            <b>Live data</b> · BTC price via Telegraph (testnet), network stats and day-ahead power prices from public sources.
          </>
        ) : (
          <>
            <b>Demo data</b> — invented numbers and receipts. No wallet, no network, no real requests.
          </>
        )}
      </div>
      <main className="main">
        {s?.networkDown && (
          <Banner
            kind="bad"
            actions={<button className="btn small" onClick={bump}>Retry</button>}
          >
            Can&apos;t reach Telegraph. Showing the last decision from {utcTime(s.lastGoodAt ?? s.now)}.
          </Banner>
        )}
        {s?.limitReached && !dismissed && (
          <Banner
            kind="warn"
            actions={
              <>
                <AppLink href="/spend#settings" className="btn small">Raise limit</AppLink>
                <button className="btn small" onClick={() => { if (state === "default") acknowledgeLimit(); setDismissed(true); }}>Dismiss</button>
              </>
            }
          >
            Daily spend limit reached ({usd(s.limitUsd)}). Decisions are frozen until 00:00 UTC.
          </Banner>
        )}
        {children}
      </main>
      <footer className="footer">
        <div>
          Preview states (mock):{" "}
          {MOCK_STATES.map((st) => (
            <a key={st} href={`${pathname}${st === "default" ? "" : `?state=${st}`}`} aria-current={st === state}>
              {st}
            </a>
          ))}
        </div>
      </footer>
    </>
  );
}
