import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError('');
      await login(email, password);
      navigate('/');
    } catch {
      setError('Failed to log in');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f6fa'
    }}>
      <div style={{
        background: '#fff',
        padding: '2rem 2.5rem',
        borderRadius: '12px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        minWidth: '320px'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Sign in to TexHive</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 2.5rem 0.75rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #dcdde1',
                  fontSize: '1rem'
                }}
              />
              <span style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#a5b1c2'
              }}>
                {/* email icon (simple SVG) */}
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <path d="M4 4h16v16H4V4zm8 8l8-5H4l8 5zm0 2l-8-5v10h16V9l-8 5z" fill="#a5b1c2"/>
                </svg>
              </span>
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 2.5rem 0.75rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #dcdde1',
                  fontSize: '1rem'
                }}
              />
              <span style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#a5b1c2'
              }}>
                {/* lock icon (simple SVG) */}
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <path d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-7V8a6 6 0 10-12 0v2a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2zm-8-2a4 4 0 118 0v2H6V8zm10 12H6v-8h12v8z" fill="#a5b1c2"/>
                </svg>
              </span>
            </div>
          </div>
          {error && (
            <div style={{ color: '#e84118', marginBottom: '1rem', textAlign: 'center' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#273c75',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => (e.currentTarget.style.background = '#353b48')}
            onMouseOut={e => (e.currentTarget.style.background = '#273c75')}
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}