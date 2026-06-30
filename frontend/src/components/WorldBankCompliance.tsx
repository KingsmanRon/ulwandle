import React from 'react';
import { AlertCircle, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Metro, MetroWaterData } from '../constants/metros';
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

function sanitiseCell<T>(value: T): T {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return ("'" + value) as unknown as T;
  }
  return value;
}

function sanitiseRow<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, sanitiseCell(value)]),
  ) as T;
}

const WorldBankCompliancePanel: React.FC<WorldBankCompliancePanelProps> = ({
  allMetroData,
  selectedMetro,
  zones = [],
  recommendations,
  historicalData = [],
}) => {
  const handleExcelExport = () => {
    if (allMetroData.length === 0) return;

    const workbook = XLSX.utils.book_new();

    const notesSheet = XLSX.utils.json_to_sheet([
      sanitiseRow({ Field: 'Data status', Value: 'ILLUSTRATIVE DEMO DATA' }),
      sanitiseRow({ Field: 'Permitted use', Value: 'Product evaluation and workflow design only' }),
      sanitiseRow({
        Field: 'Not suitable for',
        Value: 'W10, W11, PIAP, audit, regulatory submission, or independent verification',
      }),
      sanitiseRow({
        Field: 'Required replacement data',
        Value: 'Approved bulk supply, billed authorised consumption, connection, and actual meter reading records',
      }),
      sanitiseRow({ Field: 'Generated at', Value: new Date().toISOString() }),
    ]);
    notesSheet['!cols'] = [{ wch: 24 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(workbook, notesSheet, 'READ ME');

    const overviewSheet = XLSX.utils.json_to_sheet(allMetroData.map(metro => sanitiseRow({
      'Data status': 'ILLUSTRATIVE',
      Metro: metro.metro,
      Province: metro.province,
      Population: metro.population,
      'Daily intake (ML)': metro.intake,
      'Modelled usage (ML)': metro.usage,
      'Modelled loss (ML)': metro.wastage,
      'Modelled loss %': metro.wastagePercentage,
      'Modelled per capita (L/day)': metro.perCapita,
      'Scenario stress level': metro.stressLevel,
      'Generated at': new Date(metro.timestamp).toISOString(),
    })));
    overviewSheet['!cols'] = [
      { wch: 18 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 18 },
      { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Illustrative Overview');

    if (zones.length > 0 && selectedMetro) {
      const zoneSheet = XLSX.utils.json_to_sheet(zones.map(zone => sanitiseRow({
        'Data status': 'ILLUSTRATIVE',
        Metro: selectedMetro.name,
        'Zone ID': zone.zone_id,
        'Zone name': zone.name,
        Population: zone.population,
        'Daily intake (ML)': zone.daily_intake_ml,
        'Modelled usage (ML)': zone.daily_usage_ml,
        'Modelled loss (ML)': zone.daily_wastage_ml,
        'Modelled loss %': zone.wastage_percentage,
        'Sample active leaks': zone.has_active_leaks ? 'YES' : 'NO',
        'Sample leak count': zone.leak_count,
        'Scenario priority score': zone.priority_score,
      })));
      zoneSheet['!cols'] = [
        { wch: 18 }, { wch: 30 }, { wch: 22 }, { wch: 35 }, { wch: 12 }, { wch: 18 },
        { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 24 },
      ];
      XLSX.utils.book_append_sheet(workbook, zoneSheet, 'Illustrative Zones');
    }

    if (historicalData.length > 0) {
      const trendsSheet = XLSX.utils.json_to_sheet(historicalData.map(point => sanitiseRow({
        'Data status': 'ILLUSTRATIVE',
        Period: point.day,
        'Modelled intake (ML)': point.intake,
        'Modelled usage (ML)': point.usage,
        'Modelled loss (ML)': point.wastage,
      })));
      trendsSheet['!cols'] = [
        { wch: 18 }, { wch: 15 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(workbook, trendsSheet, 'Illustrative Trends');
    }

    if (recommendations?.status === 'ok' && recommendations.recommendations) {
      const recommendationsSheet = XLSX.utils.json_to_sheet(
        recommendations.recommendations.map((item, index) => sanitiseRow({
          'Data status': 'AI ADVISORY',
          Priority: index + 1,
          Recommendation: item.title,
          Description: item.description,
          Impact: item.impact,
          'Estimated cost': item.cost,
          Timeline: item.timeline,
          'Key performance indicators': (item.kpis || []).join('; '),
        })),
      );
      recommendationsSheet['!cols'] = [
        { wch: 18 }, { wch: 10 }, { wch: 35 }, { wch: 60 },
        { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 50 },
      ];
      XLSX.utils.book_append_sheet(workbook, recommendationsSheet, 'AI Recommendations');
    }

    const stamp = new Date().toISOString().split('T')[0];
    const filename = allMetroData.length === 1
      ? `${allMetroData[0].metro.replace(/\s+/g, '_')}_illustrative_scenario_${stamp}.xlsx`
      : `SA_illustrative_water_scenario_${allMetroData.length}_metros_${stamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const hasSelection = allMetroData.length > 0;
  const sheetCount = 2
    + (zones.length > 0 && selectedMetro ? 1 : 0)
    + (historicalData.length > 0 ? 1 : 0)
    + (recommendations?.status === 'ok' && recommendations.recommendations ? 1 : 0);

  return (
    <div className="world-bank-compliance">
      <div className="export-header">
        <div className="export-info">
          <FileSpreadsheet size={28} color={hasSelection ? '#0284c7' : '#9ca3af'} />
          <div>
            <h3>Export illustrative scenario workbook</h3>
            <p>
              {hasSelection
                ? `Excel workbook with explicit data notes, representative overview${zones.length > 0 ? ', sample zones' : ''}${historicalData.length > 0 ? ', sample trends' : ''}${recommendations?.status === 'ok' ? ', and AI advisory' : ''}.`
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
          Export scenario
        </button>
      </div>
      {!hasSelection && (
        <div className="export-help">
          <AlertCircle size={16} />
          <span>The illustrative workbook becomes available once you select metros above.</span>
        </div>
      )}
      {hasSelection && (
        <div className="export-help" role="note">
          <AlertCircle size={16} />
          <span>
            Ready to export {allMetroData.length} metro{allMetroData.length > 1 ? 's' : ''} ({sheetCount} sheets).
            This is demo data and is not valid for W10, W11, PIAP, audit, or independent verification.
          </span>
        </div>
      )}
    </div>
  );
};

export default WorldBankCompliancePanel;
