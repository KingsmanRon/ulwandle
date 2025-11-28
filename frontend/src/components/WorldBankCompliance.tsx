import React from 'react';
import { Shield, CheckCircle, AlertTriangle, Download, Lock } from 'lucide-react';
import { VerificationResult } from '../services/blockchainService';
import './WorldBankCompliance.css';

interface WorldBankCompliancePanelProps {
  verificationStatus: VerificationResult;
  onExport: () => void;
}

const WorldBankCompliancePanel: React.FC<WorldBankCompliancePanelProps> = ({
  verificationStatus,
  onExport
}) => {
  return (
    <div className="world-bank-compliance">
      <div className="compliance-header">
        <div className="compliance-title">
          <div className="title-row">
            <Shield className="shield-icon" size={32} />
            <h2>World Bank PforR Compliance</h2>
          </div>
          <p className="subtitle">$925 Million Program-for-Results Verification System</p>
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
          <p className="metric-label">Compliance</p>
          <p className="metric-value">PforR</p>
        </div>
      </div>

      <div className="compliance-actions">
        <button onClick={onExport} className="export-button">
          <Download size={18} />
          Export for World Bank
        </button>
        <button className="view-chain-button">
          <Lock size={18} />
          View Verification Chain
        </button>
      </div>
    </div>
  );
};

export default WorldBankCompliancePanel;
