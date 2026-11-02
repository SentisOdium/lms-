import React, { useState, useEffect } from 'react';
import {
  Activity,
  Users,
  Eye,
  ArrowRightLeft,
  Moon,
  WifiOff,
  Radio,
  Search,
  RefreshCw,
  Clock,
  Square,
  History,
  Globe
} from 'lucide-react';
import api from '../services/api';
import { connectSocket, getSocket } from '../services/socket';
import StudentHistoryModal from '../components/StudentHistoryModal';

export default function LiveMonitoringPage({ sessions, onEndSession, refreshSessions }) {
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalStudent, setActiveModalStudent] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);

  // Auto-select first active session if none selected
  useEffect(() => {
    if (!selectedSessionId && sessions && sessions.length > 0) {
      const active = sessions.find(s => s.status === 'active') || sessions[0];
      setSelectedSessionId(active.session_id);
    }
  }, [sessions, selectedSessionId]);

  // Load participants for the selected session
  const fetchParticipants = async (sessionId) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await api.get(`/sessions/${sessionId}/participants`);
      if (res.data.success) {
        setParticipants(res.data.participants || []);
      }
    } catch (err) {
      console.error('Failed to load participants:', err);
    } finally {
      setLoading(false);
    }
  };

  // Socket.IO real-time subscription
  useEffect(() => {
    if (!selectedSessionId) return;

    fetchParticipants(selectedSessionId);

    const socket = connectSocket();

    // Join instructor room for this session
    socket.emit('instructor:join', { sessionId: selectedSessionId });

    // Handle student status update (e.g. active, away, idle, disconnected)
    const handleStudentStatus = (updatedParticipant) => {
      if (updatedParticipant.session_id === selectedSessionId) {
        setParticipants((prev) => {
          const idx = prev.findIndex(p => p.student_id === updatedParticipant.student_id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...updatedParticipant };
            return next;
          } else {
            return [updatedParticipant, ...prev];
          }
        });
      }
    };

    // Handle student event (e.g. TAB_SWITCHED, TAB_RETURNED)
    const handleStudentEvent = (event) => {
      if (event.session_id === selectedSessionId) {
        setRecentEvents((prev) => [event, ...prev.slice(0, 9)]);
      }
    };

    socket.on('student:status', handleStudentStatus);
    socket.on('student:event', handleStudentEvent);

    // Periodic sync fallback in case of network drops
    const pollTimer = setInterval(() => {
      fetchParticipants(selectedSessionId);
    }, 8000);

    return () => {
      clearInterval(pollTimer);
      socket.off('student:status', handleStudentStatus);
      socket.off('student:event', handleStudentEvent);
    };
  }, [selectedSessionId]);

  const currentSession = sessions.find(s => s.session_id === selectedSessionId);

  // Status counters
  const totalCount = participants.length;
  const activeCount = participants.filter(p => p.status === 'active').length;
  const awayCount = participants.filter(p => p.status === 'away').length;
  const idleCount = participants.filter(p => p.status === 'idle').length;
  const disconnectedCount = participants.filter(p => p.status === 'disconnected').length;

  const filteredParticipants = participants.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (p.student_id && p.student_id.toLowerCase().includes(q)) ||
      (p.student_name && p.student_name.toLowerCase().includes(q));
  });

  return (
    <div>
      {/* Top Controls & Session Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>Live Session Monitor</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            Real-time browser activity, focus tracking, and tab switches
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: 'white',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1e293b',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {sessions.map(s => (
              <option key={s.session_id} value={s.session_id}>
                {s.status === 'active' ? '🟢 ' : '⚪ '} {s.session_name} ({s.session_code})
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchParticipants(selectedSessionId)}
            className="btn"
            style={{ backgroundColor: 'white', border: '1px solid #cbd5e1', color: '#475569' }}
            title="Refresh participant list"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>

          {currentSession && currentSession.status === 'active' && (
            <button
              onClick={() => onEndSession(currentSession.session_id, currentSession.session_name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 14px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Square size={14} />
              <span>End Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time KPI Metric Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {/* Total */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
              Participants
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{totalCount}</div>
          </div>
        </div>

        {/* Active */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#16a34a' }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
              Active
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a' }}>{activeCount}</div>
          </div>
        </div>

        {/* Away */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#fef9c3', color: '#ca8a04' }}>
            <ArrowRightLeft size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
              Away (Switched)
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#ca8a04' }}>{awayCount}</div>
          </div>
        </div>

        {/* Idle */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#ffedd5', color: '#ea580c' }}>
            <Moon size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
              Idle (5m+)
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#ea580c' }}>{idleCount}</div>
          </div>
        </div>

        {/* Disconnected */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#dc2626' }}>
            <WifiOff size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
              Disconnected
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626' }}>{disconnectedCount}</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <input
            type="text"
            placeholder="Search by student ID or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 34px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
        </div>

        <div style={{ fontSize: '13px', color: '#64748b' }}>
          Showing <strong>{filteredParticipants.length}</strong> of {totalCount} students
        </div>
      </div>

      {/* Participants Grid */}
      {filteredParticipants.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
          <Radio size={40} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#334155' }}>
            {participants.length === 0 ? 'No students enrolled in this session yet' : 'No students matching search'}
          </h3>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>
            Share session code <strong style={{ fontFamily: 'monospace', color: '#2563eb' }}>{currentSession?.session_code}</strong> with your students to connect.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '16px' }}>
          {filteredParticipants.map(participant => {
            const status = (participant.status || 'active').toLowerCase();
            let statusBg = '#dcfce7';
            let statusColor = '#15803d';
            let borderColor = '#22c55e';

            if (status === 'away') {
              statusBg = '#fef9c3';
              statusColor = '#854d0e';
              borderColor = '#eab308';
            } else if (status === 'idle') {
              statusBg = '#ffedd5';
              statusColor = '#9a3412';
              borderColor = '#f97316';
            } else if (status === 'disconnected') {
              statusBg = '#fee2e2';
              statusColor = '#991b1b';
              borderColor = '#ef4444';
            } else if (status === 'left') {
              statusBg = '#f1f5f9';
              statusColor = '#475569';
              borderColor = '#94a3b8';
            }

            return (
              <div
                key={participant.participant_id || participant.student_id}
                className="card"
                style={{
                  borderLeft: `4px solid ${borderColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                        {participant.student_name}
                      </h4>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                        {participant.student_id}
                      </span>
                    </div>

                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: statusBg,
                        color: statusColor,
                        textTransform: 'uppercase'
                      }}
                    >
                      {status}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#475569',
                    marginTop: '4px'
                  }}>
                    <span>Tab Switches:</span>
                    <strong style={{ color: (participant.tab_switches || 0) > 0 ? '#b45309' : '#1e293b' }}>
                      {participant.tab_switches || 0}
                    </strong>
                  </div>

                  {status === 'away' && (participant.current_domain || participant.current_tab_title) && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#92400e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflow: 'hidden'
                    }}>
                      <Globe size={13} style={{ flexShrink: 0 }} />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={`${participant.current_domain || ''} - ${participant.current_tab_title || ''}`}>
                        <strong>{participant.current_domain || 'External site'}</strong>
                        {participant.current_tab_title && ` — "${participant.current_tab_title}"`}
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span>Last heartbeat: {participant.last_heartbeat ? new Date(participant.last_heartbeat).toLocaleTimeString() : 'N/A'}</span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveModalStudent(participant)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: 'white',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <History size={14} />
                  <span>Activity Log</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Student Activity History Modal */}
      <StudentHistoryModal
        isOpen={!!activeModalStudent}
        onClose={() => setActiveModalStudent(null)}
        sessionId={selectedSessionId}
        student={activeModalStudent}
      />
    </div>
  );
}

