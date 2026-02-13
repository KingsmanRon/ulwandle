import React from 'react';
import { Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { MetroWaterData, Metro } from '../constants/saMetros';
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

interface WorldBankCompliancePanelProps {
  allMetroData: MetroWaterData[];
  selectedMetro?: Metro | null;
  zones?: ZoneData[];
  recommendations?: ClaudeRecommendationsData | null;
  historicalData?: any[];
}

const WorldBankCompliancePanel: React.FC<WorldBankCompliancePanelProps> = ({
  allMetroData,
  selectedMetro,
  zones = [],
  recommendations,
  historicalData = []
}) => {

  const handleExcelExport = () => {
    if (!allMetroData || allMetroData.length === 0) {
      alert('Please select at least one metro first');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Metro Overview
    const metroOverviewData = allMetroData.map(metroData => ({
      'Metro': metroData.metro,
      'Province': metroData.province,
      'Population': metroData.population,
      'Daily Intake (ML)': metroData.intake,
      'Actual Usage (ML)': metroData.usage,
      'Wastage (ML)': metroData.wastage,
      'Wastage %': metroData.wastagePercentage,
      'Per Capita (L/day)': metroData.perCapita,
      'Water Stress Level': metroData.stressLevel,
      'Blockchain Hash': metroData.blockchainHash || 'N/A',
      'Timestamp': new Date(metroData.timestamp).toLocaleString()
    }));
    const ws1 = XLSX.utils.json_to_sheet(metroOverviewData);
    ws1['!cols'] = [
      { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
      { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 40 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Metro Overview');

    // Sheet 2: Zone-Level Analysis (if zones are available)
    if (zones && zones.length > 0 && selectedMetro) {
      const zoneData = zones.map(zone => ({
        'Metro': selectedMetro.name,
        'Zone ID': zone.zone_id,
        'Zone Name': zone.name,
        'Population': zone.population,
        'Daily Intake (ML)': zone.daily_intake_ml,
        'Daily Usage (ML)': zone.daily_usage_ml,
        'Daily Wastage (ML)': zone.daily_wastage_ml,
        'Wastage %': zone.wastage_percentage,
        'Has Active Leaks': zone.has_active_leaks ? 'YES' : 'NO',
        'Leak Count': zone.leak_count,
        'Priority Score': zone.priority_score,
        'Est. Daily Loss (Rand)': Math.round(zone.daily_wastage_ml * 400),
        'Severity': zone.has_active_leaks && zone.wastage_percentage > 30 ? 'CRITICAL'
          : zone.has_active_leaks || zone.wastage_percentage > 25 ? 'HIGH'
          : zone.wastage_percentage > 20 ? 'MEDIUM' : 'LOW'
      }));
      const ws2 = XLSX.utils.json_to_sheet(zoneData);
      ws2['!cols'] = [
        { wch: 30 }, { wch: 20 }, { wch: 35 }, { wch: 12 }, { wch: 18 },
        { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 },
        { wch: 15 }, { wch: 20 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Zone Analysis');
    }

    // Sheet 3: Historical Trends (if available)
    if (historicalData && historicalData.length > 0) {
      const histData = historicalData.map(day => ({
        'Period': day.day,
        'Intake (ML)': day.intake,
        'Usage (ML)': day.usage,
        'Wastage (ML)': day.wastage,
        'Wastage %': ((day.wastage / day.intake) * 100).toFixed(1)
      }));
      const ws3 = XLSX.utils.json_to_sheet(histData);
      ws3['!cols'] = [
        { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, ws3, 'Historical Trends');
    }

    // Sheet 4: AI Recommendations (if available)
    if (recommendations) {
      const recData = recommendations.recommendations.map((rec, index) => ({
        'Priority': index + 1,
        'Recommendation': rec.title,
        'Description': rec.description,
        'Impact': rec.impact,
        'Estimated Cost': rec.cost,
        'Timeline': rec.timeline,
        'Key Performance Indicators': rec.kpis.join('; ')
      }));
      const ws4 = XLSX.utils.json_to_sheet(recData);
      ws4['!cols'] = [
        { wch: 10 }, { wch: 35 }, { wch: 60 }, { wch: 25 },
        { wch: 25 }, { wch: 20 }, { wch: 50 }
      ];
      XLSX.utils.book_append_sheet(wb, ws4, 'AI Recommendations');

      // Add summary row
      const summaryData = [
        {},
        { 'Priority': 'SUMMARY' },
        { 'Priority': 'Overall Priority Level:', 'Recommendation': recommendations.priority },
        { 'Priority': 'Potential Savings:', 'Recommendation': recommendations.potentialSavings },
        { 'Priority': 'ROI Estimate:', 'Recommendation': recommendations.roi }
      ];
      XLSX.utils.sheet_add_json(ws4, summaryData, { skipHeader: true, origin: -1 });
    }

    // Sheet 5: Compliance Metrics
    const complianceData = allMetroData.map(metroData => {
      const whoMin = 100; // WHO minimum
      const saTarget = 173; // SA target
      const perCapita = metroData.perCapita;

      return {
        'Metro': metroData.metro,
        'Per Capita (L/day)': perCapita,
        'WHO Min Standard (100 L)': perCapita >= whoMin ? 'COMPLIANT' : 'NON-COMPLIANT',
        'Gap to WHO Min': Math.max(0, whoMin - perCapita),
        'SA Target (173 L)': perCapita >= saTarget ? 'ACHIEVED' : 'BELOW TARGET',
        'Gap to SA Target': Math.max(0, saTarget - perCapita),
        'Wastage Benchmark (15%)': metroData.wastagePercentage <= 15 ? 'GOOD' : 'NEEDS IMPROVEMENT',
        'Excess Wastage %': Math.max(0, metroData.wastagePercentage - 15),
        'World Bank PforR Rating': metroData.wastagePercentage < 15 ? 'Excellent'
          : metroData.wastagePercentage < 20 ? 'Good'
          : metroData.wastagePercentage < 25 ? 'Fair'
          : metroData.wastagePercentage < 30 ? 'Poor' : 'Critical'
      };
    });
    const ws5 = XLSX.utils.json_to_sheet(complianceData);
    ws5['!cols'] = [
      { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 25 },
      { wch: 18 }, { wch: 28 }, { wch: 18 }, { wch: 28 }
    ];
    XLSX.utils.book_append_sheet(wb, ws5, 'Compliance Metrics');

    // Export with appropriate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = allMetroData.length === 1
      ? `${allMetroData[0].metro.replace(/\s+/g, '_')}_Complete_Water_Report_${timestamp}.xlsx`
      : `SA_Water_Monitoring_${allMetroData.length}_Metros_${timestamp}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  const hasSelection = allMetroData && allMetroData.length > 0;

  return (
    <div className="world-bank-compliance">
      <div className="export-header">
        <div className="export-info">
          <FileSpreadsheet size={28} color={hasSelection ? '#0284c7' : '#9ca3af'} />
          <div>
            <h3>Export Comprehensive Water Report</h3>
            <p>
              {hasSelection
                ? `Multi-sheet Excel report ready: Overview, ${zones && zones.length > 0 ? 'Zone Analysis, ' : ''}${historicalData && historicalData.length > 0 ? 'Historical Trends, ' : ''}${recommendations ? 'AI Recommendations, ' : ''}Compliance Metrics`
                : 'Select metros above to enable comprehensive Excel export'}
            </p>
          </div>
        </div>
        <button onClick={handleExcelExport} className="export-button" disabled={!hasSelection}>
          <Download size={18} />
          Export Complete Report
        </button>
      </div>
      {!hasSelection && (
        <div className="export-help">
          <AlertCircle size={16} />
          <span>Comprehensive Excel export with multiple sheets is available after metro selection. Please select one or more metros above.</span>
        </div>
      )}
      {hasSelection && (
        <div className="export-ready">
          <AlertCircle size={16} color="#10b981" />
          <span>Ready to export comprehensive report for {allMetroData.length} metro{allMetroData.length > 1 ? 's' : ''} ({2 + (zones && zones.length > 0 ? 1 : 0) + (historicalData && historicalData.length > 0 ? 1 : 0) + (recommendations ? 1 : 0)} sheets)</span>
        </div>
      )}
    </div>
  );
};

export default WorldBankCompliancePanel;
