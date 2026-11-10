"use client";

import { use } from "react";
import { AppLink, useAsync } from "@/components/DataProvider";
import { SiteForm } from "@/components/SiteForm";
import { Banner, Skel } from "@/components/ui";

export default function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const report = useAsync((ds) => ds.getSite(id), [id]);

  if (report.error) {
    return (
      <Banner kind="bad" actions={<button className="btn small" onClick={report.reload}>Retry</button>}>
        Can&apos;t load this place: {report.error.message}
      </Banner>
    );
  }
  if (report.loading) {
    return (
      <div className="stack" aria-busy="true" aria-label="Loading">
        <Skel w={220} h={30} />
        <div className="card"><Skel w="100%" h={120} /></div>
      </div>
    );
  }
  if (!report.data) {
    return (
      <div className="card empty">
        <h2>Place not found</h2>
        <p className="muted">It may have been deleted.</p>
        <AppLink href="/" className="btn primary">Back to Places</AppLink>
      </div>
    );
  }
  return <SiteForm initial={report.data} />;
}
