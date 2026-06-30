import React, { useEffect, useMemo, useState } from 'react';
import { apiService, DistrictStatus } from '../services/apiService';

interface District {
  id: number;
  name: string;
  code: string;
  municipality: string;
  province: string;
  population: number | null;
  status: DistrictStatus;
}

const DistrictMap: React.FC = () => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDistricts();
  }, []);

  const loadDistricts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getDistricts();
      setDistricts((data.districts || []) as District[]);
    } catch (e) {
      console.error('Failed to load districts:', e);
      setError('District data could not be loaded. Check the API connection or try again.');
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const byMetro = new Map<string, District[]>();
    for (const d of districts) {
      const list = byMetro.get(d.municipality) ?? [];
      list.push(d);
      byMetro.set(d.municipality, list);
    }
    return Array.from(byMetro.entries())
      .map(([metro, items]) => ({
        metro,
        items: items.slice().sort((a, b) => a.name.localeCompare(b.name)),
        counts: {
          unmonitored: items.filter(d => d.status === 'unmonitored').length,
          green:  items.filter(d => d.status === 'green').length,
          yellow: items.filter(d => d.status === 'yellow').length,
          red:    items.filter(d => d.status === 'red').length,
        },
      }))
      .sort((a, b) => a.metro.localeCompare(b.metro));
  }, [districts]);

  return (
    <div className="district-map">
      <h2>District Overview</h2>
      {loading && <div className="monitoring-state">Loading districts…</div>}
      {!loading && error && <div className="monitoring-state error">{error}</div>}
      {!loading && !error && districts.length === 0 && (
        <div className="monitoring-state">No districts are available yet.</div>
      )}
      <div className="metro-groups">
        {grouped.map(({ metro, items, counts }) => (
          <details
            key={metro}
            className="metro-group"
            open={counts.red > 0 || counts.yellow > 0}
          >
            <summary className="metro-summary">
              <div className="metro-summary-main">
                <span className="metro-name">{metro}</span>
                <span className="metro-meta">
                  {items.length} district{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="metro-status-pills">
                {counts.green  > 0 && <span className="metro-pill green">{counts.green} GREEN</span>}
                {counts.yellow > 0 && <span className="metro-pill yellow">{counts.yellow} YELLOW</span>}
                {counts.red    > 0 && <span className="metro-pill red">{counts.red} RED</span>}
                {counts.unmonitored > 0 && <span className="metro-pill unmonitored">{counts.unmonitored} UNMONITORED</span>}
              </div>
            </summary>
            <div className="districts-grid">
              {items.map((d) => (
                <div key={d.id} className={`district-card status-${d.status}`}>
                  <h3>{d.name}</h3>
                  <p><strong>Code:</strong> {d.code}</p>
                  <p><strong>Province:</strong> {d.province}</p>
                  <p><strong>Population:</strong> {d.population != null ? d.population.toLocaleString() : 'Unknown'}</p>
                  <div className={`status-badge ${d.status}`}>{d.status.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};

export default DistrictMap;
