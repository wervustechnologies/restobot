import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { API_BASE_URL } from '../../apiConfig';

const PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'This Month', value: 'month' },
];

function getPresetRange(value) {
  const now = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  let start, end;

  switch (value) {
    case 'today':
      start = end = fmt(now);
      break;
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      start = fmt(d);
      end = fmt(now);
      break;
    }
    case 'month': {
      start = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
      end = fmt(now);
      break;
    }
    default:
      return null;
  }
  return { start, end };
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  const [activePreset, setActivePreset] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = useCallback((sd, ed) => {
    setLoading(true);
    let url = `${API_BASE_URL}/admin/analytics`;
    const params = [];
    if (sd) params.push(`start_date=${sd}`);
    if (ed) params.push(`end_date=${ed}`);
    if (params.length) url += '?' + params.join('&');

    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => { if (!r.ok) return null; return r.json(); })
      .then(d => { setMetrics(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const range = getPresetRange('7d');
    fetchData(range.start, range.end);
  }, [fetchData]);

  const handlePreset = (value) => {
    setActivePreset(value);
    setStartDate('');
    setEndDate('');
    const range = getPresetRange(value);
    fetchData(range.start, range.end);
  };

  const handleCustomDate = () => {
    const today = new Date().toISOString().split('T')[0];
    const sd = startDate || endDate || today;
    const ed = endDate || startDate || today;
    setActivePreset('');
    fetchData(sd, ed);
  };

  const getChartTitle = () => {
    if (activePreset === 'today') return 'Revenue (Today)';
    if (activePreset === '7d') return 'Revenue (Last 7 Days)';
    if (activePreset === 'month') return 'Revenue (This Month)';
    const sd = startDate || endDate;
    const ed = endDate || startDate;
    if (sd === ed) return `Revenue (${sd})`;
    return `Revenue (${sd} to ${ed})`;
  };

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loader" /></div>;
  if (!metrics) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Error loading data. Please try refreshing.</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ fontWeight: 900, margin: 0 }}>Dashboard Overview</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.value} onClick={() => handlePreset(p.value)}
              style={{
                padding: '8px 16px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                background: activePreset === p.value ? '#FF6B35' : 'var(--surface-alt, #F5F5F5)',
                color: activePreset === p.value ? '#FFF' : 'var(--text-muted, #666)'
              }}>
              {p.label}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} max={endDate || new Date().toISOString().split('T')[0]}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border, #DDD)', fontSize: 13, fontWeight: 600, color: 'var(--text, #1A1A1A)', background: 'var(--surface, #FFF)' }} />
            <span style={{ color: '#888', fontSize: 13 }}>-</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} max={new Date().toISOString().split('T')[0]} min={startDate}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border, #DDD)', fontSize: 13, fontWeight: 600, color: 'var(--text, #1A1A1A)', background: 'var(--surface, #FFF)' }} />
            <button onClick={handleCustomDate} disabled={!startDate && !endDate}
              style={{
                padding: '7px 14px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: startDate || endDate ? 'pointer' : 'not-allowed',
                background: startDate || endDate ? '#FF6B35' : '#CCC', color: '#FFF'
              }}>
              Go
            </button>
          </div>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 40 }}>
        <StatCard title="Total Revenue" value={`₹${metrics.total_revenue || 0}`} color="#1DB954" />
        <StatCard title="Completed Orders" value={metrics.completed_orders || 0} color="#1DB954" />
        <StatCard title="Pending Orders" value={metrics.pending_orders || 0} color="#FF6B35" />
        <StatCard title="Avg. Order Value" value={`₹${metrics.avg_order_value || 0}`} color="#2196F3" />
        <StatCard title="Total Orders" value={metrics.total_orders || 0} color="#9C27B0" />
        <StatCard title="Active Tables" value={metrics.total_tables || 0} color="#607D8B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 30 }}>
        {/* Revenue Chart */}
        <div className="card" style={{ padding: 25, height: 400 }}>
          <h3 style={{ marginBottom: 20, fontWeight: 800 }}>{getChartTitle()}</h3>
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
