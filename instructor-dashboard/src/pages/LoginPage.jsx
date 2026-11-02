import React, { useState } from 'react';
import { Radio, Lock, Mail, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function LoginPage({ onLoginSuccess, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success && res.data.token) {
        localStorage.setItem('sbams_instructor_token', res.data.token);
        localStorage.setItem('sbams_instructor_user', JSON.stringify(res.data.instructor));
        onLoginSuccess(res.data.instructor);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f1f5f9',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '36px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            marginBottom: '12px'
          }}>
            <Radio size={28} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>Instructor Login</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            Sign in to manage and monitor student sessions
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '18px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="instructor@school.edu"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '11px' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '11px' }} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px',
              backgroundColor: '#2563eb',
              color: 'white',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px',
              fontSize: '14px'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#64748b' }}>
          Don't have an instructor account?{' '}
          <button
            onClick={onSwitchToRegister}
            style={{ color: '#2563eb', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Register here
          </button>
        </div>
      </div>
    </div>
  );
}

