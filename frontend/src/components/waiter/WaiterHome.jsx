import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../apiConfig';
import { useTheme } from '../../context/ThemeContext';
import Swal from 'sweetalert2';

export default function WaiterHome() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waiter, setWaiter] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [addItemModal, setAddItemModal] = useState({ open: false, orderId: null, tableNumber: null });
  const [selectedItem, setSelectedItem] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemSearch, setItemSearch] = useState('');
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('waiter_token');
    const user = JSON.parse(localStorage.getItem('waiter_user'));
    if (!token || !user) {
      navigate('/waiter/login');
      return;
    }
    setWaiter(user);
  }, [navigate]);

  const fetchTables = async () => {
    const token = localStorage.getItem('waiter_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/orders/tables-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setTables(data);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchMenuItems = async () => {
    const token = localStorage.getItem('waiter_token');
    const rid = localStorage.getItem('waiter_rid');
    if (!token || !rid) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMenuItems(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch menu items:', err);
    }
  };

  const handleAddItem = async () => {
    const token = localStorage.getItem('waiter_token');
    if (!selectedItem || !addItemModal.orderId) return;

    const item = menuItems.find(m => m.id === selectedItem);
    if (!item) return;

    try {
      const res = await fetch(`${API_BASE_URL}/orders/${addItemModal.orderId}/add-items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: [{ name: item.name, price: item.price, quantity: itemQty }]
        })
      });

      if (res.ok) {
        Swal.fire({ icon: 'success', title: 'Item Added!', timer: 1500, showConfirmButton: false });
        setAddItemModal({ open: false, orderId: null, tableNumber: null });
        setSelectedItem('');
        setItemQty(1);
        setItemSearch('');
        fetchTables();
      }
    } catch (err) {
      Swal.fire('Error', 'Failed to add item', 'error');
    }
  };

  const handleClaimTable = async (tableNumber) => {
    const token = localStorage.getItem('waiter_token');
    if (!waiter || !token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/orders/table/${tableNumber}/lock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          waiter_id: waiter.id,
          waiter_name: waiter.name
        })
      });
      const data = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Table Claimed!',
          text: `You are now serving Table ${tableNumber}`,
          timer: 1500,
          showConfirmButton: false
        });
        fetchTables();
      } else {
        Swal.fire('Cannot Claim', data.error || 'Table is being served by another waiter', 'warning');
        fetchTables();
      }
    } catch (err) {
      Swal.fire('Error', 'Failed to claim table', 'error');
    }
  };

  const handleReleaseTable = async (tableNumber) => {
    const token = localStorage.getItem('waiter_token');
    if (!waiter || !token) return;

    const result = await Swal.fire({
      title: 'Release Table?',
      text: `Stop serving Table ${tableNumber}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#FF6B35',
      cancelButtonColor: '#666',
      confirmButtonText: 'Yes, release'
    });

    if (result.isConfirmed) {
      try {
        await fetch(`${API_BASE_URL}/orders/table/${tableNumber}/unlock`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ waiter_id: waiter.id })
        });
        Swal.fire('Released', 'Table is now available', 'success');
        fetchTables();
      } catch (err) {
        Swal.fire('Error', 'Failed to release table', 'error');
      }
    }
  };

  const dismissCall = async (tableNumber) => {
    const token = localStorage.getItem('waiter_token');
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/orders/table/${tableNumber}/dismiss-call`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      fetchTables();
    } catch (err) {
      console.error('Failed to dismiss call:', err);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    const token = localStorage.getItem('waiter_token');
    if (!token) return;

    try {
      await fetch(`${API_BASE_URL}/orders/${orderId}/complete`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchTables();
    } catch (err) {
      console.error('Failed to complete order:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('waiter_token');
    localStorage.removeItem('waiter_user');
    localStorage.removeItem('waiter_rid');
    navigate('/waiter/login');
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loader" /></div>;

  const myTables = tables.filter(t => t.locked_by === waiter?.id);
  const availableTables = tables.filter(t => !t.locked_by && t.has_pending);
  const otherTables = tables.filter(t => t.locked_by && t.locked_by !== waiter?.id);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.7 } }`}</style>
      <div style={{
        background: 'linear-gradient(135deg, #FF6B35 0%, #E85A20 100%)',
        padding: '20px 24px',
        color: '#FFF'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Welcome, {waiter?.name}</h1>
            <p style={{ fontSize: 13, opacity: 0.9, margin: '4px 0 0', fontWeight: 600 }}>Your assigned tables</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={toggleTheme}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#FFF', padding: '10px 14px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {theme === 'light' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              )}
            </button>
            <button onClick={handleLogout}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#FFF', padding: '10px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {myTables.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, background: '#1DB954', borderRadius: '50%', display: 'inline-block' }} />
              My Tables ({myTables.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 15 }}>
              {myTables.map(table => (
                <MyTableCard key={table.table_number} table={table} onRelease={handleReleaseTable} onCompleteOrder={handleCompleteOrder} onAddItem={(orderId) => { fetchMenuItems(); setAddItemModal({ open: true, orderId, tableNumber: table.table_number }); }} onDismissCall={dismissCall} />
              ))}
            </div>
          </div>
        )}

        {availableTables.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, background: '#FF6B35', borderRadius: '50%', display: 'inline-block' }} />
              Ready to Serve ({availableTables.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 15 }}>
              {availableTables.map(table => (
                <AvailableTableCard key={table.table_number} table={table} onClaim={handleClaimTable} />
              ))}
            </div>
          </div>
        )}

        {otherTables.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#888', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, background: '#DDD', borderRadius: '50%', display: 'inline-block' }} />
              Other Waiters ({otherTables.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 15 }}>
              {otherTables.map(table => (
                <div key={table.table_number} className="card" style={{ padding: 20, opacity: 0.7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: '#F5F5F5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 900, color: '#888'
                    }}>
                      {table.table_number}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: '#888' }}>Table {table.table_number}</h3>
                      <p style={{ fontSize: 11, color: '#AAA', margin: '2px 0 0', fontWeight: 600 }}>
                        Serving: {table.locked_by_name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {myTables.length === 0 && availableTables.length === 0 && otherTables.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
            <div style={{ fontSize: 60, marginBottom: 20 }}>🍽️</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>No Tables Yet</h2>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Waiting for customer orders...</p>
          </div>
        )}
      </div>

      {addItemModal.open && (() => {
        const filteredItems = menuItems.filter(item =>
          item.name.toLowerCase().includes(itemSearch.toLowerCase())
        );
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: '#FFF', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 14 }}>Add Item to Table {addItemModal.tableNumber}</h3>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>Select Item</label>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={itemSearch}
                  onChange={e => { setItemSearch(e.target.value); setSelectedItem(''); }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #DDD', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {itemSearch && (
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 240, marginBottom: 14, border: '1px solid #EEE', borderRadius: 10 }}>
                  {filteredItems.length === 0 && (
                    <p style={{ padding: '16px 12px', color: '#999', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>No items found</p>
                  )}
                  {filteredItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => { setSelectedItem(item.id); setItemSearch(item.name); }}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #F5F5F5',
                        background: selectedItem === item.id ? '#FFF0EA' : '#FFF',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = selectedItem === item.id ? '#FFF0EA' : '#F9F9F9'}
                      onMouseLeave={e => e.currentTarget.style.background = selectedItem === item.id ? '#FFF0EA' : '#FFF'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{item.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35' }}>₹{item.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!itemSearch && (
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 240, marginBottom: 14, border: '1px solid #EEE', borderRadius: 10 }}>
                  {menuItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => { setSelectedItem(item.id); setItemSearch(item.name); }}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #F5F5F5',
                        background: selectedItem === item.id ? '#FFF0EA' : '#FFF',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = selectedItem === item.id ? '#FFF0EA' : '#F9F9F9'}
                      onMouseLeave={e => e.currentTarget.style.background = selectedItem === item.id ? '#FFF0EA' : '#FFF'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{item.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35' }}>₹{item.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>Quantity</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setItemQty(Math.max(1, itemQty - 1))}
                    style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #DDD', background: '#FFF', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>-</button>
                  <span style={{ fontSize: 18, fontWeight: 800, minWidth: 30, textAlign: 'center' }}>{itemQty}</span>
                  <button onClick={() => setItemQty(itemQty + 1)}
                    style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #DDD', background: '#FFF', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>+</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setAddItemModal({ open: false, orderId: null, tableNumber: null }); setSelectedItem(''); setItemQty(1); setItemSearch(''); }}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #DDD', background: '#FFF', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAddItem} disabled={!selectedItem}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: selectedItem ? '#FF6B35' : '#DDD', color: '#FFF', fontWeight: 700, fontSize: 14, cursor: selectedItem ? 'pointer' : 'not-allowed' }}>Add Item</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function MyTableCard({ table, onRelease, onCompleteOrder, onAddItem, onDismissCall }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="card" style={{ padding: 24, borderLeft: '4px solid #1DB954' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 14,
            background: 'linear-gradient(135deg, #1DB954, #15A34A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color: '#FFF'
          }}>
            {table.table_number}
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Table {table.table_number}</h3>
            <p style={{ fontSize: 12, color: '#1DB954', margin: '2px 0 0', fontWeight: 700 }}>Serving</p>
          </div>
        </div>
        <button onClick={() => onRelease(table.table_number)}
          style={{ background: '#FFF5F5', border: '1px solid #FFCDD2', color: '#E53935', padding: '8px 14px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          Release
        </button>
      </div>

      {table.call_waiter && (
        <div style={{
          background: 'linear-gradient(135deg, #FFF8E1, #FFECB3)',
          border: '2px solid #FFD54F',
          borderRadius: 14, padding: '14px 16px', marginBottom: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🔔</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#E65100' }}>Customer Needs You!</div>
              <div style={{ fontSize: 12, color: '#BF360C', fontWeight: 600 }}>Table {table.table_number} is calling</div>
            </div>
          </div>
          <button onClick={() => onDismissCall(table.table_number)}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: '#FF6B35', color: '#FFF', fontWeight: 800, fontSize: 13,
              cursor: 'pointer'
            }}>
            Dismiss ✓
          </button>
        </div>
      )}

      {table.orders.filter(o => o.status !== 'completed').map(order => (
        <div key={order.id} style={{ background: '#F9F9F9', borderRadius: 14, padding: 16, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: order.status === 'pending' ? '#FFF3E0' : '#E8F5E9',
                color: order.status === 'pending' ? '#FF6B35' : '#1DB954'
              }}>
                {order.status === 'pending' ? '⏳ New Order' : '👤 In Progress'}
              </span>
              <button onClick={() => onAddItem(order.id)}
                style={{ width: 28, height: 28, borderRadius: 8, background: '#FF6B35', color: '#FFF', border: 'none', fontSize: 18, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                +
              </button>
            </div>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#FF6B35' }}>₹{order.total_amount}</span>
          </div>

          {order.items?.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < order.items.length - 1 ? '1px solid #EEE' : 'none' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{item.quantity}x {item.name}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#888' }}>₹{item.price * item.quantity}</span>
            </div>
          ))}

          <button onClick={async () => {
              const result = await Swal.fire({
                title: 'Order Served?',
                text: 'Mark this order as completed',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#1DB954',
                cancelButtonColor: '#666',
                confirmButtonText: 'Yes, served!'
              });
              if (result.isConfirmed) {
                onCompleteOrder(order.id);
                Swal.fire({
                  title: 'Completed!',
                  text: 'Order has been marked as served.',
                  icon: 'success',
                  timer: 1500,
                  showConfirmButton: false
                });
              }
            }}
            style={{
              width: '100%', marginTop: 12, padding: '12px', background: '#1DB954', color: '#FFF',
              border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer'
            }}>
            ✅ Order Served
          </button>
        </div>
      ))}
    </div>
  );
}

function AvailableTableCard({ table, onClaim }) {
  return (
    <div className="card" style={{ padding: 24, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #FF6B35' }}
      onClick={() => onClaim(table.table_number)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
        <div style={{
          width: 55, height: 55, borderRadius: 16,
          background: 'linear-gradient(135deg, #FF6B35, #E85A20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 900, color: '#FFF', flexShrink: 0
        }}>
          {table.table_number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>Table {table.table_number}</h3>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0', fontWeight: 600 }}>
            {table.orders.length} order{table.orders.length !== 1 ? 's' : ''} • ₹{table.total_amount}
          </p>
        </div>
        <div style={{ fontSize: 20, color: '#FF6B35' }}>→</div>
      </div>
    </div>
  );
}
