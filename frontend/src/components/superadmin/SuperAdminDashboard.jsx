import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../apiConfig';
import Swal from 'sweetalert2';

export default function SuperAdminDashboard() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    restaurant_name: '', owner_name: '', email: '', password: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('superadmin_token');

  useEffect(() => {
    if (!token) navigate('/superadmin/login');
    else fetchRestaurants();
  }, []);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/superadmin/restaurants`, { headers: authHeaders() });
      if (res.status === 401) { navigate('/superadmin/login'); return; }
      const data = await res.json();
      setRestaurants(data);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load restaurants' });
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ restaurant_name: '', owner_name: '', email: '', password: '' });
    setEditing(null);
    setShowForm(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setFormData({
      restaurant_name: r.name,
      owner_name: r.admin?.name || '',
      email: r.admin?.email || '',
      password: ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        const body = { ...formData };
        if (!body.password) delete body.password;
        const res = await fetch(`${API_BASE_URL}/superadmin/restaurant/${editing.rid}`, {
          method: 'PUT', headers: authHeaders(), body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
          Swal.fire({ icon: 'success', title: 'Updated', text: data.message });
          resetForm();
          fetchRestaurants();
        } else {
          Swal.fire({ icon: 'error', title: 'Error', text: data.message });
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/superadmin/create-restaurant`, {
          method: 'POST', headers: authHeaders(), body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (res.ok) {
          Swal.fire({
            icon: 'success',
            title: 'Created',
            html: `<p>${data.message}</p><p style="margin-top:12px"><strong>Login Password:</strong> <code style="background:#333;padding:4px 10px;border-radius:6px;font-size:16px;color:#FFD700">${data.admin_password}</code></p><p style="font-size:13px;color:#888;margin-top:8px">Save this — it won't be shown again.</p>`
          });
          resetForm();
          fetchRestaurants();
        } else {
          Swal.fire({ icon: 'error', title: 'Error', text: data.message });
        }
      }
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Connection Error', text: 'Cannot reach the server' });
    }
    setSubmitting(false);
  };

  const handleDelete = async (r) => {
    const result = await Swal.fire({
      title: `Delete "${r.name}"?`,
      text: 'This will permanently delete the restaurant, admin user, menu, tables, and all related data.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#FF4B4B',
      confirmButtonText: 'Yes, delete it'
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${API_BASE_URL}/superadmin/restaurant/${r.rid}`, {
        method: 'DELETE', headers: authHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire({ icon: 'success', title: 'Deleted', text: data.message });
        fetchRestaurants();
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.message });
      }
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Connection Error', text: 'Cannot reach the server' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('superadmin_token');
    navigate('/superadmin/login');
  };

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: '#FF6B35' }}>RESTO<span style={{ color: '#1A1A1A' }}>BOT</span></h1>
          <p style={{ color: '#888', marginTop: 4 }}>Super Admin Panel</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={openCreate} className="btn-primary" style={{ fontSize: 13 }}>+ New Restaurant</button>
          <button onClick={handleLogout} className="btn-outline" style={{ fontSize: 13 }}>Logout</button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 30, marginBottom: 30 }}>
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>{editing ? 'Edit Restaurant' : 'Add New Restaurant Partner'}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
              <label>{editing ? 'New Password (leave blank to keep)' : 'Initial Password'}</label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} {...(!editing && { required: true })} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : editing ? 'Update Restaurant' : 'Create Restaurant & Admin'}
              </button>
              <button type="button" className="btn-outline" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 30 }}>
        <h2 style={{ fontSize: 18, marginBottom: 20 }}>Restaurant Partners ({restaurants.length})</h2>
        {loading ? (
          <p style={{ color: '#888' }}>Loading...</p>
        ) : restaurants.length === 0 ? (
          <p style={{ color: '#888' }}>No restaurants yet. Create one above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {restaurants.map(r => (
              <div key={r.rid} style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid #333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#FF6B35' }}>{r.name}</h3>
                    <p style={{ color: '#888', margin: '4px 0', fontSize: 13 }}>ID: {r.rid}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEdit(r)} className="btn-outline" style={{ fontSize: 12, padding: '6px 12px' }}>Edit</button>
                    <button onClick={() => handleDelete(r)} style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(255,75,75,0.1)', color: '#FF4B4B', border: '1px solid #FF4B4B', borderRadius: 6, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
                {r.admin ? (
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, fontSize: 13 }}>
                    <div><span style={{ color: '#888' }}>Admin:</span> <span style={{ color: '#ddd' }}>{r.admin.name}</span></div>
                    <div><span style={{ color: '#888' }}>Email:</span> <span style={{ color: '#ddd' }}>{r.admin.email}</span></div>
                    <div><span style={{ color: '#888' }}>Password:</span> <span style={{ color: '#888', fontStyle: 'italic' }}>Set on creation</span></div>
                  </div>
                ) : (
                  <p style={{ marginTop: 8, color: '#FF4B4B', fontSize: 13 }}>No admin user linked</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
