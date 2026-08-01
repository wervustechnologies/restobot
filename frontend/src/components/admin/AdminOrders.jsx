import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { useInvalidation } from '../../hooks/useInvalidation';

export default function AdminOrders() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState('checkout');
  const [checkoutTable, setCheckoutTable] = useState(null);
  const { token } = useAuth();

  // The board listener is keyed to the restaurant; pull its id out of the JWT
  // payload (trusted server-issued token) to build the RTDB invalidation path.
  const restaurantId = (() => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.restaurant_id || null;
    } catch {
      return null;
    }
  })();

  const fetchTables = async () => {
    try {
      // Always load the active set (pending+claimed+served+completed). Billed
      // orders live on the History page. `viewFilter` narrows the board
      // client-side; the API payload is constant regardless of the chip.
      const res = await fetch(`${API_BASE_URL}/orders/tables-status?filter=completed`, {
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

  useInvalidation(restaurantId ? `restaurants/${restaurantId}/_rev` : null, fetchTables);

  useEffect(() => {
    fetchTables();
  }, [token]);

  const filteredTables = tables.filter(t => {
    switch (viewFilter) {
      case 'active':   return t.has_pending || t.has_served || t.has_completed || t.locked_by;
      case 'pending':  return t.has_pending;
      case 'served':   return t.has_served;
      case 'checkout': return t.has_completed;
      case 'locked':   return t.locked_by;
      case 'all':      return true;
      default:         return true;
    }
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

  const handleBillGuest = async (tableNumber, guestId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/table/${tableNumber}/bill-guest/${guestId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setCheckoutTable(null);
        fetchTables();
      } else {
        const data = await res.json();
        console.error('Failed to bill guest:', data.error || res.statusText);
        fetchTables();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteGuest = (orderIds) => {
    if (!orderIds || orderIds.length === 0) return;
    // Optimistically flip these orders to completed in the open checkout
    // snapshot so the admin sees the guest turn "Completed" instantly, then
    // persist each via the per-order complete endpoint and refresh.
    const idSet = new Set(orderIds);
    setCheckoutTable(prev => prev ? {
      ...prev,
      orders: prev.orders.map(o => idSet.has(o.id) ? { ...o, status: 'completed' } : o)
    } : prev);
    Promise.all(orderIds.map(id =>
      fetch(`${API_BASE_URL}/orders/${id}/complete`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(err => console.error('Failed to complete order', id, err))
    )).then(() => fetchTables());
  };

  const activeTableCount = tables.filter(t => t.has_pending || t.has_served || t.has_completed || t.locked_by).length;
  const waitingOrders = tables.reduce((s, t) => s + t.orders.filter(o => o.status === 'pending' || o.status === 'claimed').length, 0);
  const servedOrders = tables.reduce((s, t) => s + t.orders.filter(o => o.status === 'served').length, 0);
  const readyToBill = tables.reduce((s, t) => s + t.orders.filter(o => o.status === 'completed').length, 0);

  if (loading) return (
    <div>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <div className="skeleton skeleton-text lg" style={{ width: 200 }} />
        <div className="skeleton skeleton-rect" style={{ width: 110, height: 40 }} />
      </div>

      {/* Stat cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 15, marginBottom: 30 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton-card" style={{ borderLeft: '4px solid var(--border)' }}>
            <div className="skeleton skeleton-text sm" style={{ width: '70%', marginBottom: 12 }} />
            <div className="skeleton skeleton-text xl" style={{ width: '40%' }} />
          </div>
        ))}
      </div>

      {/* Filter chips skeleton */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[100,120,90,130,80,120].map((w, i) => (
          <div key={i} className="skeleton skeleton-rect" style={{ width: w, height: 40 }} />
        ))}
      </div>

      {/* Table cards skeleton */}
      <div className="tables-grid">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="skeleton-card" style={{ borderLeft: '4px solid var(--border)' }}>
            <div className="skeleton-row" style={{ marginBottom: 15 }}>
              <div className="skeleton skeleton-rect" style={{ width: 48, height: 48 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text md" style={{ width: '60%', marginBottom: 6 }} />
                <div className="skeleton skeleton-text sm" style={{ width: '40%' }} />
              </div>
              <div className="skeleton skeleton-rect" style={{ width: 80, height: 30 }} />
            </div>
            <div className="skeleton skeleton-rect" style={{ width: '100%', height: 80, marginBottom: 10 }} />
            <div className="skeleton skeleton-text" style={{ width: '90%' }} />
            <div className="skeleton skeleton-text sm" style={{ width: '55%' }} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <style>{`
        .checkout-modal {
          background: #FFF;
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 400px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
        }
        @media (max-width: 640px) {
          .checkout-modal {
            width: 100% !important;
            max-width: none !important;
            height: 100vh !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            padding: 20px !important;
          }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, flexWrap: 'wrap', gap: 15 }}>
        <h1 style={{ fontWeight: 900, margin: 0 }}>Active Orders</h1>
        <button onClick={fetchTables} style={{ padding: '10px 20px', background: '#FF6B35', color: '#FFF', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 15, marginBottom: 30 }}>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #2196F3' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Active Tables</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#2196F3' }}>{activeTableCount}</div>
        </div>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #FF6B35' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Waiting Orders</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#FF6B35' }}>{waitingOrders}</div>
        </div>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #2196F3' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Served</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#2196F3' }}>{servedOrders}</div>
        </div>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #1DB954' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Ready to Bill</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1DB954' }}>{readyToBill}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'checkout', label: 'Ready to Bill' },
          { key: 'active', label: 'Active Orders' },
          { key: 'all', label: 'All Tables', icon: '🗂️' },
          { key: 'pending', label: 'Waiting Orders' },
          { key: 'served', label: 'Served' },
          { key: 'locked', label: 'Staff Attending' }
        ].map(f => {
          const selected = viewFilter === f.key;
          return (
            <button key={f.key} onClick={() => setViewFilter(f.key)}
              style={{
                padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                border: 'none',
                background: selected ? '#FF6B35' : (f.key === 'all' ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : 'var(--input-bg)'),
                color: selected ? '#FFF' : (f.key === 'all' ? '#FFF' : 'var(--text-muted)'),
                boxShadow: (!selected && f.key === 'all') ? '0 4px 14px rgba(79, 70, 229, 0.35)' : 'none'
              }}>
              {f.icon && <span>{f.icon}</span>}{f.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 18, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { color: '#FF6B35', label: 'Waiting' },
          { color: '#2196F3', label: 'Served' },
          { color: '#1DB954', label: 'Ready to Bill' },
          { color: '#1DB954', label: '🔒 Staff Attending' },
          { color: '#9E9E9E', label: 'Available' }
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      <div className="tables-grid">
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
          <div className="checkout-modal">
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

                const byGuest = unbilledOrders.reduce((acc, order) => {
                  const gid = order.guest_id || 'anonymous';
                  if (!acc[gid]) acc[gid] = [];
                  acc[gid].push(order);
                  return acc;
                }, {});

                return (
                  <div>
                    <div style={{ marginBottom: 20, paddingBottom: 15, borderBottom: '2px solid #333' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#888' }}>Grand Total</div>
                      {Object.values(mergedItems).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #DDD' }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{item.quantity}x {item.name}</span>
                          <span style={{ fontSize: 14, fontWeight: 800 }}>₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTop: '2px solid #333' }}>
                        <span style={{ fontSize: 18, fontWeight: 900 }}>Grand Total</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#1DB954' }}>₹{totalAmount}</span>
                      </div>
                    </div>

                    {Object.entries(byGuest).map(([gid, orders]) => {
                      const guestItems = orders.reduce((acc, order) => {
                        (order.items || []).forEach(item => {
                          const key = item.name;
                          if (!acc[key]) acc[key] = { ...item, quantity: 0, price: item.price };
                          acc[key].quantity += item.quantity;
                        });
                        return acc;
                      }, {});
                      const guestTotal = Object.values(guestItems).reduce((sum, item) => sum + item.price * item.quantity, 0);
                      const isAnonymous = !gid || gid === 'anonymous';
                      // A guest is "active" (not completed) while any of their
                      // unbilled orders are still pending/claimed/served. Those
                      // need a Mark Complete step before/at billing, so they are
                      // visually distinguished from already-completed guests.
                      const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'claimed' || o.status === 'served');
                      const guestIsActive = activeOrders.length > 0;
                      const activeOrderIds = activeOrders.map(o => o.id);
                      const guestName = isAnonymous ? 'Anonymous Orders' : (orders[0]?.user_name || `Guest ${gid.substring(0, 6)}`);

                      return (
                        <div key={gid} style={{
                          marginBottom: 15, padding: 12, borderRadius: 12,
                          background: guestIsActive ? '#FFF4E6' : '#F1F8F1',
                          borderLeft: `4px solid ${guestIsActive ? '#FF6B35' : '#1DB954'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>{guestName}</span>
                              <span style={{
                                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                                background: guestIsActive ? '#FFE0B2' : '#C8E6C9',
                                color: guestIsActive ? '#E65100' : '#1B5E20'
                              }}>
                                {guestIsActive ? 'ACTIVE' : 'COMPLETED'}
                              </span>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#FF6B35' }}>₹{guestTotal}</span>
                          </div>
                          {Object.values(guestItems).map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                              <span>{item.quantity}x {item.name}</span>
                              <span>₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            {guestIsActive && (
                              <button
                                onClick={() => handleCompleteGuest(activeOrderIds)}
                                style={{
                                  flex: 1, padding: '10px', background: '#2196F3', color: '#FFF',
                                  border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer'
                                }}>
                                ✓ Mark Complete
                              </button>
                            )}
                            {!isAnonymous && (
                              <button
                                onClick={() => handleBillGuest(checkoutTable.table_number, gid)}
                                style={{
                                  flex: 1, padding: '10px', background: '#1DB954', color: '#FFF',
                                  border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer'
                                }}>
                                Bill This Guest
                              </button>
                            )}
                          </div>
                          {isAnonymous && (
                            <div style={{ marginTop: 8, fontSize: 11, color: '#999', textAlign: 'center' }}>
                              Anonymous orders can only be billed together (use table-wide billing below)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCheckoutTable(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #DDD', background: '#FFF', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleBill(checkoutTable.table_number)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#FF6B35', color: '#FFF', fontWeight: 700, cursor: 'pointer' }}>
                Bill All (Table-wide)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TableCard({ table, onCheckout }) {
  const isLocked = !!table.locked_by;
  const hasUnbilledOrders = table.orders.some(o => o.status !== 'billed');

  const completedOrders = table.orders.filter(o => o.status === 'completed' || o.status === 'billed');
  const activeOrders = table.orders.filter(o => o.status !== 'completed' && o.status !== 'billed');

  // Single source of truth for the table's accent + pill. Priority reflects
  // what the admin should act on next: waiting (kitchen) > served (deliver)
  // > ready to bill (checkout). Locked-but-empty tables show "Staff Attending".
  const pillKind = table.has_pending ? 'waiting'
    : table.has_served ? 'served'
    : table.has_completed ? 'checkout'
    : isLocked ? 'serving'
    : 'available';

  const accent = {
    waiting:   { color: '#FF6B35', bg: '#FFF3E0', label: '⏳ Waiting' },
    served:    { color: '#2196F3', bg: '#E3F2FD', label: '🍽️ Served' },
    checkout:  { color: '#1DB954', bg: '#E8F5E9', label: '✓ Ready to Bill' },
    serving:   { color: '#1DB954', bg: '#E8F5E9', label: '🔒 Staff Attending' },
    available: { color: '#9E9E9E', bg: 'var(--surface-alt)', label: 'Available' }
  }[pillKind];

  const guestCount = new Set([...activeOrders, ...completedOrders].map(o => o.guest_id || 'anonymous')).size;

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
      padding: 20,
      borderLeft: pillKind === 'available' ? '4px dashed var(--border)' : `4px solid ${accent.color}`,
      background: pillKind === 'available' ? 'var(--surface-alt)' : undefined,
      transition: 'all 0.3s'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: pillKind === 'available' ? 'var(--surface-alt)' : accent.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900,
            color: pillKind === 'available' ? 'var(--text-muted)' : '#FFF'
          }}>
            {table.table_number}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Table {table.table_number}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', fontWeight: 600 }}>
              {pillKind === 'available' ? 'No guests' : `${guestCount} guest${guestCount !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
            background: accent.bg, color: accent.color
          }}>
            {accent.label}
          </span>
          {isLocked && (
            <span style={{ background: '#E8F5E9', color: '#1DB954', padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
              🔒 {table.locked_by_name || 'Serving'}
            </span>
          )}
          {hasUnbilledOrders && table.orders.length > 0 && (
            <button onClick={onCheckout} style={{ background: '#1DB954', color: '#FFF', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              💳 Checkout
            </button>
          )}
        </div>
      </div>

      {pillKind === 'available' ? (
        <div style={{ textAlign: 'center', padding: 14, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
          No active orders
        </div>
      ) : (
        <>
          {Object.keys(activeByGuest).length > 0 && (
            <div style={{ background: '#FFF8F5', borderRadius: 14, padding: 16, marginBottom: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Active Orders</span>
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
            <div style={{ textAlign: 'center', padding: 14, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
              No orders yet
            </div>
          )}
        </>
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
  const guestName = orders[0]?.user_name || (guestId ? `Guest ${guestId.substring(0, 6)}` : 'Anonymous');

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
          <span style={{ fontSize: 12, fontWeight: 800, color: '#1A1A1A' }}>
            {guestName}
          </span>
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
              <span style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35' }}>₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}</span>
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
              <span style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35' }}>₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}</span>
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
