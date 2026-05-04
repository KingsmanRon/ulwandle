import React, { useState } from 'react';
import { AlertTriangle, Send, CheckCircle, X, Info } from 'lucide-react';
import { MetroWaterData } from '../constants/metros';
import { useAuth } from '../auth/AuthContext';
import './ShutdownNotification.css';

interface ShutdownNotificationProps {
  metroData: MetroWaterData;
}

interface NotificationDraft {
  id: string;
  timestamp: number;
  metro: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: string;
  affectedAreas: string;
  status: 'draft' | 'queued';
  preparedBy: string;
}

// Roles allowed to mark a notification draft as queued for outgoing
// communications. The actual outgoing channel (SMS / email / municipal
// portal) is not wired in this component — see PR follow-up for the
// backend notifications endpoint.
const SEND_ALLOWED_ROLES = new Set(['admin', 'supervisor']);

const URGENCY_COLOURS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#f59e0b',
  low: '#10b981',
};

const ShutdownNotification: React.FC<ShutdownNotificationProps> = ({ metroData }) => {
  const { user } = useAuth();
  const canQueue = !!user && SEND_ALLOWED_ROLES.has(user.role);

  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<NotificationDraft['urgency']>('medium');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [affectedAreas, setAffectedAreas] = useState('');
  const [drafts, setDrafts] = useState<NotificationDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastQueuedAt, setLastQueuedAt] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setReason('');
    setUrgency('medium');
    setEstimatedDuration('');
    setAffectedAreas('');
    setFormError(null);
  };

  const handleQueueDraft = async () => {
    if (!user) return;
    if (!reason.trim() || !estimatedDuration.trim()) {
      setFormError('Reason and estimated duration are required.');
      return;
    }
    setFormError(null);
    setSubmitting(true);

    // Local-only persistence for now. The component is informational —
    // it composes a notification draft that an operator can later send
    // via the municipality's outbound comms channel. Wiring this to a
    // backend "notifications" endpoint is a follow-up: the audit trail
    // will live in the existing AuditLog table.
    const draft: NotificationDraft = {
      id: `NOTIF-${Date.now()}`,
      timestamp: Date.now(),
      metro: metroData.metro,
      reason: reason.trim(),
      urgency,
      estimatedDuration: estimatedDuration.trim(),
      affectedAreas: affectedAreas.trim(),
      status: 'queued',
      preparedBy: user.full_name,
    };
    setDrafts(prev => [draft, ...prev]);
    setLastQueuedAt(new Date().toLocaleString());
    setSubmitting(false);
    setShowForm(false);
    resetForm();
  };

  return (
    <div className="shutdown-notification">
      <div className="notification-header">
        <div className="header-info">
          <AlertTriangle size={28} color="#dc2626" />
          <div>
            <h3>Customer shutdown notice</h3>
            <p>Compose an outbound notification draft for {metroData.metro}.</p>
          </div>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="send-notification-btn"
            disabled={!canQueue}
            title={canQueue ? '' : 'Requires supervisor or admin role'}
          >
            <Send size={18} />
            New notice
          </button>
        )}
      </div>

      <div className="notification-info" style={{ marginTop: '0.75rem' }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569' }}>
          <Info size={16} />
          <span>
            This panel composes a customer / staff notification only. Physical valve
            operations are not triggered here — use the Kill Switch tab, which requires
            two-person authorisation.
          </span>
        </p>
      </div>

      {lastQueuedAt && (
        <div className="last-sent-info">
          <CheckCircle size={16} color="#10b981" />
          Last draft queued: {lastQueuedAt}
        </div>
      )}

      {showForm && (
        <div className="notification-form">
          <div className="form-header">
            <h4>Compose shutdown notice</h4>
            <button type="button" onClick={() => setShowForm(false)} className="close-btn" aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <div className="form-group">
            <label>Metro municipality</label>
            <input type="text" value={metroData.metro} disabled className="form-input disabled" />
          </div>

          <div className="form-group">
            <label htmlFor="urgency">Urgency level *</label>
            <select
              id="urgency"
              value={urgency}
              onChange={e => setUrgency(e.target.value as NotificationDraft['urgency'])}
              className="form-select"
              style={{ borderColor: URGENCY_COLOURS[urgency] }}
            >
              <option value="low">Low &mdash; scheduled maintenance</option>
              <option value="medium">Medium &mdash; infrastructure work</option>
              <option value="high">High &mdash; emergency repairs</option>
              <option value="critical">Critical &mdash; immediate shutdown required</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="reason">Reason for shutdown *</label>
            <textarea
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. burst pipe repair, reservoir maintenance, infrastructure upgrade…"
              className="form-textarea"
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="duration">Estimated duration *</label>
              <input
                id="duration"
                type="text"
                value={estimatedDuration}
                onChange={e => setEstimatedDuration(e.target.value)}
                placeholder="e.g. 4 hours, 2 days"
                className="form-input"
                maxLength={120}
              />
            </div>

            <div className="form-group">
              <label htmlFor="areas">Affected areas</label>
              <input
                id="areas"
                type="text"
                value={affectedAreas}
                onChange={e => setAffectedAreas(e.target.value)}
                placeholder="e.g. Zone A, District 3"
                className="form-input"
                maxLength={300}
              />
            </div>
          </div>

          {formError && (
            <div role="alert" className="error">
              {formError}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="cancel-btn"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleQueueDraft}
              className="submit-btn"
              disabled={submitting || !canQueue}
            >
              {submitting ? 'Queuing…' : 'Queue draft'}
              {!submitting && <Send size={16} />}
            </button>
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="notification-history">
          <h4>Recent drafts (this session)</h4>
          <div className="history-list">
            {drafts.slice(0, 5).map(d => (
              <div key={d.id} className="history-item">
                <div className="history-content">
                  <div className="history-header">
                    <span className="history-id">{d.id}</span>
                    <span className={`history-status status-${d.status}`}>
                      {d.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="history-metro">{d.metro}</p>
                  <p className="history-reason">{d.reason}</p>
                  <p className="history-time">
                    {new Date(d.timestamp).toLocaleString()} &middot; prepared by {d.preparedBy}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="notification-info">
        <h4>Intended recipients</h4>
        <ul>
          <li>Municipal water department &mdash; {metroData.metro}</li>
          <li>Operations manager &mdash; emergency contact</li>
          <li>Field technicians &mdash; on-duty team</li>
          <li>Public communications office</li>
        </ul>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Drafts queued here are stored in this browser session only. A
          backend &ldquo;notifications&rdquo; endpoint that fans out to the
          channels above will be added in a follow-up PR.
        </p>
      </div>
    </div>
  );
};

export default ShutdownNotification;
