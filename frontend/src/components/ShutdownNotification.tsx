import React, { useState } from 'react';
import { AlertTriangle, Send, CheckCircle, X } from 'lucide-react';
import { MetroWaterData } from '../constants/saMetros';
import './ShutdownNotification.css';

interface ShutdownNotificationProps {
  metroData: MetroWaterData;
}

interface NotificationHistory {
  id: string;
  timestamp: number;
  metro: string;
  reason: string;
  status: 'sent' | 'pending' | 'failed';
}

const ShutdownNotification: React.FC<ShutdownNotificationProps> = ({ metroData }) => {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [affectedAreas, setAffectedAreas] = useState('');
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistory[]>([]);
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  const handleSendNotification = async () => {
    if (!reason.trim() || !estimatedDuration.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setSending(true);

    // Simulate sending notification (in real app, this would call backend API)
    setTimeout(() => {
      const notification: NotificationHistory = {
        id: `NOTIF-${Date.now()}`,
        timestamp: Date.now(),
        metro: metroData.metro,
        reason: reason,
        status: 'sent'
      };

      setNotificationHistory([notification, ...notificationHistory]);
      setLastSent(new Date().toLocaleString());
      setSending(false);
      setShowForm(false);

      // Reset form
      setReason('');
      setUrgency('medium');
      setEstimatedDuration('');
      setAffectedAreas('');

      alert(`Shutdown notification sent to ${metroData.metro}`);
    }, 1500);
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div className="shutdown-notification">
      <div className="notification-header">
        <div className="header-info">
          <AlertTriangle size={28} color="#dc2626" />
          <div>
            <h3>Water Shutdown Notification System</h3>
            <p>Send manual shutdown notices to {metroData.metro}</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="send-notification-btn"
          >
            <Send size={18} />
            Send Shutdown Notice
          </button>
        )}
      </div>

      {lastSent && (
        <div className="last-sent-info">
          <CheckCircle size={16} color="#10b981" />
          Last notification sent: {lastSent}
        </div>
      )}

      {showForm && (
        <div className="notification-form">
          <div className="form-header">
            <h4>Create Shutdown Notification</h4>
            <button onClick={() => setShowForm(false)} className="close-btn">
              <X size={20} />
            </button>
          </div>

          <div className="form-group">
            <label>Metro Municipality</label>
            <input
              type="text"
              value={metroData.metro}
              disabled
              className="form-input disabled"
            />
          </div>

          <div className="form-group">
            <label>Urgency Level *</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as any)}
              className="form-select"
              style={{ borderColor: getUrgencyColor(urgency) }}
            >
              <option value="low">Low - Scheduled Maintenance</option>
              <option value="medium">Medium - Infrastructure Work</option>
              <option value="high">High - Emergency Repairs</option>
              <option value="critical">Critical - Immediate Shutdown Required</option>
            </select>
          </div>

          <div className="form-group">
            <label>Reason for Shutdown *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Burst pipe repair, Reservoir maintenance, Infrastructure upgrade..."
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Estimated Duration *</label>
              <input
                type="text"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder="e.g., 4 hours, 2 days"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Affected Areas</label>
              <input
                type="text"
                value={affectedAreas}
                onChange={(e) => setAffectedAreas(e.target.value)}
                placeholder="e.g., Zone A, District 3"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              onClick={() => setShowForm(false)}
              className="cancel-btn"
              disabled={sending}
            >
              Cancel
            </button>
            <button
              onClick={handleSendNotification}
              className="submit-btn"
              disabled={sending}
            >
              {sending ? 'Sending...' : 'Send Notification'}
              {!sending && <Send size={16} />}
            </button>
          </div>
        </div>
      )}

      {notificationHistory.length > 0 && (
        <div className="notification-history">
          <h4>Recent Notifications</h4>
          <div className="history-list">
            {notificationHistory.slice(0, 5).map((notif) => (
              <div key={notif.id} className="history-item">
                <div className="history-content">
                  <div className="history-header">
                    <span className="history-id">{notif.id}</span>
                    <span className={`history-status status-${notif.status}`}>
                      {notif.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="history-metro">{notif.metro}</p>
                  <p className="history-reason">{notif.reason}</p>
                  <p className="history-time">
                    {new Date(notif.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="notification-info">
        <h4>📋 Notification Recipients</h4>
        <ul>
          <li>Municipal Water Department - {metroData.metro}</li>
          <li>Operations Manager - Emergency Contact</li>
          <li>Field Technicians - On-duty Team</li>
          <li>Public Communication Office</li>
        </ul>
      </div>
    </div>
  );
};

export default ShutdownNotification;
