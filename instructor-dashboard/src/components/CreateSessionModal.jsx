import React, { useState } from 'react';
import { X, Check, Copy, Radio, Sparkles } from 'lucide-react';
import api from '../services/api';

export default function CreateSessionModal({ isOpen, onClose, onSessionCreated }) {
  const [sessionName, setSessionName] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdSession, setCreatedSession] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!sessionName.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/sessions', {
        session_name: sessionName.trim(),
        status
      });

      if (res.data.success && res.data.session) {
        setCreatedSession(res.data.session);
        onSessionCreated(res.data.session);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (createdSession?.session_code) {
      navigator.clipboard.writeText(createdSession.session_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCreatedSession(null);
    setSessionName('');
    setCopied(false);
    setError('');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '28px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={20} color="#2563eb" />
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
              {createdSession ? 'Session Ready!' : 'Create Monitoring Session'}
            </h3>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {!createdSession ? (
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Session Name / Subject
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Programming Fundamentals - Midterm Lab"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
                Initial Status
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: `2px solid ${status === 'active' ? '#2563eb' : '#e2e8f0'}`,
                  backgroundColor: status === 'active' ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500'
                }}>
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={status === 'active'}
                    onChange={() => setStatus('active')}
                  />
                  <span>Active Now</span>
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: `2px solid ${status === 'scheduled' ? '#2563eb' : '#e2e8f0'}`,
                  backgroundColor: status === 'scheduled' ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500'
                }}>
                  <input
                    type="radio"
                    name="status"
                    value="scheduled"
                    checked={status === 'scheduled'}
                    onChange={() => setStatus('scheduled')}
                  />
                  <span>Scheduled</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: 'white',
                  fontWeight: '600',
                  fontSize: '13px',
                  color: '#475569'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !sessionName.trim()}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              display: 'inline-flex',
              padding: '8px 16px',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '16px'
            }}>
              Session Successfully Created & {createdSession.status === 'active' ? 'Active' : 'Scheduled'}
            </div>

            <h4 style={{ fontSize: '16px', color: '#1e293b', marginBottom: '8px' }}>
              {createdSession.session_name}
            </h4>

            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
              Share this unique session code with participating students:
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              background: '#f8fafc',
              border: '2px dashed #93c5fd',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '28px',
                fontWeight: '800',
                letterSpacing: '2px',
                color: '#1d4ed8'
              }}>
                {createdSession.session_code}
              </span>
              <button
                onClick={handleCopyCode}
                title="Copy Session Code"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: copied ? '#22c55e' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div style={{
              fontSize: '12px',
              color: '#64748b',
              backgroundColor: '#eff6ff',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '24px',
              textAlign: 'left',
              lineHeight: 1.4
            }}>
              <strong>Student Instructions:</strong><br />
              1. Open the SBAMS Chrome Extension.<br />
              2. Enter Student ID, Name, and code <strong>{createdSession.session_code}</strong>.<br />
              3. Click <em>Join Session</em> and select their exam/lab tab.
            </div>

            <button
              onClick={handleClose}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0f172a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Done & View Sessions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

