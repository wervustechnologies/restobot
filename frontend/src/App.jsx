import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import SplashScreen from './components/SplashScreen';
import LandingPage from './components/LandingPage';
import MenuPage from './components/MenuPage';
import WishlistPage from './components/WishlistPage';

// Admin Pages
import AdminLayout from './components/admin/AdminLayout';
import AdminLogin from './components/admin/AdminLogin';
import AdminRegister from './components/admin/AdminRegister';
import AdminMenuManager from './components/admin/AdminMenuManager';
import AdminTables from './components/admin/AdminTables';
// Admin Pages

import AdminDashboard from './components/admin/AdminDashboard';
import SuperAdminLogin from './components/superadmin/SuperAdminLogin';
import SuperAdminDashboard from './components/superadmin/SuperAdminDashboard';

import './index.css';

function CustomerApp() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleKeys = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        navigate('/superadmin/login');
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/wishlist/:wishlistId" element={<WishlistPage />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/register" element={<AdminRegister />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="menu" element={<AdminMenuManager />} />
        <Route path="tables" element={<AdminTables />} />
        <Route path="settings" element={<div><h1>Settings</h1><p>Restaurant settings coming soon</p></div>} />
      </Route>

      {/* Super Admin Routes */}
      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
      <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <GuestProvider>
          <Routes>
            <Route path="*" element={<CustomerApp />} />
          </Routes>
        </GuestProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
