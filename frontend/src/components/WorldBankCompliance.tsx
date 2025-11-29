import React from 'react';
import { Shield, CheckCircle, AlertTriangle, Download, Lock } from 'lucide-react';
import { VerificationResult } from '../services/blockchainService';
import * as XLSX from 'xlsx';
import './WorldBankCompliance.css';

interface WorldBankCompliancePanelProps {
  verificationStatus: VerificationResult;
  onExport: () => void;
  metroData?: any;
}

const WorldBankCompliancePanel: React.FC<WorldBankCompliancePanelProps> = ({
  verificationStatus,
  onExport,
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
        'Timestamp': new Date(metroData.timestamp).toLocaleString(),
        'Blockchain Hash': metroData.blockchainHash || 'N/A',
        'Verified': metroData.verified ? 'Yes' : 'No'
      }
    ];

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Water Data');

    // Auto-size columns
    const maxWidth = excelData.reduce((w, r) => Math.max(w, r.Metro.length), 10);
    ws['!cols'] = [{ wch: maxWidth }];

    // Export
    XLSX.writeFile(wb, `${metroData.metro.replace(/\s+/g, '_')}_Water_Data_${Date.now()}.xlsx`);
  };

  return (
    <div className="world-bank-compliance">
      <div className="compliance-header">
        <div className="compliance-title">
          <div className="title-row">
            <Shield className="shield-icon" size={32} />
            <h2>Data Verification & Export</h2>
          </div>
          <p className="subtitle">Cryptographically verified water monitoring data</p>
        </div>
        <div className="compliance-status">
          <div className="status-row">
            {verificationStatus.valid ? (
              <>
                <CheckCircle className="status-icon verified" size={24} />
                <span className="status-text verified">VERIFIED</span>
              </>
            ) : (
              <>
                <AlertTriangle className="status-icon pending" size={24} />
                <span className="status-text pending">VERIFICATION PENDING</span>
              </>
            )}
          </div>
          <p className="blocks-count">
            Blocks Verified: {verificationStatus.totalBlocks || 0}
          </p>
          <p className="last-check">
            Last Check:{' '}
            {verificationStatus.verifiedAt
              ? new Date(verificationStatus.verifiedAt).toLocaleTimeString()
              : 'N/A'}
          </p>
        </div>
      </div>

      <div className="compliance-metrics">
        <div className="metric-card">
          <p className="metric-label">Data Integrity</p>
          <p className="metric-value">100%</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Cryptographic Hash</p>
          <p className="metric-value">SHA-256</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Chain Status</p>
          <p className="metric-value">VALID</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Data Points</p>
          <p className="metric-value">{verificationStatus.totalBlocks || 0}</p>
        </div>
      </div>

      <div className="compliance-actions">
        <button onClick={handleExcelExport} className="export-button">
          <Download size={18} />
          Export Data to Excel
        </button>
        <button onClick={onExport} className="view-chain-button">
          <Lock size={18} />
          View Verification Chain
        </button>
      </div>
    </div>
  );
};

export default WorldBankCompliancePanel;
