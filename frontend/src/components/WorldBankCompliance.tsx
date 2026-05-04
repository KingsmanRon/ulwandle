import React from 'react';
import { Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { MetroWaterData, Metro } from '../constants/metros';
import { ClaudeRecommendationsData } from './ClaudeRecommendations';
import './WorldBankCompliance.css';

interface ZoneData {
  zone_id: string;
  name: string;
  population: number;
  daily_intake_ml: number;
  daily_usage_ml: number;
  daily_wastage_ml: number;
  wastage_percentage: number;
  has_active_leaks: boolean;
  leak_count: number;
  priority_score: number;
}

interface HistoricalPoint {
  day: string;
  intake: number;
  usage: number;
  wastage: number;
}

interface WorldBankCompliancePanelProps {
  allMetroData: MetroWaterData[];
  selectedMetro?: Metro | null;
  zones?: ZoneData[];
  recommendations?: ClaudeRecommendationsData | null;
  historicalData?: HistoricalPoint[];
}

// Defensive: any string starting with =, +, -, @ in a spreadsheet cell
// can be interpreted as a formula by Excel/LibreOffice/Numbers (CSV
// injection class — see CVE-2014-3524 family). Prefix such strings with
// a single quote so the cell is treated as text. We apply this on every
// string value that originates from anything other than a static
// constant, since the synthetic data could one day include real user
// content (zone names, recommendations) that an attacker influences.
function sanitiseCell<T>(value: T): T {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return ("'" + value) as unknown as T;
  }
  return value;
}

function sanitiseRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = sanitiseCell(v);
  }
  return out as T;
}

function nrwBand(wastagePercentage: number): string {
  if (wastagePercentage < 15) return 'Best practice (<15%)';
  if (wastagePercentage < 25) return 'Acceptable (15-25%)';
  if (wastagePercentage < 30) return 'Poor (25-30%)';
  return 'Critical (>30%)';
}

