import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({ restaurant_name: '', owner_name: '', email: '', password: '' });
  
  const navigate = useNavigate();

  const fetchRestaurants = async () => {
    try {
      const token = localStorage.getItem('superadminToken');
      if (!token) {
        navigate('/');
        return;
      }
      
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/superadmin/restaurants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('superadminToken');
        navigate('/');
        return;
      }
      const data = await res.json();
      
      // The API returns an array directly
      const restaurantArray = Array.isArray(data) ? data : [];
      
      // Add mock status if missing from backend
      const enrichedData = restaurantArray.map(r => ({
        ...r,
        status: r.status || 'Active' // Default mock status
      }));
      setRestaurants(enrichedData);
    } catch (err) {
      setError('Failed to fetch restaurants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('superadminToken');
    navigate('/');
  };

  const openModal = (restaurant = null) => {
    if (restaurant) {
      setEditingRestaurant(restaurant);
      setFormData({ 
        restaurant_name: restaurant.name || '', 
        owner_name: restaurant.admin?.name || '', 
        email: restaurant.admin?.email || '', 
        password: '' 
      });
    } else {
      setEditingRestaurant(null);
      setFormData({ restaurant_name: '', owner_name: '', email: '', password: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRestaurant(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('superadminToken');
    
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    const url = editingRestaurant 
      ? `${API_BASE}/api/superadmin/restaurant/${editingRestaurant.rid}` 
      : `${API_BASE}/api/superadmin/create-restaurant`;
      
    const method = editingRestaurant ? 'PUT' : 'POST';
    
    // Only send password if it's filled or if creating new
    const payload = { ...formData };
    if (editingRestaurant && !payload.password) {
      delete payload.password;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        closeModal();
        fetchRestaurants();
      } else {
        const data = await res.json();
        alert(data.error || 'Operation failed');
      }
    } catch (err) {
      alert('Network error occurred');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this restaurant? This cannot be undone.')) return;
    
    const token = localStorage.getItem('superadminToken');
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/superadmin/restaurant/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchRestaurants();
      } else {
        alert('Failed to delete restaurant');
      }
    } catch (err) {
      alert('Network error occurred');
    }
  };
  
  const cycleStatus = (restaurantId, currentStatus) => {
    const statuses = ['Active', 'Inactive', 'Maintenance'];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    // Mock update: Just update local state since backend might not support it
    setRestaurants(prev => prev.map(r => 
      r.rid === restaurantId ? { ...r, status: nextStatus } : r
    ));
    
    // In a real scenario, we'd fire an API call here.
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <div className="page-container">
      <div className="flex-between page-header">
        <div>
          <h1 className="page-title">Super Admin Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Manage restaurants and system status</p>
        </div>
        <div className="flex-gap">
          <button className="btn btn-primary" onClick={() => openModal()}>+ New Restaurant</button>
          <button className="btn btn-secondary" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>

      {error && <div style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</div>}

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {restaurants.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  No restaurants found. Create one to get started.
                </td>
              </tr>
            ) : (
              restaurants.map(r => (
                <tr key={r.rid}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{r.rid.substring(0, 8)}...</td>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td>{r.admin?.email || 'N/A'}</td>
                  <td>
                    <span 
                      className={`status-badge status-${r.status.toLowerCase()}`}
                      onClick={() => cycleStatus(r.rid, r.status)}
                      title="Click to toggle status (Mock)"
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex-gap">
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem' }} onClick={() => openModal(r)}>Edit</button>
                      <button className="btn btn-danger" style={{ padding: '0.25rem 0.75rem' }} onClick={() => handleDelete(r.rid)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content glass-panel" style={{ padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
              {editingRestaurant ? 'Edit Restaurant' : 'Create New Restaurant'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label">Restaurant Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.restaurant_name}
                  onChange={e => setFormData({...formData, restaurant_name: e.target.value})}
                  required 
                />
              </div>
              <div className="input-group">
                <label className="input-label">Owner Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.owner_name}
                  onChange={e => setFormData({...formData, owner_name: e.target.value})}
                  required 
                />
              </div>
              <div className="input-group">
                <label className="input-label">Owner Email</label>
                <input 
                  type="email" 
                  className="input-field" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required 
                />
              </div>
              <div className="input-group">
                <label className="input-label">Password {editingRestaurant && '(leave blank to keep current)'}</label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  required={!editingRestaurant}
                />
              </div>
              <div className="flex-gap" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingRestaurant ? 'Save Changes' : 'Create Restaurant'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
