import React from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  if (!user) {
    navigate('/admin/login');
    return null;
  }

  const navItemStyle = ({ isActive }) => ({
    padding: '12px 20px',
    textDecoration: 'none',
    color: isActive ? '#FF6B35' : 'var(--text-muted)',
    background: isActive ? 'rgba(255,107,53,0.1)' : 'transparent',
    borderRadius: 8,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    marginBottom: '4px',
    fontSize: 14
  });

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div className="admin-sidebar" style={{
        width: 250,
        minWidth: 250,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        padding: 25,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 40, color: '#FF6B35' }}>
          RESTO<span style={{ color: 'var(--text)' }}>BOT</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <NavLink to="/admin" end style={navItemStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, verticalAlign: 'middle' }}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Dashboard
          </NavLink>
          <NavLink to="/admin/orders" style={navItemStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, verticalAlign: 'middle' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Orders
          </NavLink>
          <NavLink to="/admin/menu" style={navItemStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, verticalAlign: 'middle' }}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><line x1="7" y1="2" x2="7" y2="22"/><path d="M17 2c-2.8 0-5 2.2-5 5v4c0 1.1.9 2 2 2h3V2"/><path d="M17 22v-6"/></svg>
            Menu
          </NavLink>
          <NavLink to="/admin/tables" style={navItemStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, verticalAlign: 'middle' }}><rect x="2" y="7" width="20" height="4" rx="1"/><path d="M4 11v8"/><path d="M20 11v8"/><path d="M9 7V3"/><path d="M15 7V3"/></svg>
            Tables
          </NavLink>
          <NavLink to="/admin/waiters" style={navItemStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, verticalAlign: 'middle' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Waiters
          </NavLink>
          <NavLink to="/admin/settings" style={navItemStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, verticalAlign: 'middle' }}><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            Settings
          </NavLink>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <button onClick={toggleTheme}
            style={{ width: '100%', padding: '10px', marginBottom: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {theme === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            )}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>{user.name}</p>
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
