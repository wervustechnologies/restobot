import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../apiConfig';
import Swal from 'sweetalert2';

export default function SuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/superadmin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('superadmin_token', data.token);
        navigate('/superadmin/dashboard');
      } else {
        Swal.fire({ icon: 'error', title: 'Authentication Failed', text: data.message || 'Invalid credentials' });
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Connection Error', text: 'Cannot reach the server. Is the backend running?' });
    }
    setLoading(false);
  };

  const isEmailValid = email === 'sanalshijilkk52@gmail.com';

  return (
    <div className="admin-login-page" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 40, background: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(20px)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 10, color: '#FF6B35' }}>Super Admin</h1>
        <p style={{ color: '#888', marginBottom: 30 }}>Internal Access Only</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="input-group">
            <label>System Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={{ border: email && !isEmailValid ? '1px solid #FF4B4B' : '1px solid #333' }}
            />
            {email && !isEmailValid && <small style={{ color: '#FF4B4B', fontSize: 10 }}>Unauthorized Email</small>}
          </div>
          <div className="input-group">
            <label>Security Key</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading || !isEmailValid}>
            {loading ? 'Authenticating...' : 'Access System'}
          </button>
        </form>
      </div>
    </div>
  );
}
