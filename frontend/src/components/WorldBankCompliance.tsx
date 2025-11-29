import React from 'react';
import { Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { MetroWaterData } from '../constants/saMetros';
import './WorldBankCompliance.css';

interface WorldBankCompliancePanelProps {
  allMetroData: MetroWaterData[];
}

const WorldBankCompliancePanel: React.FC<WorldBankCompliancePanelProps> = ({
  allMetroData
}) => {

  const handleExcelExport = () => {
    if (!allMetroData || allMetroData.length === 0) {
      alert('Please select at least one metro first');
      return;
    }

    // Prepare data for Excel - all selected metros
    const excelData = allMetroData.map(metroData => ({
      'Metro': metroData.metro,
      'Province': metroData.province,
      'Population': metroData.population,
      'Daily Intake (ML)': metroData.intake,
      'Actual Usage (ML)': metroData.usage,
      'Wastage (ML)': metroData.wastage,
      'Wastage %': metroData.wastagePercentage,
      'Per Capita (L/day)': metroData.perCapita,
      'Water Stress Level': metroData.stressLevel,
      'Timestamp': new Date(metroData.timestamp).toLocaleString()
    }));

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Water Data');

    // Auto-size columns
    const colWidths = [
      { wch: 30 }, // Metro
      { wch: 15 }, // Province
      { wch: 12 }, // Population
      { wch: 18 }, // Daily Intake
      { wch: 18 }, // Actual Usage
      { wch: 15 }, // Wastage
      { wch: 12 }, // Wastage %
      { wch: 18 }, // Per Capita
      { wch: 20 }, // Water Stress
      { wch: 20 }  // Timestamp
    ];
    ws['!cols'] = colWidths;

    // Export with appropriate filename
    const filename = allMetroData.length === 1
      ? `${allMetroData[0].metro.replace(/\s+/g, '_')}_Water_Data_${Date.now()}.xlsx`
      : `SA_Metros_Water_Data_${allMetroData.length}_Metros_${Date.now()}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  const hasSelection = allMetroData && allMetroData.length > 0;

  return (
    <div className="world-bank-compliance">
      <div className="export-header">
        <div className="export-info">
          <FileSpreadsheet size={28} color={hasSelection ? '#0284c7' : '#9ca3af'} />
          <div>
            <h3>Export Water Monitoring Data</h3>
            <p>
              {hasSelection
                ? `${allMetroData.length} metro${allMetroData.length > 1 ? 's' : ''} selected - Download to Excel for analysis and reporting`
                : 'Select metros above to enable Excel export'}
            </p>
          </div>
        </div>
        <button onClick={handleExcelExport} className="export-button" disabled={!hasSelection}>
          <Download size={18} />
          Export to Excel
        </button>
      </div>
      {!hasSelection && (
        <div className="export-help">
          <AlertCircle size={16} />
          <span>Excel export is only available after metro selection. Please select one or more metros above.</span>
        </div>
      )}
      {hasSelection && (
        <div className="export-ready">
          <AlertCircle size={16} color="#10b981" />
          <span>Ready to export {allMetroData.length} metro{allMetroData.length > 1 ? 's' : ''} to Excel</span>
        </div>
      )}
    </div>
  );
};

export default WorldBankCompliancePanel;
