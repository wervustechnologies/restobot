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
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 40 }} className="card">
      <h2 style={{ marginBottom: 10, fontSize: 24, fontWeight: 900 }}>Admin Login</h2>
      <p style={{ color: '#666', marginBottom: 30 }}>Access your restaurant dashboard</p>
      
      {error && <p style={{ color: '#FF4B4B', background: 'rgba(255,0,0,0.1)', padding: 10, borderRadius: 8, marginBottom: 20 }}>{error}</p>}
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="input-group">
          <label>Email Address</label>
          <input type="email" placeholder="owner@restaurant.com" required 
            onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" placeholder="••••••••" required 
            onChange={e => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" style={{ marginTop: 10 }}>Login</button>
      </form>
    </div>
  );
}
