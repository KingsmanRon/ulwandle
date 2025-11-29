import React from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import './WorldBankCompliance.css';

interface WorldBankCompliancePanelProps {
  metroData?: any;
}

const WorldBankCompliancePanel: React.FC<WorldBankCompliancePanelProps> = ({
  metroData
}) => {

  const handleExcelExport = () => {
    if (!metroData) {
      alert('Please select a metro first');
      return;
    }

    // Prepare data for Excel
    const excelData = [
      {
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
      }
    ];

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

    // Export
    XLSX.writeFile(wb, `${metroData.metro.replace(/\s+/g, '_')}_Water_Data_${Date.now()}.xlsx`);
  };

  return (
    <div className="world-bank-compliance">
      <div className="export-header">
        <div className="export-info">
          <FileSpreadsheet size={28} />
          <div>
            <h3>Export Water Monitoring Data</h3>
            <p>Download current metro data to Excel for analysis and reporting</p>
          </div>
        </div>
        <button onClick={handleExcelExport} className="export-button" disabled={!metroData}>
          <Download size={18} />
          Export to Excel
        </button>
      </div>
    </div>
  );
};

export default WorldBankCompliancePanel;
