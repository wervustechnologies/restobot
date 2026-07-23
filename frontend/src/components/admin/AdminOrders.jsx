import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';

export default function AdminOrders() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('completed');
  const [checkoutTable, setCheckoutTable] = useState(null);
  const { token } = useAuth();

  const fetchTables = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/tables-status?filter=${filter}`, {
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
    if (filter === 'empty') return !t.has_pending && !t.has_completed;
    if (filter === 'completed') return t.has_completed;
    if (filter === 'billed') return t.has_billed;
    return true;
  });

  const handleBill = async (tableNumber) => {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/table/${tableNumber}/bill`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setCheckoutTable(null);
        fetchTables();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalPending = tables.filter(t => t.has_pending).length;
  const totalRevenue = tables.reduce((sum, t) => {
    const completedAmount = t.orders
      .filter(o => o.status === 'completed')
      .reduce((s, o) => s + (o.total_amount || 0), 0);
    return sum + completedAmount;
  }, 0);

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
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Completed Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1DB954' }}>₹{totalRevenue}</div>
        </div>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #2196F3' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Active Tables</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#2196F3' }}>{tables.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 25, flexWrap: 'wrap' }}>
        {[
          { key: 'completed', label: 'Completed Orders' },
          { key: 'billed', label: 'Billed / Past' },
          { key: 'all', label: 'All Tables' },
          { key: 'pending', label: 'Has Orders' },
          { key: 'locked', label: 'Being Served' },
          { key: 'empty', label: 'No Orders' }
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              background: filter === f.key ? '#FF6B35' : 'var(--input-bg)',
              color: filter === f.key ? '#FFF' : 'var(--text-muted)'
            }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {filteredTables.map(table => (
          <TableCard key={table.table_number} table={table} onCheckout={() => setCheckoutTable(table)} />
        ))}
        {filteredTables.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 16, fontWeight: 600 }}>No tables match this filter</p>
          </div>
        )}
      </div>

      {checkoutTable && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#FFF', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 15, textAlign: 'center' }}>Checkout Table {checkoutTable.table_number}</h3>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 20 }}>
              {(() => {
                const unbilledOrders = checkoutTable.orders.filter(o => o.status !== 'billed');
                const mergedItems = unbilledOrders.reduce((acc, order) => {
                  (order.items || []).forEach(item => {
                    const key = item.name;
                    if (!acc[key]) acc[key] = { ...item, quantity: 0, price: item.price };
                    acc[key].quantity += item.quantity;
                  });
                  return acc;
                }, {});
                const totalAmount = Object.values(mergedItems).reduce((sum, item) => sum + item.price * item.quantity, 0);

                return (
                  <div>
                    {Object.values(mergedItems).map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #DDD' }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{item.quantity}x {item.name}</span>
                        <span style={{ fontSize: 14, fontWeight: 800 }}>₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTop: '2px solid #333' }}>
                      <span style={{ fontSize: 18, fontWeight: 900 }}>Grand Total</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#1DB954' }}>₹{totalAmount}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCheckoutTable(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #DDD', background: '#FFF', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleBill(checkoutTable.table_number)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#1DB954', color: '#FFF', fontWeight: 700, cursor: 'pointer' }}>Mark as Billed</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TableCard({ table, onCheckout }) {
  const hasOrders = table.has_pending;
  const isLocked = !!table.locked_by;
  const hasUnbilledOrders = table.orders.some(o => o.status !== 'billed');

  const completedOrders = table.orders.filter(o => o.status === 'completed' || o.status === 'billed');
  const activeOrders = table.orders.filter(o => o.status !== 'completed' && o.status !== 'billed');

  const activeByGuest = activeOrders.reduce((acc, order) => {
    const gid = order.guest_id || order.id;
    if (!acc[gid]) acc[gid] = [];
    acc[gid].push(order);
    return acc;
  }, {});

  const completedByGuest = completedOrders.reduce((acc, order) => {
    const gid = order.guest_id || order.id;
    if (!acc[gid]) acc[gid] = [];
    acc[gid].push(order);
    return acc;
  }, {});

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
              {Object.keys(activeByGuest).length + Object.keys(completedByGuest).length} guest{Object.keys(activeByGuest).length + Object.keys(completedByGuest).length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isLocked && (
            <div style={{ background: '#E8F5E9', color: '#1DB954', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
              🔒 {table.locked_by_name || 'Serving'}
            </div>
          )}
          {hasUnbilledOrders && table.orders.length > 0 && (
            <button onClick={onCheckout} style={{ background: '#1DB954', color: '#FFF', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              💳 Checkout
            </button>
          )}
        </div>
      </div>

      {Object.keys(activeByGuest).length > 0 && (
        <div style={{ background: '#FFF8F5', borderRadius: 14, padding: 16, marginBottom: 15 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>Active Orders</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#FF6B35' }}>₹{table.total_amount}</span>
          </div>
          {Object.entries(activeByGuest).map(([gid, orders]) => (
            <GuestOrderGroup key={gid} guestId={gid} orders={orders} />
          ))}
        </div>
      )}

      {Object.keys(completedByGuest).length > 0 && (
        <div style={{ background: '#F5FFF5', borderRadius: 14, padding: 16, marginBottom: 15, opacity: 0.8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#1DB954', fontWeight: 600 }}>Completed</span>
          </div>
          {Object.entries(completedByGuest).map(([gid, orders]) => (
            <GuestOrderGroup key={gid} guestId={gid} orders={orders} />
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

function GuestOrderGroup({ guestId, orders }) {
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
  const statuses = [...new Set(orders.map(o => o.status))];
  const waiterNames = [...new Set(orders.map(o => o.claimed_by_name).filter(Boolean))];

  const statusConfig = {
    pending: { bg: '#FFF3E0', color: '#FF6B35', label: '⏳ Pending' },
    claimed: { bg: '#E3F2FD', color: '#2196F3', label: '👤 In Progress' },
    served: { bg: '#E3F2FD', color: '#2196F3', label: '🍽️ Served' },
    completed: { bg: '#E8F5E9', color: '#1DB954', label: '✅ Completed' },
    billed: { bg: '#F5F5F5', color: '#666', label: '🧾 Billed' }
  };

  const primaryStatus = statuses.includes('pending') ? 'pending' : statuses.includes('claimed') ? 'claimed' : statuses.includes('served') ? 'served' : statuses.includes('completed') ? 'completed' : 'billed';
  const status = statusConfig[primaryStatus];

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
          {statuses.length > 1 && (
            <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>
              ({orders.length} orders)
            </span>
          )}
          {waiterNames.length > 0 && (
            <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>
              by {waiterNames.join(', ')}
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
          {Object.values(mergedItems).map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < Object.values(mergedItems).length - 1 ? '1px solid #F5F5F5' : 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                {item.quantity}x {item.name}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35' }}>₹{item.price * item.quantity}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '2px solid #F5F5F5' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#FF6B35' }}>₹{totalAmount}</span>
          </div>
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
    served: { bg: '#E3F2FD', color: '#2196F3', label: '🍽️ Served' },
    completed: { bg: '#E8F5E9', color: '#1DB954', label: '✅ Completed' },
    billed: { bg: '#F5F5F5', color: '#666', label: '🧾 Billed' }
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
