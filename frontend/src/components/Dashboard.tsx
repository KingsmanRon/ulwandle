/**
 * System Overview — landing dashboard.
 *
 * Surfaces the verified per-metro data + scraped dam levels as the
 * first thing a user sees, with full source attribution. No polling;
 * data only changes when the GitHub Actions scrapers run.
 *
 * The previous SCADA-flavoured operational dashboard (districts,
 * sensors, valves, alerts) lives in LegacyDashboard.tsx — it'll be
 * the right view once real sensor telemetry exists.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  apiService,
  type DataSourceStatus,
  type MetroBaseline,
  type MetroDamsResponse,
} from "../services/apiService";
import "./Dashboard.css";


const fmtInt = (n: number): string => n.toLocaleString("en-ZA");
const fmtPct = (n: number, decimals = 1): string => `${n.toFixed(decimals)}%`;

// Headline "rand value lost to NRW" assumptions. Both values are
// auditable and conservative — buyers can substitute their own.
//   - TARIFF_ZAR_PER_KL: bulk treated-water replacement cost. SA municipal
//     bulk-supply tariffs sit in the R10–R15/kL band; R12 is a defensible
//     midpoint. 1 kL = 1 m³.
//   - FALLBACK_LPCD: DWS national 2023 baseline per-capita figure, used
//     only when a metro's baseline omits per_capita_lpcd.
const TARIFF_ZAR_PER_KL = 12;
const FALLBACK_LPCD = 216;

function metroAnnualLossZar(m: MetroBaseline): number {
  const lpcd = m.per_capita_lpcd ?? FALLBACK_LPCD;
  const intakeMldPerDay = (m.population * lpcd) / 1_000_000;     // ML/day
  const lossKlPerYear = intakeMldPerDay * (m.nrw_pct / 100) * 365 * 1000;
  return lossKlPerYear * TARIFF_ZAR_PER_KL;
}

function fmtZarCompact(rand: number): string {
  if (rand >= 1_000_000_000) return `R${(rand / 1_000_000_000).toFixed(1)} bn`;
  if (rand >= 1_000_000)     return `R${(rand / 1_000_000).toFixed(0)} m`;
  if (rand >= 1_000)         return `R${(rand / 1_000).toFixed(0)} k`;
  return `R${rand.toFixed(0)}`;
}

function relativeAge(iso?: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const days = Math.floor(diff / 86_400_000);
  if (days >= 30) return `${Math.floor(days / 30)} months ago`;
  if (days >= 7)  return `${Math.floor(days / 7)} weeks ago`;
  if (days >= 1)  return `${days} day${days === 1 ? "" : "s"} ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  return "just now";
}

function refreshClass(iso: string | null | undefined, staleAfterDays: number): string {
  if (!iso) return "stale";
  const ageDays = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return ageDays > staleAfterDays ? "stale" : "fresh";
}


const Dashboard: React.FC = () => {
  const [baselines, setBaselines] = useState<MetroBaseline[]>([]);
  const [damsByMetro, setDamsByMetro] = useState<Map<string, MetroDamsResponse>>(new Map());
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [bl, ds] = await Promise.all([
          apiService.getMetroBaselines(),
          apiService.getDataSources(),
        ]);
        if (cancelled) return;
        const dams: Array<readonly [string, MetroDamsResponse]> = await Promise.all(
          bl.map(b =>
            apiService.getMetroDamLevels(b.metro_id)
              .then(r => [b.metro_id, r] as const)
              .catch((): readonly [string, MetroDamsResponse] => [
                b.metro_id,
                { metro_id: b.metro_id, dams: [] as MetroDamsResponse["dams"], has_data: false },
              ] as const)
          )
        );
        if (cancelled) return;
        setBaselines(bl);
        setDamsByMetro(new Map(dams));
        setSources(ds);
      } catch {
        if (!cancelled) setError("Could not load overview. The API may be warming up — try again in a few seconds.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    if (baselines.length === 0) return null;
    const totalPop = baselines.reduce((s, m) => s + m.population, 0);
    const popWeightedNRW = baselines.reduce((s, m) => s + m.nrw_pct * m.population, 0) / totalPop;
    const annualLossZar = baselines.reduce((s, m) => s + metroAnnualLossZar(m), 0);
    const allDams = Array.from(damsByMetro.values()).flatMap(d => d.dams);
    const seenDamIds = new Set(allDams.map(d => d.dam_id));
    const critical = allDams.filter(d => d.storage_pct < 30);
    const staleDamCount = new Set(allDams.filter(d => d.stale).map(d => d.dam_id)).size;
    return {
      metroCount: baselines.length,
      totalPop,
      popWeightedNRW,
      annualLossZar,
      damCount: seenDamIds.size,
      criticalDams: critical,
      staleDamCount,
    };
  }, [baselines, damsByMetro]);

  const coct = sources.find(s => s.key === "coct_daily_dams");
  const dws  = sources.find(s => s.key === "dws_weekly_dams");

  if (loading) return <div className="loading">Loading overview…</div>;
  if (error)   return <div className="dashboard"><div className="card error-card">{error}</div></div>;
  if (!stats)  return <div className="dashboard"><div className="card">No metro baseline data — run <code>scripts.seed_metros</code> on the backend.</div></div>;

  // Sorted-by-NRW glance table
  const sortedMetros = [...baselines].sort((a, b) => b.nrw_pct - a.nrw_pct);

  return (
    <div className="dashboard">
      <h2>System Overview</h2>
      <p className="overview-subtitle">
        Real per-metro reference data + live dam levels with full source citations.
        Updated by scheduled scrapers — no manual data entry.
      </p>

      {stats.staleDamCount > 0 && (
        <div className="stale-banner" role="alert">
          ⚠ <strong>{stats.staleDamCount} dam{stats.staleDamCount === 1 ? "" : "s"}</strong>{" "}
          showing readings older than the freshness window — a dam scraper may have
          stopped. Storage figures below are last-known, not live; check the
          CoCT / DWS refresh cards.
        </div>
      )}

      <div className="hero-stat" role="figure" aria-label="Estimated annual non-revenue water loss">
        <div className="hero-stat-label">Water lost to NRW across {stats.metroCount} metros</div>
        <div className="hero-stat-value">{fmtZarCompact(stats.annualLossZar)}<span className="hero-stat-unit">/ year</span></div>
        <div className="hero-stat-sub">
          Population-weighted NRW <strong>{fmtPct(stats.popWeightedNRW)}</strong> across{" "}
          <strong>{fmtInt(stats.totalPop)}</strong> residents.
        </div>
        <div className="hero-stat-assumption">
          Assumption: population × per-capita L/d × NRW% × <strong>R{TARIFF_ZAR_PER_KL}/kL</strong>{" "}
          bulk treated water. Tariff is editable in <code>Dashboard.tsx</code> — swap for any
          buyer&apos;s real cost-of-water figure.
        </div>
        <div className="hero-stat-provenance">
          Inputs sourced: population — <strong>Stats SA Census 2022</strong>; NRW% — per-metro
          utility &amp; DWS reports (each cited under the Metros → Sources tab); tariff —{" "}
          <strong>R{TARIFF_ZAR_PER_KL}/kL</strong> assumption shown above.
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card metros">
          <h3>Metros monitored</h3>
          <div className="stat-value">{stats.metroCount}</div>
          <div className="stat-breakdown">
            <span>{fmtInt(stats.totalPop)} residents covered</span>
            <span className="muted">Source: Stats SA Census 2022</span>
          </div>
        </div>

        <div className="stat-card alerts">
          <h3>Avg Non-Revenue Water</h3>
          <div className="stat-value">{fmtPct(stats.popWeightedNRW)}</div>
          <div className="stat-breakdown">
            <span>Population-weighted across 8 metros</span>
            <span className="muted">DWS national 2023: 47%</span>
          </div>
        </div>

        <div className="stat-card sensors">
          <h3>Dams tracked</h3>
          <div className="stat-value">{stats.damCount}</div>
          <div className="stat-breakdown">
            <span>{stats.criticalDams.length === 0
              ? "All dams above 30% storage"
              : `${stats.criticalDams.length} dam${stats.criticalDams.length === 1 ? "" : "s"} below 30%`}</span>
            <span className="muted">Sources: DWS Weekly + CoCT Daily</span>
          </div>
        </div>

        <div className="stat-card valves">
          <h3>CoCT data refresh</h3>
          <div className={`stat-value refresh-${refreshClass(coct?.last_success_at, 2)}`}>
            {relativeAge(coct?.last_success_at)}
          </div>
          <div className="stat-breakdown">
            <span>{coct?.last_status === "ok" ? `${coct?.rows_last_run ?? 0} dam readings` : "—"}</span>
            <span className="muted">capetown.gov.za daily</span>
          </div>
        </div>

        <div className="stat-card leaks">
          <h3>DWS data refresh</h3>
          <div className={`stat-value refresh-${refreshClass(dws?.last_success_at, 8)}`}>
            {relativeAge(dws?.last_success_at)}
          </div>
          <div className="stat-breakdown">
            <span>{dws?.last_status === "ok" ? `${dws?.rows_last_run ?? 0} dam readings` : "—"}</span>
            <span className="muted">dws.gov.za weekly</span>
          </div>
        </div>

        <div className="stat-card flow">
          <h3>Critical dams</h3>
          <div className="stat-value">{stats.criticalDams.length}</div>
          <div className="stat-breakdown">
            {stats.criticalDams.length === 0 ? (
              <span>No dams in critical range</span>
            ) : (
              stats.criticalDams.slice(0, 3).map(d => (
                <span key={d.dam_id}>{d.name}: {fmtPct(d.storage_pct)}</span>
              ))
            )}
          </div>
        </div>
      </div>

      <h3 className="glance-h">Metros at a glance</h3>
      <p className="glance-sub">Ordered by NRW%. Click a row's metro name in the Metros tab → Sources for full detail.</p>
      <div className="metros-glance-table" role="table">
        <div className="glance-row glance-head" role="row">
          <span>Metro</span>
          <span className="num">Population</span>
          <span className="num">NRW</span>
          <span>Primary dam</span>
          <span className="num">Storage</span>
        </div>
        {sortedMetros.map(m => {
          const dams = damsByMetro.get(m.metro_id);
          const primary = dams?.dams.find(d => d.is_primary) ?? dams?.dams[0];
          return (
            <div className="glance-row" role="row" key={m.metro_id}>
              <span><strong>{m.name}</strong> <span className="muted">{m.code}</span></span>
              <span className="num">{fmtInt(m.population)}</span>
              <span className="num">
                {fmtPct(m.nrw_pct)}
                {m.nrw_source.caveat && <span className="caveat-mark" title={m.nrw_source.caveat}>*</span>}
              </span>
              <span>{primary?.name ?? "—"}</span>
              <span className="num">
                {primary ? fmtPct(primary.storage_pct) : "—"}
                {primary?.stale && (
                  <span className="caveat-mark"
                        title={`Reading ~${primary.age_days ?? "?"} days old — possibly stale`}>*</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <footer className="data-sources-footer">
        <strong>Data sources</strong>
        <ul>
          {sources.map(s => (
            <li key={s.key}>
              {s.url
                ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a>
                : s.name}
              {s.last_success_at && <span className="muted"> · last refresh {relativeAge(s.last_success_at)}</span>}
            </li>
          ))}
        </ul>
        <p className="footer-note">
          Network topology, sensor flow rates, and operational metrics
          (districts, valves, leaks) are populated by SCADA integration —
          not yet wired. The Metros tab shows what's live; this overview
          is the first place to look every morning.
        </p>
      </footer>
    </div>
  );
};

export default Dashboard;
