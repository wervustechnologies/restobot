import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import { ThemeProvider } from './context/ThemeContext';

import MenuPage from './components/MenuPage';
import WishlistPage from './components/WishlistPage';

// Admin Pages
import AdminLayout from './components/admin/AdminLayout';
import AdminLogin from './components/admin/AdminLogin';
import AdminMenuManager from './components/admin/AdminMenuManager';
import AdminTables from './components/admin/AdminTables';
import AdminOrders from './components/admin/AdminOrders';
import AdminWaiters from './components/admin/AdminWaiters';
import AdminReviews from './components/admin/AdminReviews';

import AdminDashboard from './components/admin/AdminDashboard';

// Waiter Pages
import WaiterLogin from './components/waiter/WaiterLogin';
import WaiterHome from './components/waiter/WaiterHome';

import './index.css';

// Smart root route: QR scans (?t=TOKEN) → MenuPage, direct visits → Admin Login
function RootRoute() {
  const location = window.location;
  const params = new URLSearchParams(location.search);
  if (params.get('t')) {
    return <MenuPage />;
  }
  return <Navigate to="/admin/login" replace />;
}

function CustomerApp() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/wishlist/:wishlistId" element={<WishlistPage />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="menu" element={<AdminMenuManager />} />
        <Route path="tables" element={<AdminTables />} />
        <Route path="waiters" element={<AdminWaiters />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="settings" element={<div><h1>Settings</h1><p>Restaurant settings coming soon</p></div>} />
      </Route>

      {/* Waiter Routes */}
      <Route path="/waiter/login" element={<WaiterLogin />} />
      <Route path="/waiter/home" element={<WaiterHome />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <GuestProvider>
            <Routes>
              <Route path="*" element={<CustomerApp />} />
            </Routes>
          </GuestProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

