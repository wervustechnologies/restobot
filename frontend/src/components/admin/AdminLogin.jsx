import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
        navigate('/admin');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Login failed');
    }
  };

  return (
    <div className="admin-login-page">
      <style>{`
        .admin-login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg, #F5F5F5);
          padding: 20px;
        }
        .admin-login-page .al-card {
          width: 100%;
          max-width: 400px;
          padding: 35px 32px;
          border-radius: 24px;
          background: var(--card-bg, rgba(255,255,255,0.7));
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--card-border, rgba(255,255,255,0.4));
          box-shadow: 0 8px 32px var(--card-shadow, rgba(255,107,53,0.06));
        }
        .admin-login-page .al-title {
          font-size: 24px;
          font-weight: 900;
          color: var(--text, #1A1A1A);
          margin-bottom: 8px;
          text-align: center;
        }
        .admin-login-page .al-subtitle {
          color: var(--text-muted, #666);
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 28px;
          text-align: center;
        }
        .admin-login-page .al-error {
          color: #E53935;
          background: #FFF5F5;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 20px;
          font-size: 13px;
          font-weight: 600;
        }
        .admin-login-page .al-field { margin-bottom: 20px; }
        .admin-login-page .al-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-muted, #666);
          margin-bottom: 8px;
        }
        .admin-login-page .al-input {
          width: 100%;
          padding: 14px 16px;
          border: 2px solid var(--border, #EEE);
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          color: var(--text, #1A1A1A);
          background: var(--input-bg, #F5F5F5);
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .admin-login-page .al-input:focus {
          border-color: #FF6B35;
          box-shadow: 0 0 0 4px rgba(255,107,53,0.1);
        }
        .admin-login-page .al-submit {
          width: 100%;
          padding: 16px;
          background: #FF6B35;
          color: #FFF;
          border: none;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          margin-top: 10px;
          transition: all 0.2s;
        }
        .admin-login-page .al-submit:hover { background: #E85A20; }
        .admin-login-page .al-footer {
          text-align: center;
          margin-top: 20px;
          color: var(--text-muted, #888);
          font-size: 13px;
          font-weight: 600;
        }
        .admin-login-page .al-footer a {
          color: #FF6B35;
          font-weight: 700;
          text-decoration: none;
        }
        @media (max-width: 440px) {
          .admin-login-page { padding: 16px; }
          .admin-login-page .al-card { padding: 28px 20px; }
        }
        @media (max-width: 360px) {
          .admin-login-page .al-card { padding: 24px 16px; border-radius: 20px; }
          .admin-login-page .al-title { font-size: 22px; }
        }
      `}</style>
      <div className="al-card">
        <h2 className="al-title">Admin Login</h2>
        <p className="al-subtitle">Access your restaurant dashboard</p>
        
        {error && <div className="al-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="al-field">
            <label className="al-label">Email Address</label>
            <input className="al-input" type="email" placeholder="owner@restaurant.com" required 
              onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="al-field">
            <label className="al-label">Password</label>
            <input className="al-input" type="password" placeholder="••••••••" required 
              onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="al-submit">Login</button>
        </form>
        <p className="al-footer">
          Are you a waiter? <a href="/waiter/login">Waiter Login</a>
        </p>
      </div>
    </div>
  );
}
