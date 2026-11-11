"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLink, useAsync, useData } from "@/components/DataProvider";
import { SiteCard, SiteCardSkeleton } from "@/components/SiteCard";
import { Banner, ReceiptChip, Skel } from "@/components/ui";
import { signedUsd, usd, utcTime } from "@/lib/format";

export default function SitesPage() {
  const { data, error, loading, reload } = useAsync((ds) => ds.getOverview());
  const { ds, state, bump } = useData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function tryDemo() {
    setBusy(true);
    await ds.loadDemoSites?.();
    setBusy(false);
    // Leave the ?state=empty preview and return to the normal view, otherwise the list would stay empty.
    if (state === "empty") router.push("/");
    else bump();
  }

  if (error) {
    return (
      <Banner kind="bad" actions={<button className="btn small" onClick={reload}>Retry</button>}>
        Can&apos;t load places: {error.message}
      </Banner>
    );
  }

  if (loading || !data) {
    return (
      <>
        <div className="market" aria-hidden><Skel w={160} /><Skel w={200} /><Skel w={120} /></div>
        <div className="hero"><span className="muted small">Calculating…</span><div style={{ marginTop: 4 }}><Skel w={90} h={16} /></div><div style={{ marginTop: 8 }}><Skel w={260} h={38} /></div></div>
        <div className="stack" aria-busy="true" aria-label="Calculating…">
          <SiteCardSkeleton /><SiteCardSkeleton /><SiteCardSkeleton />
        </div>
      </>
    );
  }

  const { snapshot, reports, totalGainPerHour } = data;

  if (reports.length === 0) {
    return (
      <div className="card empty">
        <h2>No places yet</h2>
        <p className="muted">Add a place to get an hourly Mine / Lease to AI / Switch off call with receipts.</p>
        <div className="row">
          <AppLink href="/sites/new" className="btn primary">Add a site</AppLink>
          {ds.loadDemoSites && (
            <button className="btn" onClick={tryDemo} disabled={busy}>Try demo data</button>
          )}
        </div>
      </div>
    );
  }

  const paused = reports.filter((r) => r.status === "paused" && r.pausedReason?.startsWith("Grid price"));
  const firstGrid = reports.find((r) => r.site.kind === "grid");

  return (
    <>
      {paused.map((r) => (
        <Banner key={r.site.id} kind="warn" actions={<button className="btn small" onClick={reload}>Retry</button>}>
          {r.pausedReason}
        </Banner>
      ))}

      <div className="market num">
        <span>
          Mining income <b>{snapshot.hashprice.value === null ? "—" : `${usd(snapshot.hashprice.value)} /PH/day`}</b>{" "}
          <ReceiptChip receipt={snapshot.hashprice.receipt} now={snapshot.asOf} />
        </span>
        {firstGrid && (
          <span>
            {firstGrid.site.nodeLabel}{" "}
            <b>{firstGrid.inputs.power.value === null ? "—" : `${usd(firstGrid.inputs.power.value)} /MWh`}</b>{" "}
            <ReceiptChip receipt={firstGrid.inputs.power.receipt} now={snapshot.asOf} />
          </span>
        )}
        <span className="muted small">Updated {utcTime(snapshot.hashprice.receipt.fetchedAt ?? snapshot.asOf)} UTC</span>
      </div>

      <section className="hero" aria-label="Right now">
        <div className="muted">Right now, all places</div>
        <div className="big num">{signedUsd(totalGainPerHour, 0)} /h</div>
        <div className="muted small">more per hour than mining everything · {reports.length} places</div>
      </section>

      <div className="stack">
        {reports.map((r) => (
          <SiteCard key={r.site.id} report={r} />
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <AppLink href="/sites/new" className="btn primary">+ Add place</AppLink>
      </div>
    </>
  );
}
