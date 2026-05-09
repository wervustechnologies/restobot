import React, { useState } from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

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
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      {/* Mobile Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 25px', background: '#FFF', borderBottom: '1px solid #EEE', '@media (min-width: 768px)': { display: 'none' } }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#FF6B35' }}>
          RESTO<span style={{ color: '#1A1A1A' }}>BOT</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', display: 'block' }} className="mobile-only-btn">
          ☰
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, flexDirection: 'row', overflow: 'hidden' }} className="admin-layout-container">
        {/* Sidebar */}
        <div className={`admin-sidebar ${menuOpen ? 'open' : ''}`} style={{ 
          width: 250, 
          background: '#FFF', 
          borderRight: '1px solid #EEE', 
          padding: 25, 
          display: 'flex', 
          flexDirection: 'column',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 40, color: '#FF6B35' }} className="desktop-logo">
            RESTO<span style={{ color: '#1A1A1A' }}>BOT</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            <NavLink to="/admin" end style={navItemStyle} onClick={() => setMenuOpen(false)}>📊 Dashboard</NavLink>
            <NavLink to="/admin/menu" style={navItemStyle} onClick={() => setMenuOpen(false)}>🍔 Menu Manager</NavLink>
            <NavLink to="/admin/tables" style={navItemStyle} onClick={() => setMenuOpen(false)}>🪑 Table Manager</NavLink>
            <NavLink to="/admin/settings" style={navItemStyle} onClick={() => setMenuOpen(false)}>⚙️ Settings</NavLink>
          </div>

          <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 20 }}>
            <p style={{ fontSize: 13, color: '#999', marginBottom: 15, fontWeight: 600 }}>{user.name}</p>
            <button onClick={() => { logout(); navigate('/admin/login'); }} 
              className="btn-outline" style={{ width: '100%', padding: '10px', fontSize: 13 }}>Logout</button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }} className="admin-main-content">
          <Outlet />
        </div>
      </div>
      
      {/* Add inline styles for the media queries since inline styling doesn't support them */}
      <style>{`
        .mobile-only-btn { display: none !important; }
        @media (max-width: 768px) {
          .admin-layout-container { flex-direction: column !important; position: relative; }
          .desktop-logo { display: none !important; }
          .mobile-only-btn { display: block !important; }
          .admin-sidebar {
            position: absolute;
            left: -250px;
            top: 0;
            bottom: 0;
            z-index: 1000;
            height: 100%;
            box-shadow: 2px 0 10px rgba(0,0,0,0.1);
          }
          .admin-sidebar.open {
            left: 0;
          }
          .admin-main-content {
            padding: 15px !important;
          }
        }
      `}</style>
    </div>
  );
}
