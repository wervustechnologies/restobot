import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../apiConfig';

export default function WaiterLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/waiter-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('waiter_token', data.token);
        localStorage.setItem('waiter_user', JSON.stringify(data.user));
        localStorage.setItem('waiter_rid', data.restaurant_id);
        navigate('/waiter/home');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F5', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 50, marginBottom: 15 }}>🍽️</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A1A', letterSpacing: '-1px' }}>
            RESTO<span style={{ color: '#FF6B35' }}>BOT</span>
          </h1>
          <p style={{ color: '#888', fontSize: 14, fontWeight: 600, marginTop: 8 }}>Waiter Portal</p>
        </div>

        <div className="card" style={{ padding: 35, borderRadius: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 25, textAlign: 'center' }}>Sign In</h2>

          {error && (
            <div style={{ background: '#FFF5F5', color: '#E53935', padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#666', marginBottom: 8 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{ width: '100%', padding: '14px 16px', border: '2px solid #EEE', borderRadius: 12, fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 30 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#666', marginBottom: 8 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{ width: '100%', padding: '14px 16px', border: '2px solid #EEE', borderRadius: 12, fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '16px', background: '#FF6B35', color: '#FFF',
                border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 900, cursor: 'pointer',
                opacity: loading ? 0.7 : 1, transition: 'all 0.2s'
              }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: '#888', fontSize: 13, fontWeight: 600 }}>
          Are you an admin? <a href="/admin/login" style={{ color: '#FF6B35', fontWeight: 700, textDecoration: 'none' }}>Admin Login</a>
        </p>
      </div>
    </div>
  );
}
