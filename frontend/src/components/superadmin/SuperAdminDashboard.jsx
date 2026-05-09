import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../apiConfig';

export default function SuperAdminDashboard() {
  const [formData, setFormData] = useState({
    restaurant_name: '',
    owner_name: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  // Auth guard — redirect to login if no token
  useEffect(() => {
    if (!localStorage.getItem('superadmin_token')) {
      navigate('/superadmin/login');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('superadmin_token');
    navigate('/superadmin/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('superadmin_token');
    const res = await fetch(`${API_BASE_URL}/superadmin/create-restaurant`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (res.ok) {
      setMsg('✅ Restaurant Admin created successfully!');
      setFormData({ restaurant_name: '', owner_name: '', email: '', password: '' });
    } else {
      setMsg(`❌ Error: ${data.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: '#FF6B35' }}>RESTO<span style={{ color: '#1A1A1A' }}>BOT</span></h1>
          <p style={{ color: '#888', marginTop: 4 }}>Super Admin Panel</p>
        </div>
        <button onClick={handleLogout} className="btn-outline" style={{ fontSize: 13 }}>Logout</button>
      </div>

      <div className="card" style={{ padding: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 30 }}>Add New Restaurant Partner</h2>
        {msg && <div style={{ padding: 15, borderRadius: 8, background: msg.includes('✅') ? 'rgba(29,185,84,0.1)' : 'rgba(255,0,0,0.1)', color: msg.includes('✅') ? '#1DB954' : '#FF4B4B', marginBottom: 20 }}>{msg}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="input-group">
            <label>Restaurant Name</label>
            <input value={formData.restaurant_name} onChange={e => setFormData({...formData, restaurant_name: e.target.value})} required />
          </div>
          <div className="input-group">
            <label>Owner Name</label>
            <input value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} required />
          </div>
          <div className="input-group">
            <label>Login Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          </div>
          <div className="input-group">
            <label>Initial Password</label>
            <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
          </div>
          <button type="submit" className="btn-primary" style={{ gridColumn: 'span 2', marginTop: 10 }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Restaurant & Admin Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
