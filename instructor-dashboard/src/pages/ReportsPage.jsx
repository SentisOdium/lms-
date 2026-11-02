import React, { useState } from 'react';
import { FileText, Download, Clock, Users, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';

export default function ReportsPage({ sessions, fetchSessions }) {
  const [downloading, setDownloading] = useState({});
  const [error, setError] = useState('');

  const handleDownloadCsv = async (sessionId, type) => {
    const downloadKey = `${sessionId}_${type}`;
    setDownloading(prev => ({ ...prev, [downloadKey]: true }));
    setError('');

    try {
      const response = await api.get(`/sessions/${sessionId}/export`, {
        params: { type },
        responseType: 'blob'
      });

      // Extract filename from header or fallback
      let filename = type === 'detailed'
        ? `session_activity_${sessionId}.csv`
        : `session_summary_${sessionId}.csv`;

      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      // Trigger browser download via Blob URL
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV download error:', err);
      setError('Failed to download CSV report. Please try again.');
    } finally {
      setDownloading(prev => ({ ...prev, [downloadKey]: false }));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>CSV Reports & Exports</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
          Download spreadsheet-ready activity records and session summaries for documentation and analysis.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* CSV Spec Info Box */}
      <div className="card" style={{ marginBottom: '24px', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <FileSpreadsheet size={20} color="#2563eb" />
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
            Report Specifications & Column Reference
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', color: '#475569' }}>
          <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
              📊 Session Summary CSV
            </strong>
            <code>student_id, session_id, session_duration_seconds, active_seconds, away_seconds, idle_seconds, tab_switches, connection_status</code>
            <p style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
              High-level overview aggregating exact seconds on task, time switched away, time idle, and total tab switches.
            </p>
          </div>

          <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
              📋 Detailed Activity CSV
            </strong>
            <code>event_id, student_id, session_id, event_type, timestamp</code>
            <p style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
              Chronological audit log tracking every single event (SESSION_STARTED, TAB_SWITCHED, TAB_RETURNED, IDLE, etc.).
            </p>
          </div>
        </div>
      </div>

      {/* Sessions Export Table / Cards */}
      <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
        Available Sessions ({sessions.length})
      </h2>

      {sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
          <FileText size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#334155' }}>No sessions found</h3>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Create and run a monitoring session to generate downloadable CSV reports.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sessions.map(session => (
            <div
              key={session.session_id}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: session.status === 'active' ? '#dcfce7' : '#f1f5f9',
                    color: session.status === 'active' ? '#15803d' : '#64748b'
                  }}>
                    {session.status.toUpperCase()}
                  </span>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    {session.session_name}
                  </h3>
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '12px' }}>
                  <span>Code: <strong style={{ fontFamily: 'monospace' }}>{session.session_code}</strong></span>
                  <span>Participants: <strong>{session.participant_count || 0}</strong></span>
                  <span>Date: {new Date(session.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleDownloadCsv(session.session_id, 'summary')}
                  disabled={downloading[`${session.session_id}_summary`]}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: downloading[`${session.session_id}_summary`] ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Download size={14} />
                  <span>
                    {downloading[`${session.session_id}_summary`] ? 'Generating...' : 'Summary CSV'}
                  </span>
                </button>

                <button
                  onClick={() => handleDownloadCsv(session.session_id, 'detailed')}
                  disabled={downloading[`${session.session_id}_detailed`]}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: downloading[`${session.session_id}_detailed`] ? 'not-allowed' : 'pointer'
                  }}
                >
                  <FileText size={14} />
                  <span>
                    {downloading[`${session.session_id}_detailed`] ? 'Generating...' : 'Detailed Activity CSV'}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

