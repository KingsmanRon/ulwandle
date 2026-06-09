/**
 * Verifiable per-metro reference data + dam levels with full source
 * attribution. Every figure shown here originates from a public report
 * cited inline (Stats SA Census 2022, Joburg Water Annual Report,
 * DWS Weekly State of Dams, etc.).
 *
 * Network topology numbers (intersections, zones, leaks) are NOT shown
 * here — those are simulated. This panel is the demo's "ground truth"
 * surface for partnership outreach.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  apiService,
  type DamLevel,
  type MetroBaseline,
  type MetroDamsResponse,
  type SourceRef,
} from "../services/apiService";
import { Metro } from "../constants/metros";
import "./MetroBaselinePanel.css";

interface Props {
  metro: Metro;
}

const fmtInt = (n: number): string => n.toLocaleString("en-ZA");
const fmtPct = (n: number): string => `${n.toFixed(1)}%`;

const SourceLine: React.FC<{ label: string; src: SourceRef }> = ({ label, src }) => (
  <div className="source-line">
    <span className="source-label">{label}:</span>{" "}
    {src.url ? (
      <a href={src.url} target="_blank" rel="noopener noreferrer">{src.name}</a>
    ) : (
      <span>{src.name}</span>
    )}
    {src.as_of ? <span className="source-asof"> ({src.as_of})</span> : null}
    {src.caveat ? <div className="source-caveat">{src.caveat}</div> : null}
  </div>
);

const MetroBaselinePanel: React.FC<Props> = ({ metro }) => {
  const [baseline, setBaseline] = useState<MetroBaseline | null>(null);
  const [dams, setDams] = useState<MetroDamsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiService.getMetroBaseline(metro.id),
      apiService.getMetroDamLevels(metro.id),
    ])
      .then(([b, d]) => {
        if (cancelled) return;
        setBaseline(b);
        setDams(d);
      })
      .catch(err => {
        if (cancelled) return;
        const msg =
          err?.response?.status === 404
            ? "Metro baseline not seeded — run scripts.seed_metros on the backend."
            : "Could not load baseline data. Check backend logs.";
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [metro.id]);

  const litresPerDay = useMemo(() => {
    if (!baseline?.per_capita_lpcd) return null;
    return Math.round((baseline.population * baseline.per_capita_lpcd) / 1_000_000);
  }, [baseline]);

  if (loading) return <div className="metro-baseline-panel">Loading verified data…</div>;
  if (error) return <div className="metro-baseline-panel error">{error}</div>;
  if (!baseline) return null;

  const primaryDams = dams?.dams.filter(d => d.is_primary) ?? [];
  const otherDams = dams?.dams.filter(d => !d.is_primary) ?? [];

  return (
    <section className="metro-baseline-panel">
      <header className="mbp-header">
        <h2>{baseline.name} — Verified data</h2>
        <p className="mbp-subtitle">
          Every figure below cites the public report it came from.
          Topology, zones and leak figures elsewhere in the app are simulated;
          this panel is not.
        </p>
      </header>

      <div className="mbp-grid">

        <article className="mbp-card">
          <h3>Population</h3>
          <p className="mbp-figure">{fmtInt(baseline.population)}</p>
          <SourceLine label="Source" src={baseline.population_source} />
        </article>

        <article className="mbp-card">
          <h3>Non-Revenue Water</h3>
          <p className="mbp-figure">{fmtPct(baseline.nrw_pct)}</p>
          <SourceLine label="Source" src={baseline.nrw_source} />
        </article>

        {baseline.per_capita_lpcd != null && (
          <article className="mbp-card">
            <h3>Per-capita consumption</h3>
            <p className="mbp-figure">
              {baseline.per_capita_lpcd.toFixed(0)} L<span className="mbp-unit">/capita/day</span>
            </p>
            {litresPerDay != null && (
              <p className="mbp-derived">
                ≈ {fmtInt(litresPerDay)} Mℓ/day system input (population × per-capita)
              </p>
            )}
            {baseline.per_capita_source && (
              <SourceLine label="Source" src={baseline.per_capita_source} />
            )}
          </article>
        )}

      </div>

      <h3 className="mbp-section-h">Supplying dams — latest storage</h3>
      {dams?.stale && (
        <p className="mbp-stale-warning" role="alert">
          ⚠ Some readings are over {dams.stale_after_days} days old
          {dams.oldest_as_of ? ` (oldest: ${dams.oldest_as_of})` : ""}. The dam
          scraper may have stopped — treat these as last-known, not live.
        </p>
      )}
      {!dams?.has_data ? (
        <p className="mbp-empty">
          No dam-level readings yet. The DWS weekly scraper hasn't run, or the
          dams supplying this metro aren't in the registry yet. Run{" "}
          <code>python -m app.services.dws_scraper</code> on the backend, or
          for Cape Town{" "}
          <code>python -m app.services.coct_scraper</code>.
        </p>
      ) : (
        <>
          {dams.weighted_storage_pct != null && (
            <p className="mbp-weighted">
              Weighted system storage:{" "}
              <strong>{fmtPct(dams.weighted_storage_pct)}</strong>{" "}
              <span className="mbp-weighted-note">(by full-supply capacity)</span>
            </p>
          )}
          <ul className="mbp-dams">
            {[...primaryDams, ...otherDams].map(d => (
              <DamRow key={d.dam_id} dam={d} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

const DamRow: React.FC<{ dam: DamLevel }> = ({ dam }) => {
  const barWidth = Math.max(0, Math.min(100, dam.storage_pct));
  return (
    <li className={`mbp-dam-row ${dam.is_primary ? "is-primary" : ""}`}>
      <div className="mbp-dam-head">
        <span className="mbp-dam-name">
          {dam.name} {dam.is_primary && <span className="mbp-tag">primary</span>}
          {dam.stale && (
            <span className="mbp-stale-tag"
                  title={`Last verified ${dam.age_days ?? "?"} days ago — possibly stale`}>
              STALE
            </span>
          )}
        </span>
        <span className="mbp-dam-pct">{fmtPct(dam.storage_pct)}</span>
      </div>
      <div className="mbp-dam-bar">
        <div className="mbp-dam-bar-fill" style={{ width: `${barWidth}%` }} />
      </div>
      <div className="mbp-dam-meta">
        {dam.storage_ml != null && dam.full_capacity_ml != null && (
          <span>
            {fmtInt(Math.round(dam.storage_ml))} / {fmtInt(Math.round(dam.full_capacity_ml))} Mℓ
          </span>
        )}
        <SourceLine label="As of" src={dam.source} />
      </div>
    </li>
  );
};

export default MetroBaselinePanel;
