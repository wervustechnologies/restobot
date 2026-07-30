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
  const { token } = useAuth();
  const [billedTables, setBilledTables] = useState([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  const [activePreset, setActivePreset] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  // Billed list comes from the tables-status board capped at the most recent
  // 200 billed orders per the backend. It is intentionally NOT date-scoped
  // (the endpoint has no date param) — the analytics cards below are the
  // date-aware source of truth for totals.
  const fetchBilled = useCallback(() => {
    setLoadingBills(true);
    fetch(`${API_BASE_URL}/orders/tables-status?filter=billed`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => { if (!r.ok) return null; return r.json(); })
      .then(d => {
        const tables = (Array.isArray(d) ? d : []).filter(t => t.orders.some(o => o.status === 'billed'));
        setBilledTables(tables);
        setLoadingBills(false);
      })
      .catch(() => setLoadingBills(false));
  }, [token]);

  const fetchAnalytics = useCallback((sd, ed) => {
    setLoadingMetrics(true);
    let url = `${API_BASE_URL}/admin/analytics`;
    const params = [];
    if (sd) params.push(`start_date=${sd}`);
    if (ed) params.push(`end_date=${ed}`);
    if (params.length) url += '?' + params.join('&');
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => { if (!r.ok) return null; return r.json(); })
      .then(d => { setMetrics(d); setLoadingMetrics(false); })
      .catch(() => setLoadingMetrics(false));
  }, [token]);

  useEffect(() => {
    fetchBilled();
  }, [fetchBilled]);

  useEffect(() => {
    const range = getPresetRange('7d');
    fetchAnalytics(range.start, range.end);
  }, [fetchAnalytics]);

  useEffect(() => {
    if (!showFilter) return;
    const handleClick = (e) => {
      if (!e.target.closest('.filter-panel') && !e.target.closest('.filter-btn')) {
        setShowFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showFilter]);

  const applyPreset = (value) => {
    setActivePreset(value);
    setStartDate('');
    setEndDate('');
    const range = getPresetRange(value);
    if (range) fetchAnalytics(range.start, range.end);
  };

  const handleCustomDate = () => {
    const today = new Date().toISOString().split('T')[0];
    const sd = startDate || endDate || today;
    const ed = endDate || startDate || today;
    setActivePreset('');
    fetchAnalytics(sd, ed);
  };

  const getChartTitle = () => {
    if (activePreset === 'today') return 'Billed Revenue (Today)';
    if (activePreset === '7d') return 'Billed Revenue (Last 7 Days)';
    if (activePreset === 'month') return 'Billed Revenue (This Month)';
    const sd = startDate || endDate;
    const ed = endDate || startDate;
    if (sd === ed) return `Billed Revenue (${sd})`;
    return `Billed Revenue (${sd} to ${ed})`;
  };

  if (loadingBills || loadingMetrics) {
    return (
      <div>
        {/* Header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
          <div className="skeleton skeleton-text lg" style={{ width: 240 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="skeleton skeleton-rect" style={{ width: 100, height: 40 }} />
            <div className="skeleton skeleton-rect" style={{ width: 90, height: 40 }} />
          </div>
        </div>

        {/* Analytics stat cards skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 30 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton-card" style={{ borderLeft: '4px solid var(--border)' }}>
              <div className="skeleton skeleton-text sm" style={{ width: '65%', marginBottom: 12 }} />
              <div className="skeleton skeleton-text xl" style={{ width: '45%' }} />
            </div>
          ))}
        </div>

        {/* Charts skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 30, marginBottom: 30 }}>
          {[1,2].map(i => (
            <div key={i} className="skeleton-card" style={{ height: 360 }}>
              <div className="skeleton skeleton-text md" style={{ width: '50%', marginBottom: 24 }} />
              <div className="skeleton skeleton-rect" style={{ width: '100%', height: 260 }} />
            </div>
          ))}
        </div>

        {/* Billed orders header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div className="skeleton skeleton-text lg" style={{ width: 160 }} />
          <div className="skeleton skeleton-text sm" style={{ width: 200 }} />
        </div>

        {/* Billed table cards skeleton */}
        <div className="tables-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton-card" style={{ borderLeft: '4px solid var(--border)' }}>
              <div className="skeleton-row" style={{ marginBottom: 12 }}>
                <div className="skeleton skeleton-rect" style={{ width: 44, height: 44 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-text md" style={{ width: '55%', marginBottom: 6 }} />
                  <div className="skeleton skeleton-text sm" style={{ width: '70%' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="skeleton skeleton-text sm" style={{ width: 50, marginBottom: 6 }} />
                  <div className="skeleton skeleton-text" style={{ width: 60, height: 18 }} />
                </div>
              </div>
              <div className="skeleton skeleton-text" style={{ width: '85%' }} />
              <div className="skeleton skeleton-text sm" style={{ width: '50%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalBilledOrders = billedTables.reduce((s, t) => s + t.orders.filter(o => o.status === 'billed').length, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ fontWeight: 900, margin: 0 }}>Dashboard Overview</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={fetchBilled}
            style={{ padding: '10px 20px', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
            🔄 Refresh
          </button>
          <div style={{ position: 'relative' }}>
            <button className="filter-btn" onClick={() => setShowFilter(!showFilter)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
                border: showFilter ? '2px solid #FF6B35' : '1px solid var(--border)',
                background: showFilter ? '#FFF0EA' : 'var(--surface)',
                color: showFilter ? '#FF6B35' : 'var(--text)',
                fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filter
              {(activePreset !== '7d' || startDate || endDate) && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6B35' }} />
              )}
            </button>

            {showFilter && (
              <div className="filter-panel" style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 300,
                background: 'var(--surface)', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                border: '1px solid var(--border)', padding: 20, zIndex: 100
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>Quick Duration</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {PRESETS.map(p => (
                    <button key={p.value} onClick={() => applyPreset(p.value)}
                      style={{
                        padding: '8px 14px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
                        background: activePreset === p.value ? '#FF6B35' : 'var(--surface-alt)',
                        color: activePreset === p.value ? '#FFF' : 'var(--text-muted)'
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Custom Period</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }}>From</label>
                    <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActivePreset(''); }}
                      max={endDate || new Date().toISOString().split('T')[0]}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'var(--surface)', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }}>To</label>
                    <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActivePreset(''); }}
                      max={new Date().toISOString().split('T')[0]} min={startDate}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'var(--surface)', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { handleCustomDate(); setShowFilter(false); }}
                    disabled={!startDate && !endDate && activePreset === '7d'}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      background: '#FF6B35', color: '#FFF'
                    }}>
                    Apply
                  </button>
                  <button onClick={() => { applyPreset('7d'); setShowFilter(false); }}
                    style={{
                      padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', fontWeight: 700, fontSize: 13,
                      background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer'
                    }}>
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 30 }}>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #1DB954' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Billed Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1DB954' }}>₹{metrics?.billed_revenue || 0}</div>
        </div>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #FF6B35' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Billed Orders</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#FF6B35' }}>{metrics?.billed_orders || 0}</div>
        </div>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #2196F3' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Avg. Order Value</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#2196F3' }}>₹{metrics?.billed_avg_order_value || 0}</div>
        </div>
      </div>

      {/* Charts */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 30, marginBottom: 30 }}>
          <div className="card" style={{ padding: 25, height: 360 }}>
            <h3 style={{ marginBottom: 20, fontWeight: 800 }}>{getChartTitle()}</h3>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={metrics.billed_daily_revenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
                <XAxis dataKey="date" stroke="#999" fontSize={11} />
                <YAxis stroke="#999" fontSize={11} />
                <Tooltip contentStyle={{ background: '#FFF', border: '1px solid #EEE', borderRadius: 12 }} />
                <Line type="monotone" dataKey="amount" stroke="#1DB954" strokeWidth={3} dot={{ fill: '#1DB954' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: 25, height: 360 }}>
            <h3 style={{ marginBottom: 20, fontWeight: 800 }}>Top 5 Popular Items</h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={metrics.popular_items || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#666" fontSize={11} width={100} />
                <Tooltip contentStyle={{ background: '#FFF', border: '1px solid #EEE', borderRadius: 12 }} />
                <Bar dataKey="orders" fill="#FF6B35" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Billed orders list */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Billed Orders</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          {totalBilledOrders} billed order{totalBilledOrders !== 1 ? 's' : ''} · list shows the most recent 200
        </span>
      </div>

      <div className="tables-grid">
        {billedTables.map(table => (
          <HistoryTableCard key={table.table_number} table={table} />
        ))}
        {billedTables.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 16, fontWeight: 600 }}>No billed orders yet</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Completed and billed tables will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTableCard({ table }) {
  const billedOrders = table.orders.filter(o => o.status === 'billed');
  const total = billedOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const sorted = [...billedOrders].sort((a, b) => (b.billed_at || b.created_at || 0) - (a.billed_at || a.created_at || 0));
  const latestTs = sorted[0]?.billed_at || sorted[0]?.created_at;

  const byGuest = billedOrders.reduce((acc, order) => {
    const gid = order.guest_id || 'anonymous';
    if (!acc[gid]) acc[gid] = [];
    acc[gid].push(order);
    return acc;
  }, {});

  return (
    <div className="card" style={{ padding: 20, borderLeft: '4px solid #9E9E9E' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 900, color: 'var(--text-muted)'
          }}>
            {table.table_number}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Table {table.table_number}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', fontWeight: 600 }}>
              {latestTs ? new Date(latestTs * 1000).toLocaleString() : '—'}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Billed</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1DB954' }}>₹{total}</div>
        </div>
      </div>

      {Object.entries(byGuest).map(([gid, orders]) => (
        <HistoryGuestGroup key={gid} guestId={gid} orders={orders} />
      ))}
    </div>
  );
}

function HistoryGuestGroup({ guestId, orders }) {
  const [showItems, setShowItems] = useState(false);

  const mergedItems = orders.reduce((acc, order) => {
    (order.items || []).forEach(item => {
      const key = item.name;
      if (!acc[key]) acc[key] = { ...item, quantity: 0, price: item.price };
      acc[key].quantity += item.quantity;
    });
    return acc;
  }, {});
  const totalAmount = Object.values(mergedItems).reduce((sum, item) => sum + item.price * item.quantity, 0);
  const guestName = orders[0]?.user_name || (guestId && guestId !== 'anonymous' ? `Guest ${guestId.substring(0, 6)}` : 'Anonymous');
  const billedTs = orders[0]?.billed_at || orders[0]?.created_at;

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{guestName}</span>
          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'var(--surface-alt)', color: 'var(--text-muted)' }}>🧾 Billed</span>
          {billedTs && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{new Date(billedTs * 1000).toLocaleString()}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35' }}>₹{totalAmount}</span>
          <button onClick={() => setShowItems(!showItems)} style={{ background: 'none', border: 'none', color: '#FF6B35', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {showItems ? 'Hide' : 'View'}
          </button>
        </div>
      </div>

      {showItems && (
        <div style={{ marginTop: 10, background: 'var(--surface-alt)', borderRadius: 10, padding: 12 }}>
          {Object.values(mergedItems).map((item, idx, arr) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.quantity}x {item.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
