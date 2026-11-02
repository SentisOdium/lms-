import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, ArrowRightLeft, EyeOff, Eye, Moon, Sun, WifiOff, LogOut, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export default function StudentHistoryModal({ isOpen, onClose, sessionId, student }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && sessionId && student) {
      loadHistory();
    }
  }, [isOpen, sessionId, student]);

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/sessions/${sessionId}/activity`, {
        params: { student_id: student.student_id }
      });
      if (res.data.success) {
        setEvents(res.data.events || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load activity history');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !student) return null;

  const getEventBadge = (type) => {
    switch (type) {
      case 'SESSION_STARTED':
        return { label: 'Session Started', icon: <CheckCircle2 size={14} />, color: '#16a34a', bg: '#dcfce7' };
      case 'TAB_SWITCHED':
        return { label: 'Tab Switched', icon: <ArrowRightLeft size={14} />, color: '#ca8a04', bg: '#fef9c3' };
      case 'TAB_RETURNED':
        return { label: 'Returned to Tab', icon: <CheckCircle2 size={14} />, color: '#2563eb', bg: '#dbeafe' };
      case 'WINDOW_UNFOCUSED':
        return { label: 'Window Unfocused', icon: <EyeOff size={14} />, color: '#ea580c', bg: '#ffedd5' };
      case 'WINDOW_FOCUSED':
        return { label: 'Window Focused', icon: <Eye size={14} />, color: '#2563eb', bg: '#dbeafe' };
      case 'IDLE_STARTED':
        return { label: 'System Idle (5m+)', icon: <Moon size={14} />, color: '#9333ea', bg: '#f3e8ff' };
      case 'IDLE_ENDED':
        return { label: 'Active Again', icon: <Sun size={14} />, color: '#16a34a', bg: '#dcfce7' };
      case 'DISCONNECTED':
        return { label: 'Connection Lost', icon: <WifiOff size={14} />, color: '#dc2626', bg: '#fee2e2' };
      case 'SESSION_LEFT':
        return { label: 'Left Session', icon: <LogOut size={14} />, color: '#475569', bg: '#f1f5f9' };
      default:
        return { label: type, icon: <Clock size={14} />, color: '#64748b', bg: '#f8fafc' };
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                {student.student_name}
              </h3>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                {student.student_id}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Total Tab Switches: <strong>{student.tab_switches || 0}</strong> · Status: <strong>{student.status?.toUpperCase()}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content list */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#64748b', fontSize: '14px' }}>
              Loading activity history...
            </div>
          ) : error ? (
            <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', fontSize: '13px' }}>
              {error}
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '13px' }}>
              No recorded events for this participant yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events.map((evt, idx) => {
                const badge = getEventBadge(evt.event_type);
                const timeStr = new Date(evt.timestamp).toLocaleTimeString([], {
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                });

                return (
                  <div
                    key={evt.event_id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: badge.bg,
                          color: badge.color,
                          alignSelf: 'flex-start'
                        }}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>

                      {(evt.target_domain || evt.tab_title) && (
                        <div style={{ fontSize: '11px', color: '#854d0e', marginLeft: '4px' }}>
                          🌐 <strong>{evt.target_domain || 'external'}</strong>
                          {evt.tab_title && <span style={{ color: '#64748b' }}> — "{evt.tab_title}"</span>}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                      {timeStr}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid #e2e8f0', marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

