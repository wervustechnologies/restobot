import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';

export default function AdminOrders() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { token } = useAuth();

  const fetchTables = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/tables-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        setTables([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
      setTables([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const filteredTables = tables.filter(t => {
    if (filter === 'pending') return t.has_pending;
    if (filter === 'locked') return t.locked_by;
    if (filter === 'empty') return !t.has_pending;
    return true;
  });

  const totalPending = tables.filter(t => t.has_pending).length;
  const totalRevenue = tables.reduce((sum, t) => sum + t.total_amount, 0);

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loader" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, flexWrap: 'wrap', gap: 15 }}>
        <h1 style={{ fontWeight: 900, margin: 0 }}>Orders</h1>
        <button onClick={fetchTables} style={{ padding: '10px 20px', background: '#FF6B35', color: '#FFF', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 15, marginBottom: 30 }}>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #FF6B35' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Pending Tables</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#FF6B35' }}>{totalPending}</div>
        </div>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #1DB954' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Total Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1DB954' }}>₹{totalRevenue}</div>
        </div>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #2196F3' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Active Tables</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#2196F3' }}>{tables.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 25, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All Tables' },
          { key: 'pending', label: 'Has Orders' },
          { key: 'locked', label: 'Being Served' },
          { key: 'empty', label: 'No Orders' }
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              background: filter === f.key ? '#FF6B35' : '#F5F5F5',
              color: filter === f.key ? '#FFF' : '#666'
            }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {filteredTables.map(table => (
          <TableCard key={table.table_number} table={table} />
        ))}
        {filteredTables.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: '#888' }}>
            <div style={{ fontSize: 48, marginBottom: 15 }}>📋</div>
            <p style={{ fontSize: 16, fontWeight: 600 }}>No tables match this filter</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TableCard({ table }) {
  const [expanded, setExpanded] = useState(false);
  const hasOrders = table.has_pending;
  const isLocked = !!table.locked_by;

  const completedOrders = table.orders.filter(o => o.status === 'completed');
  const activeOrders = table.orders.filter(o => o.status !== 'completed');

  return (
    <div className="card" style={{
      padding: 24,
      borderLeft: `4px solid ${hasOrders ? '#FF6B35' : isLocked ? '#1DB954' : '#DDD'}`,
      transition: 'all 0.3s'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: hasOrders ? 'linear-gradient(135deg, #FF6B35, #E85A20)' : '#F5F5F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900,
            color: hasOrders ? '#FFF' : '#888'
          }}>
            {table.table_number}
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Table {table.table_number}</h3>
            <p style={{ fontSize: 12, color: '#888', margin: 0, fontWeight: 600 }}>
              {table.orders.length} order{table.orders.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {isLocked && (
          <div style={{ background: '#E8F5E9', color: '#1DB954', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
            🔒 {table.locked_by_name || 'Serving'}
          </div>
        )}
      </div>

      {activeOrders.length > 0 && (
        <div style={{ background: '#FFF8F5', borderRadius: 14, padding: 16, marginBottom: 15 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>Active Orders</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#FF6B35' }}>₹{table.total_amount}</span>
          </div>
          {activeOrders.map(order => (
            <OrderItems key={order.id} order={order} />
          ))}
        </div>
      )}

      {completedOrders.length > 0 && (
        <div style={{ background: '#F5FFF5', borderRadius: 14, padding: 16, marginBottom: 15, opacity: 0.8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#1DB954', fontWeight: 600 }}>Completed</span>
          </div>
          {completedOrders.map(order => (
            <OrderItems key={order.id} order={order} />
          ))}
        </div>
      )}

      {table.orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#888', fontSize: 13, fontWeight: 600 }}>
          No orders yet
        </div>
      )}
    </div>
  );
}

function OrderItems({ order }) {
  const [showItems, setShowItems] = useState(false);

  const statusConfig = {
    pending: { bg: '#FFF3E0', color: '#FF6B35', label: '⏳ Pending' },
    claimed: { bg: '#E3F2FD', color: '#2196F3', label: '👤 In Progress' },
    completed: { bg: '#E8F5E9', color: '#1DB954', label: '✅ Completed' }
  };

  const status = statusConfig[order.status] || statusConfig.pending;

  return (
    <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 10, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: status.bg, color: status.color
          }}>
            {status.label}
          </span>
          {order.claimed_by_name && (
            <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>
              by {order.claimed_by_name}
            </span>
          )}
        </div>
        <button onClick={() => setShowItems(!showItems)}
          style={{ background: 'none', border: 'none', color: '#FF6B35', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          {showItems ? 'Hide' : 'View Items'}
        </button>
      </div>

      {showItems && (
        <div style={{ marginTop: 12, background: '#FFF', borderRadius: 10, padding: 12 }}>
          {order.items?.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < order.items.length - 1 ? '1px solid #F5F5F5' : 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                {item.quantity}x {item.name}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35' }}>₹{item.price * item.quantity}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '2px solid #F5F5F5' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#FF6B35' }}>₹{order.total_amount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