const WorldBankCompliancePanel: React.FC<WorldBankCompliancePanelProps> = ({
  allMetroData,
  selectedMetro,
  zones = [],
  recommendations,
  historicalData = [],
}) => {

  const handleExcelExport = () => {
    // Defensive: button is also disabled below when there's nothing to
    // export, so this guard should never trip in practice.
    if (!allMetroData || allMetroData.length === 0) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Metro overview
    const overviewRows = allMetroData.map(m => sanitiseRow({
      'Metro': m.metro,
      'Province': m.province,
      'Population': m.population,
      'Daily intake (ML)': m.intake,
      'Actual usage (ML)': m.usage,
      'Wastage (ML)': m.wastage,
      'Wastage %': m.wastagePercentage,
      'Per capita (L/day)': m.perCapita,
      'Water stress level': m.stressLevel,
      'Captured at': new Date(m.timestamp).toISOString(),
    }));
    const ws1 = XLSX.utils.json_to_sheet(overviewRows);
    ws1['!cols'] = [
      { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
      { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Metro Overview');

    // Sheet 2: Zone-level analysis (when a single metro is selected)
    if (zones.length > 0 && selectedMetro) {
      const zoneRows = zones.map(z => sanitiseRow({
        'Metro': selectedMetro.name,
        'Zone ID': z.zone_id,
        'Zone name': z.name,
        'Population': z.population,
        'Daily intake (ML)': z.daily_intake_ml,
        'Daily usage (ML)': z.daily_usage_ml,
        'Daily wastage (ML)': z.daily_wastage_ml,
        'Wastage %': z.wastage_percentage,
        'Active leaks': z.has_active_leaks ? 'YES' : 'NO',
        'Leak count': z.leak_count,
        'Priority score': z.priority_score,
        'Estimated daily loss (R)': Math.round(z.daily_wastage_ml * 400),
        'Severity':
          z.has_active_leaks && z.wastage_percentage > 30 ? 'CRITICAL' :
          z.has_active_leaks || z.wastage_percentage > 25 ? 'HIGH' :
          z.wastage_percentage > 20 ? 'MEDIUM' : 'LOW',
      }));
      const ws2 = XLSX.utils.json_to_sheet(zoneRows);
      ws2['!cols'] = [
        { wch: 30 }, { wch: 22 }, { wch: 35 }, { wch: 12 }, { wch: 18 },
        { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
        { wch: 16 }, { wch: 24 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Zone Analysis');
    }

    // Sheet 3: Historical trends
    if (historicalData.length > 0) {
      const histRows = historicalData.map(d => sanitiseRow({
        'Period': d.day,
        'Intake (ML)': d.intake,
        'Usage (ML)': d.usage,
        'Wastage (ML)': d.wastage,
        'Wastage %': d.intake > 0 ? Number(((d.wastage / d.intake) * 100).toFixed(1)) : 0,
      }));
      const ws3 = XLSX.utils.json_to_sheet(histRows);
      ws3['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Historical Trends');
    }

    // Sheet 4: AI recommendations (only when generation succeeded)
    if (recommendations && recommendations.status === 'ok' && recommendations.recommendations) {
      const recRows = recommendations.recommendations.map((r, i) => sanitiseRow({
        'Priority': i + 1,
        'Recommendation': r.title,
        'Description': r.description,
        'Impact': r.impact,
        'Estimated cost': r.cost,
        'Timeline': r.timeline,
        'Key performance indicators': (r.kpis || []).join('; '),
      }));
      const ws4 = XLSX.utils.json_to_sheet(recRows);
      ws4['!cols'] = [
        { wch: 10 }, { wch: 35 }, { wch: 60 }, { wch: 25 },
        { wch: 25 }, { wch: 20 }, { wch: 50 },
      ];
      XLSX.utils.book_append_sheet(wb, ws4, 'AI Recommendations');

      const summaryRows = [
        {},
        { 'Priority': 'SUMMARY' },
        { 'Priority': 'Overall priority level:', 'Recommendation': recommendations.priority || '' },
        { 'Priority': 'Potential savings:',      'Recommendation': recommendations.potential_savings || '' },
        { 'Priority': 'ROI estimate:',           'Recommendation': recommendations.roi || '' },
      ].map(row => sanitiseRow(row));
      XLSX.utils.sheet_add_json(ws4, summaryRows, { skipHeader: true, origin: -1 });
    }

    // Sheet 5: Compliance against published water-services standards.
    // No claim of formal World Bank PforR scoring is implied — these
    // checks are mechanical comparisons against thresholds: WHO basic
    // water minimum, Statistics South Africa per-capita usage target,
    // and the IWA-recommended NRW (non-revenue water) bands.
    const WHO_MIN = 100;
    const SA_TARGET = 173;
    const complianceRows = allMetroData.map(m => sanitiseRow({
      'Metro': m.metro,
      'Per capita (L/day)': m.perCapita,
      'WHO basic minimum (100 L)': m.perCapita >= WHO_MIN ? 'COMPLIANT' : 'NON-COMPLIANT',
      'Gap to WHO minimum': Math.max(0, WHO_MIN - m.perCapita),
      'SA per-capita target (173 L)': m.perCapita >= SA_TARGET ? 'ACHIEVED' : 'BELOW TARGET',
      'Gap to SA target': Math.max(0, SA_TARGET - m.perCapita),
      'NRW benchmark (target <15%)': m.wastagePercentage <= 15 ? 'GOOD' : 'NEEDS IMPROVEMENT',
      'Excess wastage %': Math.max(0, m.wastagePercentage - 15),
      'NRW band': nrwBand(m.wastagePercentage),
    }));
    const ws5 = XLSX.utils.json_to_sheet(complianceRows);
    ws5['!cols'] = [
      { wch: 30 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 30 },
      { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, ws5, 'Compliance Metrics');

    const stamp = new Date().toISOString().split('T')[0];
    const filename = allMetroData.length === 1
      ? `${allMetroData[0].metro.replace(/\s+/g, '_')}_water_report_${stamp}.xlsx`
      : `SA_water_report_${allMetroData.length}_metros_${stamp}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const hasSelection = allMetroData && allMetroData.length > 0;
  const sheetCount = 2
    + (zones.length > 0 ? 1 : 0)
    + (historicalData.length > 0 ? 1 : 0)
    + (recommendations ? 1 : 0);

  return (
    <div className="world-bank-compliance">
      <div className="export-header">
        <div className="export-info">
          <FileSpreadsheet size={28} color={hasSelection ? '#0284c7' : '#9ca3af'} />
          <div>
            <h3>Export water-services compliance report</h3>
            <p>
              {hasSelection
                ? `Multi-sheet Excel report: overview${zones.length > 0 ? ', zone analysis' : ''}${historicalData.length > 0 ? ', historical trends' : ''}${recommendations ? ', recommendations' : ''}, compliance metrics.`
                : 'Select one or more metros to enable export.'}
            </p>
          </div>
        </div>
        <button
          onClick={handleExcelExport}
          className="export-button"
          disabled={!hasSelection}
          type="button"
        >
          <Download size={18} />
          Export report
        </button>
      </div>
      {!hasSelection && (
        <div className="export-help">
          <AlertCircle size={16} />
          <span>The compliance Excel export becomes available once you select metros above.</span>
        </div>
      )}
      {hasSelection && (
        <div className="export-ready">
          <AlertCircle size={16} color="#10b981" />
          <span>
            Ready to export {allMetroData.length} metro{allMetroData.length > 1 ? 's' : ''} ({sheetCount} sheets).
            Compliance checks are against WHO and SA per-capita targets and IWA NRW bands; the report does not
            include any cryptographic or PforR signature.
          </span>
        </div>
      )}
    </div>
  );
};

export default WorldBankCompliancePanel;
