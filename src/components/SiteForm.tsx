"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLink, useAsync, useData, useWithState } from "@/components/DataProvider";
import { Banner, ReceiptChip } from "@/components/ui";
import { GUIDE_COST_USD } from "@/lib/data/types";
import { usd } from "@/lib/format";
import {
  emptyFormValues,
  fleetConsistencyHint,
  formValuesOf,
  phsPerMwOf,
  toSiteInput,
  validateSiteInput,
  type SiteFormErrors,
  type SiteFormValues,
} from "@/lib/siteForm";
import type { NodeOption, Site, Sourced } from "@/lib/types";

/** Короткие подписи быстрых кнопок по id узла; остальные узлы — по названию до скобки. */
const SHORT: Record<string, string> = { HB_HOUSTON: "Houston hub", HB_NORTH: "North hub", HB_WEST: "West hub" };
const shortLabel = (n: NodeOption) => SHORT[n.id] ?? n.label.replace(/\s*\(.*$/, "");

/** Форма площадки: добавление (без initial) или правка существующей. */
export function SiteForm({ initial }: { initial?: Site }) {
  const { ds, bump, live } = useData();
  const withState = useWithState();
  const router = useRouter();
  const editing = !!initial;
  const [v, setV] = useState<SiteFormValues>(initial ? formValuesOf(initial) : emptyFormValues());
  const [errors, setErrors] = useState<SiteFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof SiteFormValues, boolean>>>({});
  const [unit, setUnit] = useState<"kwh" | "mwh">(initial?.kind === "tariff" ? "mwh" : "kwh");
  const [tariffRaw, setTariffRaw] = useState(initial?.tariffUsdPerMwh !== undefined ? String(initial.tariffUsdPerMwh) : "");
  const [query, setQuery] = useState(initial?.kind === "grid" ? initial.nodeLabel || initial.nodeId || "" : "");
  const [options, setOptions] = useState<NodeOption[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [nodeLabel, setNodeLabel] = useState(initial?.kind === "grid" ? initial.nodeLabel || initial.nodeId || "" : "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [overLimit, setOverLimit] = useState<number | null>(null);
  const [guide, setGuide] = useState<Sourced<string> | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);
  const estimate = useAsync((d) => d.estimateAddSite({ kind: v.kind }), [v.kind]);
  const status = useAsync((d) => d.getStatus());
  const quick = useAsync((d) => d.searchNodes(""));

  const set = <K extends keyof SiteFormValues>(k: K, val: SiteFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const blur = (k: keyof SiteFormValues) => setTouched((t) => ({ ...t, [k]: true }));

  // Тариф: пересчёт из $/кВт·ч в $/МВт·ч
  useEffect(() => {
    const n = Number(tariffRaw.replace(",", "."));
    const perMwh = tariffRaw.trim() === "" || !Number.isFinite(n) ? "" : String(unit === "kwh" ? Math.round(n * 1000 * 1e6) / 1e6 : n);
    setV((p) => (p.tariffUsdPerMwh === perMwh ? p : { ...p, tariffUsdPerMwh: perMwh }));
  }, [tariffRaw, unit]);

  // Живая проверка полей
  useEffect(() => {
    setErrors(validateSiteInput(v));
  }, [v]);

  // Поиск узла
  useEffect(() => {
    if (v.kind !== "grid") return;
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      ds.searchNodes(query).then(
        (r) => { if (alive) { setOptions(r); setSearching(false); } },
        () => { if (alive) { setOptions([]); setSearching(false); } },
      );
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [query, ds, v.kind]);

  const show = (k: keyof SiteFormValues) => (touched[k] ? errors[k] : undefined);
  const hint = fleetConsistencyHint(v);
  const perMw = phsPerMwOf(v);
  const hasErrors = Object.keys(errors).length > 0;

  function pickNode(n: NodeOption) {
    set("nodeId", n.id);
    setNodeLabel(n.label);
    setQuery(n.label);
    setOptions(null);
  }

  async function submit(paused: boolean) {
    setTouched(Object.fromEntries(Object.keys(v).map((k) => [k, true])));
    setFormError(null);
    if (hasErrors) return;
    // Узел не из списка сети — говорим сразу, без запроса к серверу.
    if (v.kind === "grid" && quick.data && !quick.data.some((n) => n.id === v.nodeId)) {
      setFormError(
        live
          ? `Zone "${v.nodeId}" isn't available in live mode yet. Pick one from the list (${quick.data.map((n) => n.id).join(", ")}) or use My tariff.`
          : "We couldn't confirm this node with the data network. Check the name or use My tariff.",
      );
      return;
    }
    if (!editing && !paused && v.kind === "grid") {
      const est = await ds.estimateAddSite({ kind: v.kind });
      if (est.wouldExceedLimit) {
        setOverLimit(est.limitUsd);
        return;
      }
    }
    setSaving(true);
    try {
      const input = toSiteInput(v, nodeLabel || v.nodeId);
      const res = initial ? await ds.updateSite(initial.id, { ...input, paused: initial.paused }) : await ds.addSite(paused ? { ...input, paused: true } : input);
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      bump();
      router.push(withState(`/sites/${res.site.id}`));
    } finally {
      setSaving(false);
    }
  }

  async function loadGuide() {
    setGuideError(null);
    if (!ds.fetchLeaseGuide) return;
    try {
      setGuide(await ds.fetchLeaseGuide());
      bump();
    } catch (e) {
      setGuideError(e instanceof Error ? e.message : "Failed");
    }
  }

  const limitReached = status.data?.limitReached ?? false;

  return (
    <form
      className="stack"
      style={{ maxWidth: 640 }}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <h1>{editing ? `Edit ${initial.name}` : "Add place"}</h1>

      {formError && <Banner kind="bad">{formError}</Banner>}
      {overLimit !== null && (
        <Banner
          kind="warn"
          actions={
            <>
              <AppLink href="/spend#settings" className="btn small">Raise limit</AppLink>
              <button type="button" className="btn small" onClick={() => void submit(true)}>Add anyway (paused)</button>
            </>
          }
        >
          This place would exceed your daily limit ({usd(overLimit)}). Raise the limit or add it later.
        </Banner>
      )}

      <section className="card stack" aria-label="Site type">
        <div className="field">
          <span className="label" id="kind-label">Site type</span>
          <div className="seg" role="group" aria-labelledby="kind-label">
            <button type="button" aria-pressed={v.kind === "grid"} onClick={() => set("kind", "grid")}>Grid node</button>
            <button type="button" aria-pressed={v.kind === "tariff"} onClick={() => set("kind", "tariff")}>My tariff</button>
          </div>
          <span className="hint">{v.kind === "grid" ? "Pay the hourly market price" : "I pay a fixed rate"}</span>
        </div>

        {v.kind === "grid" ? (
          <div className="field">
            <label htmlFor="node">Power source</label>
            <input
              id="node"
              className="input"
              placeholder="Search node, hub or region (e.g. HB_HOUSTON)"
              value={query}
              autoComplete="off"
              onChange={(e) => { setQuery(e.target.value); set("nodeId", e.target.value.trim()); setNodeLabel(""); }}
              onBlur={() => blur("nodeId")}
              aria-invalid={!!show("nodeId")}
            />
            <div className="chips" aria-label="Quick picks">
              {(quick.data ?? []).slice(0, 3).map((n) => (
                <button type="button" key={n.id} onClick={() => pickNode(n)}>{shortLabel(n)}</button>
              ))}
            </div>
            {searching && <span className="hint">Searching…</span>}
            {!searching && options && options.length > 0 && v.nodeId !== "" && nodeLabel === "" && (
              <div className="listbox" role="listbox" aria-label="Matching nodes">
                {options.map((o) => (
                  <button type="button" role="option" aria-selected={false} key={o.id} onClick={() => pickNode(o)}>{o.label}</button>
                ))}
              </div>
            )}
            {show("nodeId") && <span className="error-text">{show("nodeId")}</span>}
            <span className="hint">
              {live
                ? "Live mode covers day-ahead zones DE-LU, FR, PL, AT and NL (Energy-Charts). ERCOT isn't served with prices on the Telegraph test network yet."
                : "Availability depends on the data network. Other regions (PJM, CAISO, Europe) may not be covered yet."}
            </span>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="rate">Rate</label>
            <div className="row">
              <input id="rate" className="input" style={{ maxWidth: 180 }} inputMode="decimal" placeholder={unit === "kwh" ? "0.040" : "40"} value={tariffRaw} onChange={(e) => setTariffRaw(e.target.value)} onBlur={() => blur("tariffUsdPerMwh")} aria-invalid={!!show("tariffUsdPerMwh")} />
              <div className="seg" role="group" aria-label="Rate unit">
                <button type="button" aria-pressed={unit === "kwh"} onClick={() => setUnit("kwh")}>$/kWh</button>
                <button type="button" aria-pressed={unit === "mwh"} onClick={() => setUnit("mwh")}>$/MWh</button>
              </div>
            </div>
            {show("tariffUsdPerMwh") && <span className="error-text">{show("tariffUsdPerMwh")}</span>}
            <span className="hint">
              {v.tariffUsdPerMwh ? `${usd(Number(v.tariffUsdPerMwh) / 1000, 3)}/kWh = ${usd(Number(v.tariffUsdPerMwh), 0)} /MWh` : "Example: 0.040 $/kWh = $40 /MWh"}
            </span>
          </div>
        )}

        <Field id="name" label="Site name" value={v.name} placeholder="Houston Hub" onChange={(x) => set("name", x)} onBlur={() => blur("name")} error={show("name")} />
      </section>

      <section className="card stack" aria-label="Miners">
        <h2>Miners</h2>
        <div className="grid2">
          <Field id="phs" label="Mining power (PH/s)" value={v.phs} placeholder="1000" inputMode="decimal" onChange={(x) => set("phs", x)} onBlur={() => blur("phs")} error={show("phs")} />
          <Field id="mw" label="Power draw (MW)" value={v.mw} placeholder="20" inputMode="decimal" onChange={(x) => set("mw", x)} onBlur={() => blur("mw")} error={show("mw")} />
          <Field id="j" label="Efficiency (J/TH)" value={v.jPerTh} placeholder="20" inputMode="decimal" onChange={(x) => set("jPerTh", x)} onBlur={() => blur("jPerTh")} error={show("jPerTh")} />
        </div>
        {perMw !== null && <span className="hint num">≈ {perMw.toFixed(1)} PH/s per MW</span>}
        {hint && <span className="hint" style={{ color: "var(--warn)" }}>{hint}</span>}
      </section>

      <section className="card stack" aria-label="AI lease">
        <label className="row">
          <input type="checkbox" checked={v.hasLease} onChange={(e) => set("hasLease", e.target.checked)} />
          <b>AI lease</b> <span className="muted small">(optional)</span>
        </label>
        {v.hasLease && (
          <>
            <div className="grid2">
              <Field id="lease" label="Lease rate ($/MWh)" value={v.leaseRate} placeholder="95" inputMode="decimal" onChange={(x) => set("leaseRate", x)} onBlur={() => blur("leaseRate")} error={show("leaseRate")} />
              <Field id="overhead" label="Overhead ($/MWh)" value={v.overhead} placeholder="8" inputMode="decimal" onChange={(x) => set("overhead", x)} onBlur={() => blur("overhead")} error={show("overhead")} />
            </div>
            <label className="row">
              <input type="checkbox" checked={!!v.includesPower} onChange={(e) => set("includesPower", e.target.checked)} />
              Power is included in this rate <span className="muted small">(we won&apos;t subtract the power price)</span>
            </label>
            {ds.fetchLeaseGuide && <div>
              <button type="button" className="btn small" onClick={loadGuide} disabled={limitReached}>See market guide ({usd(GUIDE_COST_USD)})</button>
              {guide && (
                <span style={{ marginLeft: 8 }}>
                  <b>{guide.value}</b> <span className="muted small">estimate only</span>{" "}
                  <ReceiptChip receipt={guide.receipt} now={status.data?.now ?? guide.receipt.fetchedAt ?? ""} />
                </span>
              )}
              {guideError && <span className="error-text" style={{ marginLeft: 8 }}>{guideError}</span>}
            </div>}
          </>
        )}
      </section>

      <section className="card stack" aria-label="Threshold">
        <Field id="threshold" label="Threshold ($/MWh)" value={v.threshold} inputMode="decimal" onChange={(x) => set("threshold", x)} onBlur={() => blur("threshold")} error={show("threshold")} />
        <span className="hint">Don&apos;t switch if the gain is smaller than this.</span>
      </section>

      <div className="row">
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? (editing ? "Saving…" : "Fetching first call…") : editing ? "Save changes" : "Add place"}
        </button>
        <AppLink href={editing ? `/sites/${initial.id}` : "/"} className="btn">Cancel</AppLink>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        {editing
          ? "Changes show right away. Hours the agent already recorded keep the numbers they were decided with."
          : estimate.data
            ? estimate.data.requestsPerDay > 0
              ? `Adding a site makes ~${estimate.data.requestsPerDay} paid requests per day (≈ ${usd(estimate.data.costPerDayUsd)}).`
              : live
                ? "No extra cost: one paid Telegraph request per hour covers all places; power prices are free."
                : "A fixed-rate site makes no paid grid requests."
            : "Estimating cost…"}
      </p>
    </form>
  );
}

function Field({
  id, label, value, onChange, onBlur, error, placeholder, inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  inputMode?: "decimal" | "numeric" | "text";
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} placeholder={placeholder} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
      {error && <span id={`${id}-err`} className="error-text">{error}</span>}
    </div>
  );
}
