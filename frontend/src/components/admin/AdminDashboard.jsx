import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { API_BASE_URL } from '../../apiConfig';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    fetch(`${API_BASE_URL}/admin/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => {
      if (!r.ok) return null;
      return r.json();
    })
    .then(d => { setMetrics(d); setLoading(false); })
    .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loader" /></div>;
  if (!metrics) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Error loading data. Please try refreshing.</div>;

  return (
    <div>
      <h1 style={{ marginBottom: 30, fontWeight: 900 }}>Dashboard Overview</h1>
      
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 40 }}>
        <StatCard title="Potential Revenue" value={`₹${metrics.total_revenue || 0}`} color="#FF6B35" />
        <StatCard title="Total Wishlists" value={metrics.total_orders || 0} color="#1DB954" />
        <StatCard title="Avg. Wishlist" value={`₹${metrics.avg_order_value || 0}`} color="#2196F3" />
        <StatCard title="Active Tables" value={metrics.total_tables || 0} color="#9C27B0" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 30 }}>
        {/* Revenue Chart */}
        <div className="card" style={{ padding: 25, height: 400 }}>
          <h3 style={{ marginBottom: 20, fontWeight: 800 }}>Revenue (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={metrics.daily_revenue || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
              <XAxis dataKey="date" stroke="#999" fontSize={11} />
              <YAxis stroke="#999" fontSize={11} />
              <Tooltip contentStyle={{ background: '#FFF', border: '1px solid #EEE', borderRadius: 12 }} />
              <Line type="monotone" dataKey="amount" stroke="#FF6B35" strokeWidth={3} dot={{ fill: '#FF6B35' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Popular Items Chart */}
        <div className="card" style={{ padding: 25, height: 400 }}>
          <h3 style={{ marginBottom: 20, fontWeight: 800 }}>Top 5 Popular Items</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={metrics.popular_items || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" stroke="#666" fontSize={11} width={100} />
              <Tooltip contentStyle={{ background: '#FFF', border: '1px solid #EEE', borderRadius: 12 }} />
              <Bar dataKey="orders" fill="#FF6B35" radius={[0, 4, 4, 0]} label="Wishlists" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div className="card" style={{ padding: 24, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 13, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
    </div>
  );
}
