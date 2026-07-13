import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import Swal from 'sweetalert2';

export default function AdminWaiters() {
  const [waiters, setWaiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const { token } = useAuth();

  const fetchWaiters = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/waiters`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setWaiters(data);
    } catch (err) {
      console.error('Failed to fetch waiters:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWaiters();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      Swal.fire('Error', 'Please fill in all fields', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register-waiter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok) {
        Swal.fire('Success!', 'Waiter registered successfully', 'success');
        setFormData({ name: '', email: '', password: '' });
        setShowForm(false);
        fetchWaiters();
      } else {
        Swal.fire('Error', data.message || 'Failed to register waiter', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Failed to register waiter', 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (waiterId, waiterName) => {
    const result = await Swal.fire({
      title: 'Delete Waiter?',
      text: `Are you sure you want to delete ${waiterName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E53935',
      cancelButtonColor: '#666',
      confirmButtonText: 'Yes, delete'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/waiters/${waiterId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          Swal.fire('Deleted!', 'Waiter has been deleted.', 'success');
          fetchWaiters();
        } else {
          Swal.fire('Error', 'Failed to delete waiter', 'error');
        }
      } catch (err) {
        Swal.fire('Error', 'Failed to delete waiter', 'error');
      }
    }
  };

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loader" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, flexWrap: 'wrap', gap: 15 }}>
        <h1 style={{ fontWeight: 900, margin: 0 }}>Waiters</h1>
        <button onClick={() => setShowForm(!showForm)}
          style={{
            padding: '12px 24px', background: showForm ? '#666' : '#FF6B35', color: '#FFF',
            border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer'
          }}>
          {showForm ? 'Cancel' : '+ Register Waiter'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 30, marginBottom: 30 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 25 }}>Register New Waiter</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#666', marginBottom: 8 }}>Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  style={{ width: '100%', padding: '14px 16px', border: '2px solid #EEE', borderRadius: 12, fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#666', marginBottom: 8 }}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@restaurant.com"
                  style={{ width: '100%', padding: '14px 16px', border: '2px solid #EEE', borderRadius: 12, fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#666', marginBottom: 8 }}>Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 6 characters"
                  style={{ width: '100%', padding: '14px 16px', border: '2px solid #EEE', borderRadius: 12, fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <button type="submit" disabled={submitting}
              style={{
                marginTop: 20, padding: '14px 40px', background: '#FF6B35', color: '#FFF',
                border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer',
                opacity: submitting ? 0.7 : 1
              }}>
              {submitting ? 'Registering...' : 'Register Waiter'}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {waiters.map(waiter => (
          <div key={waiter.id} className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 14,
                  background: 'linear-gradient(135deg, #2196F3, #1976D2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 900, color: '#FFF'
                }}>
                  {waiter.name?.charAt(0)?.toUpperCase() || 'W'}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: '#1A1A1A' }}>{waiter.name}</h3>
                  <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0', fontWeight: 600 }}>{waiter.email}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(waiter.id, waiter.name)}
                style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#E53935', fontWeight: 700, fontSize: 12 }}>
                Delete
              </button>
            </div>
            {waiter.created_at && (
              <p style={{ fontSize: 11, color: '#AAA', marginTop: 15, fontWeight: 600 }}>
                Added: {new Date(waiter.created_at * 1000).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}

        {waiters.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: '#888' }}>
            <div style={{ fontSize: 48, marginBottom: 15 }}>👨‍🍳</div>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>No waiters registered yet</p>
            <p style={{ fontSize: 13, color: '#AAA' }}>Click "Register Waiter" to add your first waiter</p>
          </div>
        )}
      </div>
    </div>
  );
}
