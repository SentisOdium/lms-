import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity,
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  Radio,
  Plus,
  Copy,
  Check,
  Play,
  Square,
  Clock,
  LogOut,
  RefreshCw,
  Eye
} from 'lucide-react';
import api from './services/api';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LiveMonitoringPage from './pages/LiveMonitoringPage';
import ReportsPage from './pages/ReportsPage';
import CreateSessionModal from './components/CreateSessionModal';

function DashboardContent({
  currentUser,
  sessions,
  loadingSessions,
  fetchSessions,
  handleLogout,
  handleStartSession,
  handleEndSession,
  handleCopyCode,
  copiedCode,
  setIsModalOpen
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const activeSessions = sessions.filter(s => s.status === 'active');
  const pastSessions = sessions.filter(s => s.status !== 'active');

  return (
    <div className="dashboard-layout">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-title">
          <Radio color="#38bdf8" size={24} />
          <span>SBAMS Monitor</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/live"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Activity size={18} />
            <span>Live Monitoring</span>
          </NavLink>
          <NavLink
            to="/reports"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <FileText size={18} />
            <span>CSV Reports</span>
          </NavLink>
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid #334155', paddingTop: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>
            {currentUser.name}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
            {currentUser.email}
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #475569',
              backgroundColor: 'transparent',
              color: '#cbd5e1',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Routes>
          {/* Live Monitoring Route */}
          <Route
            path="/live"
            element={
              <LiveMonitoringPage
                sessions={sessions}
                onEndSession={handleEndSession}
                refreshSessions={fetchSessions}
              />
            }
          />

          {/* CSV Reports Route */}
          <Route
            path="/reports"
            element={
              <ReportsPage
                sessions={sessions}
                fetchSessions={fetchSessions}
              />
            }
          />

          {/* Default Sessions Dashboard */}
          <Route
            path="/"
            element={
              <div>
                <div className="top-bar">
                  <div>
                    <h1 className="page-title">Monitoring Sessions</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                      Create unique session codes and monitor participating students in real time.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn"
                      onClick={fetchSessions}
                      title="Refresh sessions"
                      style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569' }}
                    >
                      <RefreshCw size={16} className={loadingSessions ? 'spin' : ''} />
                    </button>
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                      <Plus size={16} />
                      <span>Create Session</span>
                    </button>
                  </div>
                </div>

                {/* Active Sessions Section */}
                <div style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
                    <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      Active Sessions ({activeSessions.length})
                    </h2>
                  </div>

                  {activeSessions.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      <Radio size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                      <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#334155' }}>No active monitoring sessions</h3>
                      <p style={{ fontSize: '13px', marginTop: '4px', marginBottom: '16px' }}>
                        Click "Create Session" above to start a session and generate a student code.
                      </p>
                      <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ margin: '0 auto' }}>
                        <Plus size={16} />
                        <span>Start New Session</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                      {activeSessions.map(session => (
                        <div key={session.session_id} className="card" style={{ borderLeft: '4px solid #22c55e' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div>
                              <span style={{
                                display: 'inline-block',
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                                marginBottom: '6px'
                              }}>
                                ACTIVE
                              </span>
                              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                                {session.session_name}
                              </h3>
                            </div>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Session Code Highlight Box */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#f8fafc',
                            border: '1px dashed #93c5fd',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            marginBottom: '14px'
                          }}>
                            <div>
                              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                                Student Join Code
                              </div>
                              <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: '800', color: '#1d4ed8', letterSpacing: '1px' }}>
                                {session.session_code}
                              </div>
                            </div>
                            <button
                              onClick={() => handleCopyCode(session.session_code)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 10px',
                                fontSize: '12px',
                                fontWeight: '600',
                                backgroundColor: copiedCode === session.session_code ? '#22c55e' : '#e0e7ff',
                                color: copiedCode === session.session_code ? 'white' : '#3730a3',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              {copiedCode === session.session_code ? <Check size={14} /> : <Copy size={14} />}
                              {copiedCode === session.session_code ? 'Copied' : 'Copy'}
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f1f5f9', gap: '8px' }}>
                            <button
                              onClick={() => navigate('/live')}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              <Eye size={13} />
                              <span>Live Monitor ({session.participant_count || 0})</span>
                            </button>

                            <button
                              onClick={() => handleEndSession(session.session_id, session.session_name)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              <Square size={13} />
                              <span>End</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Past / Scheduled Sessions Section */}
                {pastSessions.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#475569', marginBottom: '14px' }}>
                      Completed & Scheduled Sessions ({pastSessions.length})
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                      {pastSessions.map(session => (
                        <div key={session.session_id} className="card" style={{ opacity: session.status === 'ended' ? 0.85 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div>
                              <span style={{
                                display: 'inline-block',
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                backgroundColor: session.status === 'scheduled' ? '#dbeafe' : '#f1f5f9',
                                color: session.status === 'scheduled' ? '#1e40af' : '#64748b',
                                marginBottom: '4px'
                              }}>
                                {session.status.toUpperCase()}
                              </span>
                              <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>
                                {session.session_name}
                              </h4>
                            </div>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {new Date(session.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                            Code: <strong style={{ fontFamily: 'monospace', color: '#334155' }}>{session.session_code}</strong>
                            {' · '}
                            Participants: <strong>{session.participant_count || 0}</strong>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => navigate('/live')}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                flex: 1,
                                padding: '6px 10px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#475569',
                                cursor: 'pointer'
                              }}
                            >
                              <Eye size={13} />
                              <span>View Records</span>
                            </button>

                            {session.status === 'scheduled' && (
                              <button
                                onClick={() => handleStartSession(session.session_id)}
                                className="btn btn-primary"
                                style={{ flex: 1, fontSize: '12px', padding: '6px' }}
                              >
                                <Play size={13} />
                                <span>Start</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('sbams_instructor_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Load instructor sessions when logged in
  const fetchSessions = async () => {
    if (!currentUser) return;
    setLoadingSessions(true);
    try {
      const res = await api.get('/sessions');
      if (res.data.success) {
        setSessions(res.data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchSessions();
    }
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('sbams_instructor_token');
    localStorage.removeItem('sbams_instructor_user');
    setCurrentUser(null);
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleStartSession = async (sessionId) => {
    try {
      await api.post(`/sessions/${sessionId}/start`);
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start session');
    }
  };

  const handleEndSession = async (sessionId, name) => {
    if (!window.confirm(`Are you sure you want to end session "${name}"? Active student monitoring will terminate.`)) {
      return;
    }
    try {
      await api.post(`/sessions/${sessionId}/end`);
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to end session');
    }
  };

  if (!currentUser) {
    if (authView === 'register') {
      return (
        <RegisterPage
          onRegisterSuccess={(user) => setCurrentUser(user)}
          onSwitchToLogin={() => setAuthView('login')}
        />
      );
    }
    return (
      <LoginPage
        onLoginSuccess={(user) => setCurrentUser(user)}
        onSwitchToRegister={() => setAuthView('register')}
      />
    );
  }

  return (
    <BrowserRouter>
      <DashboardContent
        currentUser={currentUser}
        sessions={sessions}
        loadingSessions={loadingSessions}
        fetchSessions={fetchSessions}
        handleLogout={handleLogout}
        handleStartSession={handleStartSession}
        handleEndSession={handleEndSession}
        handleCopyCode={handleCopyCode}
        copiedCode={copiedCode}
        setIsModalOpen={setIsModalOpen}
      />

      <CreateSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSessionCreated={() => {
          fetchSessions();
        }}
      />
    </BrowserRouter>
  );
}

export default App;
