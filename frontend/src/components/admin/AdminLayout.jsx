import React from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate('/admin/login');
    return null;
  }

  const navItemStyle = ({ isActive }) => ({
    padding: '12px 20px',
    textDecoration: 'none',
    color: isActive ? '#FF6B35' : '#888',
    background: isActive ? 'rgba(255,107,53,0.1)' : 'transparent',
    borderRadius: 8,
    fontWeight: 600,
    display: 'block',
    marginBottom: '8px'
  });

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div className="admin-sidebar" style={{
        width: 250,
        minWidth: 250,
        background: '#FFF',
        borderRight: '1px solid #EEE',
        padding: 25,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 40, color: '#FF6B35' }}>
          RESTO<span style={{ color: '#1A1A1A' }}>BOT</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          <NavLink to="/admin" end style={navItemStyle}>📊 Dashboard</NavLink>
          <NavLink to="/admin/orders" style={navItemStyle}>📋 Orders</NavLink>
          <NavLink to="/admin/menu" style={navItemStyle}>🍔 Menu Manager</NavLink>
          <NavLink to="/admin/tables" style={navItemStyle}>🪑 Table Manager</NavLink>
          <NavLink to="/admin/waiters" style={navItemStyle}>👨‍🍳 Waiters</NavLink>
          <NavLink to="/admin/settings" style={navItemStyle}>⚙️ Settings</NavLink>
        </div>

        <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 20 }}>
          <p style={{ fontSize: 13, color: '#999', marginBottom: 15, fontWeight: 600 }}>{user.name}</p>
          <button onClick={() => { logout(); navigate('/admin/login'); }}
            className="btn-outline" style={{ width: '100%', padding: '10px', fontSize: 13 }}>Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}
