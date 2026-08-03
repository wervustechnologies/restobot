import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../apiConfig';
import { useInvalidation } from '../../hooks/useInvalidation';
import { useTheme } from '../../context/ThemeContext';
import Swal from 'sweetalert2';

export default function WaiterHome() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waiter, setWaiter] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [addItemModal, setAddItemModal] = useState({ open: false, tableNumber: null, guestId: null, userName: '' });
  const [selectedItem, setSelectedItem] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemSearch, setItemSearch] = useState('');
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const waiterRid = localStorage.getItem('waiter_rid');

  // ── New-order alert: sound + popup ──
  const seenOrderIds = useRef(new Set());
  const firstLoadDone = useRef(false);
  const audioCtxRef = useRef(null);
  const [orderAlert, setOrderAlert] = useState(null);

  const playNewOrderSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      // Two-tone ascending "ding"
      [[880, 0], [1320, 0.18]].forEach(([freq, start]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + 0.36);
      });
    } catch { /* audio unavailable */ }
  };

  // Unlock audio on the first user gesture (browser autoplay policy).
  useEffect(() => {
    const unlock = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && !audioCtxRef.current) audioCtxRef.current = new AudioCtx();
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      } catch { /* ignore */ }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Auto-dismiss the new-order banner.
  useEffect(() => {
    if (!orderAlert) return;
    const t = setTimeout(() => setOrderAlert(null), 8000);
    return () => clearTimeout(t);
  }, [orderAlert]);

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

      // ── New-order detection (sound + popup) ──
      const list = Array.isArray(data) ? data : [];
      const ids = list.flatMap(t => (t.orders || []).map(o => o.id));
      if (!firstLoadDone.current) {
        // First load: record existing orders without alerting.
        ids.forEach(id => seenOrderIds.current.add(id));
        firstLoadDone.current = true;
      } else {
        const fresh = [];
        list.forEach(t => (t.orders || []).forEach(o => {
          if (!seenOrderIds.current.has(o.id) && o.status === 'pending') {
            fresh.push({ table: t.table_number, order: o });
          }
        }));
        ids.forEach(id => seenOrderIds.current.add(id));
        if (fresh.length > 0) {
          playNewOrderSound();
          setOrderAlert({ id: Date.now(), fresh });
        }
      }
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
    setLoading(false);
  };

  useInvalidation(waiterRid ? `restaurants/${waiterRid}/_rev` : null, fetchTables);

  useEffect(() => {
    fetchTables();
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
    if (!selectedItem || !addItemModal.tableNumber) return;

    const item = menuItems.find(m => m.id === selectedItem);
    if (!item) return;

    try {
      // Waiter-added items create a brand-new pending order attributed to the
      // selected customer (same as a guest follow-up order), not an append to
      // an existing order. The waiter then serves/completes it normally.
      const res = await fetch(`${API_BASE_URL}/orders/waiter-add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          table_number: addItemModal.tableNumber,
          guest_id: addItemModal.guestId || '',
          user_name: addItemModal.userName || '',
          items: [{ name: item.name, price: item.price, quantity: itemQty }]
        })
      });

      if (res.ok) {
        Swal.fire({ icon: 'success', title: 'Order Added!', text: 'New pending order created for this guest', timer: 1500, showConfirmButton: false });
        setAddItemModal({ open: false, tableNumber: null, guestId: null, userName: '' });
        setSelectedItem('');
        setItemQty(1);
        setItemSearch('');
        fetchTables();
      } else {
        const data = await res.json().catch(() => ({}));
        Swal.fire('Error', data.error || 'Failed to add item', 'error');
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

  const handleServeOrder = async (orderId) => {
    const token = localStorage.getItem('waiter_token');
    if (!token) return;

    try {
      await fetch(`${API_BASE_URL}/orders/${orderId}/serve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchTables();
    } catch (err) {
      console.error('Failed to serve order:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('waiter_token');
    localStorage.removeItem('waiter_user');
    localStorage.removeItem('waiter_rid');
    navigate('/waiter/login');
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header skeleton */}
      <div style={{
        background: 'linear-gradient(135deg, #FF6B35 0%, #E85A20 100%)',
        padding: '20px 24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skeleton skeleton-text lg" style={{ width: 200, marginBottom: 8, '--skeleton-base': 'rgba(255,255,255,0.2)', '--skeleton-shine': 'rgba(255,255,255,0.35)' }} />
            <div className="skeleton skeleton-text sm" style={{ width: 140, '--skeleton-base': 'rgba(255,255,255,0.15)', '--skeleton-shine': 'rgba(255,255,255,0.25)' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="skeleton skeleton-rect" style={{ width: 44, height: 40, '--skeleton-base': 'rgba(255,255,255,0.2)', '--skeleton-shine': 'rgba(255,255,255,0.35)' }} />
            <div className="skeleton skeleton-rect" style={{ width: 80, height: 40, '--skeleton-base': 'rgba(255,255,255,0.2)', '--skeleton-shine': 'rgba(255,255,255,0.35)' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {/* Section title skeleton */}
        <div className="skeleton skeleton-text md" style={{ width: 160, marginBottom: 15 }} />

        {/* Table cards skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 15, marginBottom: 30 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton-card" style={{ padding: 24, borderLeft: '4px solid var(--border)' }}>
              <div className="skeleton-row" style={{ marginBottom: 15 }}>
                <div className="skeleton skeleton-rect" style={{ width: 50, height: 50, borderRadius: 14, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-text md" style={{ width: '55%', marginBottom: 6 }} />
                  <div className="skeleton skeleton-text sm" style={{ width: '35%' }} />
                </div>
                <div className="skeleton skeleton-rect" style={{ width: 70, height: 32 }} />
              </div>

              {/* Order group skeleton */}
              <div style={{ background: 'var(--surface-alt)', borderRadius: 14, padding: 16, marginBottom: 10 }}>
                <div className="skeleton-row" style={{ marginBottom: 12 }}>
                  <div className="skeleton skeleton-rect" style={{ width: 32, height: 32, borderRadius: 10 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-text" style={{ width: '50%', marginBottom: 4 }} />
                    <div className="skeleton skeleton-text sm" style={{ width: '30%' }} />
                  </div>
                  <div className="skeleton skeleton-text" style={{ width: 50, height: 16 }} />
                </div>
                <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 12 }}>
                  {[1,2].map(j => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: j < 2 ? '1px solid var(--border)' : 'none' }}>
                      <div className="skeleton skeleton-text" style={{ width: `${40 + j * 15}%` }} />
                      <div className="skeleton skeleton-text sm" style={{ width: 50 }} />
                    </div>
                  ))}
                </div>
                <div className="skeleton skeleton-rect" style={{ width: '100%', height: 38, marginTop: 10 }} />
              </div>
              <div className="skeleton skeleton-rect" style={{ width: '100%', height: 42, marginTop: 4 }} />
            </div>
          ))}
        </div>

        {/* Available tables section skeleton */}
        <div className="skeleton skeleton-text md" style={{ width: 180, marginBottom: 15 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 15 }}>
          {[1,2].map(i => (
            <div key={i} className="skeleton-card" style={{ padding: 24, borderLeft: '4px solid var(--border)' }}>
              <div className="skeleton-row" style={{ marginBottom: 14 }}>
                <div className="skeleton skeleton-rect" style={{ width: 64, height: 64, borderRadius: 18, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-text md" style={{ width: '65%', marginBottom: 6 }} />
                  <div className="skeleton skeleton-text sm" style={{ width: '80%' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '2px solid var(--border)' }}>
                <div className="skeleton skeleton-text" style={{ width: 50, height: 15 }} />
                <div className="skeleton skeleton-text lg" style={{ width: 60 }} />
              </div>
              <div className="skeleton skeleton-rect" style={{ width: '100%', height: 44, marginTop: 14 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const myTables = tables.filter(t => t.locked_by === waiter?.id);
  const availableTables = tables.filter(t => !t.locked_by && (t.has_pending || t.call_waiter));
  const otherTables = tables.filter(t => t.locked_by && t.locked_by !== waiter?.id);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {orderAlert && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, width: '90%', maxWidth: 420, background: 'linear-gradient(135deg, #FF6B35, #E85A20)', color: '#FFF', borderRadius: 14, padding: '14px 16px', boxShadow: '0 12px 30px rgba(255,107,53,0.45)', animation: 'pulse 1.5s ease-in-out infinite' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: 15, fontWeight: 900 }}>🔔 New Order!</strong>
            <button onClick={() => setOrderAlert(null)} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#FFF', borderRadius: 8, padding: '4px 10px', fontWeight: 800, cursor: 'pointer' }}>Dismiss</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {orderAlert.fresh.map((f, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Table {f.table}</div>
                <div style={{ fontSize: 12, opacity: 0.95 }}>{(f.order.items || []).map(it => `${it.quantity}x ${it.name}`).join(', ') || 'New order'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.7 } }
        .waiter-modal {
          background: var(--surface);
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 400px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
        }
        @media (max-width: 640px) {
          .waiter-modal {
            width: 100% !important;
            max-width: none !important;
            height: 100vh !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            padding: 20px !important;
          }
          button {
            min-height: 48px;
          }
          .header-btn {
            min-height: 40px !important;
          }
          .qty-btn {
            min-height: 36px !important;
          }
        }
      `}</style>
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
            <button onClick={toggleTheme} className="header-btn"
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#FFF', padding: '10px 14px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {theme === 'light' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              )}
            </button>
            <button onClick={handleLogout} className="header-btn"
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
                <MyTableCard key={table.table_number} table={table} onRelease={handleReleaseTable} onCompleteOrder={handleCompleteOrder} onServeOrder={handleServeOrder} onAddItem={(guestId, userName) => { fetchMenuItems(); setAddItemModal({ open: true, tableNumber: table.table_number, guestId, userName }); }} onDismissCall={dismissCall} />
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
            <div className="waiter-modal">
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 14 }}>Add Item{addItemModal.userName ? ` for ${addItemModal.userName}` : ''} — Table {addItemModal.tableNumber}</h3>

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
                  <button onClick={() => setItemQty(Math.max(1, itemQty - 1))} className="qty-btn"
                    style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #DDD', background: '#FFF', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>-</button>
                  <span style={{ fontSize: 18, fontWeight: 800, minWidth: 30, textAlign: 'center' }}>{itemQty}</span>
                  <button onClick={() => setItemQty(itemQty + 1)} className="qty-btn"
                    style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #DDD', background: '#FFF', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>+</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setAddItemModal({ open: false, tableNumber: null, guestId: null, userName: '' }); setSelectedItem(''); setItemQty(1); setItemSearch(''); }}
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

function MyTableCard({ table, onRelease, onCompleteOrder, onServeOrder, onAddItem, onDismissCall }) {
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

      {(() => {
        const activeOrders = table.orders.filter(o => o.status !== 'completed' && o.status !== 'billed');
        if (activeOrders.length === 0) return null;

        // Group active orders by (guest_id, user_name). Two customers can share
        // a single device (same fingerprint -> same guest_id), so the name
        // snapshot captured at order time is what separates them. guest_id
        // alone would merge them; the composite key keeps each person distinct
        // and scopes each group's actions to only that person's orders.
        const byGuest = {};
        activeOrders.forEach(order => {
          const gid = order.guest_id || '';
          const uname = order.user_name || '';
          const key = `${gid}::${uname}`;
          if (!byGuest[key]) byGuest[key] = { key, guestId: gid, name: uname, orders: [] };
          byGuest[key].orders.push(order);
          if (!byGuest[key].name && uname) byGuest[key].name = uname;
        });

        const guestLabel = (g) => {
          if (g.name) return g.name;
          if (!g.guestId) return 'Table / Unassigned';
          return `Guest ${g.guestId.substring(0, 6)}`;
        };

        // Disambiguate duplicate names at the same table with a short id suffix.
        const labelCounts = {};
        Object.values(byGuest).forEach(g => {
          const l = guestLabel(g);
          labelCounts[l] = (labelCounts[l] || 0) + 1;
        });

        const statusConfig = {
          pending: { label: '⏳ New Order', bg: '#FFF3E0', color: '#FF6B35', btnBg: '#2196F3', btnLabel: '🍽️ Mark as Served' },
          claimed: { label: '👤 In Progress', bg: '#E8F5E9', color: '#1DB954', btnBg: '#2196F3', btnLabel: '🍽️ Mark as Served' },
          served: { label: '🍽️ Served', bg: '#E3F2FD', color: '#2196F3', btnBg: '#1DB954', btnLabel: '🏁 Complete' }
        };

        return Object.values(byGuest).map(group => {
          // Within a guest, sub-group by status so per-status serve/complete
          // still works alongside the per-guest bulk complete.
          const byStatus = {};
          group.orders.forEach(order => {
            const st = order.status;
            if (!byStatus[st]) byStatus[st] = { status: st, items: {}, total: 0, orderIds: [], orderCount: 0 };
            byStatus[st].orderIds.push(order.id);
            byStatus[st].orderCount++;
            (order.items || []).forEach(item => {
              const key = item.name;
              if (byStatus[st].items[key]) {
                byStatus[st].items[key].quantity += item.quantity;
                byStatus[st].items[key].total += item.price * item.quantity;
              } else {
                byStatus[st].items[key] = { name: item.name, quantity: item.quantity, price: item.price, total: item.price * item.quantity };
              }
              byStatus[st].total += item.price * item.quantity;
            });
          });

          const guestTotal = group.orders.reduce((s, o) => s + (o.items || []).reduce((ss, it) => ss + it.price * it.quantity, 0), 0);
          const allOrderIds = group.orders.map(o => o.id);

          const baseLabel = guestLabel(group);
          const dupSuffix = labelCounts[baseLabel] > 1 && group.guestId ? ` #${group.guestId.substring(0, 4)}` : '';
          const displayLabel = baseLabel + dupSuffix;
          const initial = ((group.name || '?').trim().charAt(0) || '?').toUpperCase();

          return (
            <div key={group.key} style={{ background: '#F9F9F9', borderRadius: 14, padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: 'linear-gradient(135deg, #FF6B35, #E85A20)',
                    color: '#FFF', fontSize: 14, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {initial}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A' }}>{displayLabel}</div>
                    <div style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>{group.orders.length} order{group.orders.length > 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#FF6B35' }}>₹{guestTotal}</span>
                  <button onClick={() => onAddItem(group.guestId, group.name)}
                    title="Add item to this guest"
                    style={{ width: 28, height: 28, borderRadius: 8, background: '#FF6B35', color: '#FFF', border: 'none', fontSize: 18, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                    +
                  </button>
                </div>
              </div>

              {Object.values(byStatus).map(sg => {
                const cfg = statusConfig[sg.status] || statusConfig.pending;
                const items = Object.values(sg.items);
                return (
                  <div key={sg.status} style={{ marginBottom: 10, background: '#FFF', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                        {cfg.label} {sg.orderCount > 1 ? `(${sg.orderCount})` : ''}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#888' }}>₹{sg.total}</span>
                    </div>

                    {items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < items.length - 1 ? '1px solid #EEE' : 'none' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{item.quantity}x {item.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#888' }}>₹{item.total}</span>
                      </div>
                    ))}

                    <button onClick={async () => {
                        if (sg.status === 'served') {
                          const result = await Swal.fire({
                            title: 'Mark as Completed?',
                            text: `Mark ${sg.orderCount > 1 ? sg.orderCount + ' orders' : 'this order'} for ${displayLabel} as completed`,
                            icon: 'question', showCancelButton: true,
                            confirmButtonColor: '#1DB954', cancelButtonColor: '#666', confirmButtonText: 'Yes, complete!'
                          });
                          if (result.isConfirmed) {
                            for (const oid of sg.orderIds) { await onCompleteOrder(oid); }
                            Swal.fire({ title: 'Completed!', icon: 'success', timer: 1500, showConfirmButton: false });
                          }
                        } else {
                          const result = await Swal.fire({
                            title: 'Mark as Served?',
                            text: `Mark ${sg.orderCount > 1 ? sg.orderCount + ' orders' : 'this order'} for ${displayLabel} as served`,
                            icon: 'question', showCancelButton: true,
                            confirmButtonColor: '#2196F3', cancelButtonColor: '#666', confirmButtonText: 'Yes, served!'
                          });
                          if (result.isConfirmed) {
                            for (const oid of sg.orderIds) { await onServeOrder(oid); }
                            Swal.fire({ title: 'Served!', icon: 'success', timer: 1500, showConfirmButton: false });
                          }
                        }
                      }}
                      style={{ width: '100%', marginTop: 10, padding: '10px', background: cfg.btnBg, color: '#FFF', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                      {cfg.btnLabel}
                    </button>
                  </div>
                );
              })}

              <button onClick={async () => {
                  const result = await Swal.fire({
                    title: 'Complete all orders?',
                    text: `Mark all of ${displayLabel}'s active orders as completed`,
                    icon: 'question', showCancelButton: true,
                    confirmButtonColor: '#1DB954', cancelButtonColor: '#666', confirmButtonText: 'Yes, complete all!'
                  });
                  if (result.isConfirmed) {
                    for (const oid of allOrderIds) { await onCompleteOrder(oid); }
                    Swal.fire({ title: 'Completed!', icon: 'success', timer: 1500, showConfirmButton: false });
                  }
                }}
                style={{ width: '100%', marginTop: 4, padding: '12px', background: '#1DB954', color: '#FFF', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                🏁 Mark all Complete
              </button>
            </div>
          );
        });
      })()}

      {table.orders.filter(o => o.status === 'completed' || o.status === 'billed').length > 0 && (() => {
        const completedOrders = table.orders.filter(o => o.status === 'completed' || o.status === 'billed');
        const mergedItems = {};
        let mergedTotal = 0;
        completedOrders.forEach(order => {
          (order.items || []).forEach(item => {
            const key = item.name;
            if (mergedItems[key]) {
              mergedItems[key].quantity += item.quantity;
              mergedItems[key].total += item.price * item.quantity;
            } else {
              mergedItems[key] = { name: item.name, quantity: item.quantity, price: item.price, total: item.price * item.quantity };
            }
            mergedTotal += item.price * item.quantity;
          });
        });
        return (
          <div style={{ background: '#F5FFF5', borderRadius: 14, padding: 16, marginTop: 15, marginBottom: 10 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#1DB954' }}>✅ Completed Orders ({completedOrders.length})</h4>
            {Object.values(mergedItems).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: idx < Object.values(mergedItems).length - 1 ? '1px dashed #DDD' : 'none' }}>
                <span style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>{item.quantity}x {item.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>₹{item.total}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>Table Grand Total</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#1DB954' }}>₹{table.total_amount}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function AvailableTableCard({ table, onClaim }) {
  const activeOrders = (table.orders || []).filter(o => o.status === 'pending' || o.status === 'claimed' || o.status === 'served');
  const pendingCount = table.pending_count || 0;
  const servedCount = table.served_count || 0;

  let statusText = '';
  let statusColor = '#FF6B35';
  if (table.call_waiter) {
    statusText = '🔔 Customer is calling!';
    statusColor = '#FF1744';
  } else if (pendingCount > 0) {
    statusText = `${pendingCount} order${pendingCount !== 1 ? 's' : ''} pending`;
    statusColor = '#FF6B35';
  } else if (servedCount > 0) {
    statusText = `${servedCount} order${servedCount !== 1 ? 's' : ''} served — tap to complete`;
    statusColor = '#2196F3';
  }

  return (
    <div className="card" style={{ padding: 24, cursor: 'pointer', transition: 'all 0.2s', borderLeft: `4px solid ${statusColor}`, position: 'relative' }}
      onClick={() => onClaim(table.table_number)}>

      {table.call_waiter && (
        <div style={{
          position: 'absolute', top: -10, right: 16,
          background: 'linear-gradient(135deg, #FF1744, #D50000)',
          color: '#FFF', padding: '6px 14px', borderRadius: 20,
          fontSize: 12, fontWeight: 800, boxShadow: '0 4px 15px rgba(255,23,68,0.4)',
          animation: 'pulse 1.5s ease-in-out infinite', zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 5
        }}>
          🔔 CALLING
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, marginTop: table.call_waiter ? 8 : 0 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: table.call_waiter
            ? 'linear-gradient(135deg, #FF1744, #D50000)'
            : 'linear-gradient(135deg, #FF6B35, #E85A20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 900, color: '#FFF', flexShrink: 0,
          boxShadow: table.call_waiter
            ? '0 6px 20px rgba(255,23,68,0.4)'
            : '0 6px 20px rgba(255,107,53,0.3)',
          animation: table.call_waiter ? 'pulse 1.5s ease-in-out infinite' : 'none'
        }}>
          {table.table_number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Table {table.table_number}</h3>
          <p style={{ fontSize: 13, color: statusColor, margin: '4px 0 0', fontWeight: 700 }}>
            {statusText}
          </p>
        </div>
      </div>
      {activeOrders.length > 0 && (
        <div style={{ background: table.call_waiter ? '#FFF0F0' : '#FFF5F0', borderRadius: 12, padding: 12, marginBottom: 14 }}>
          {activeOrders.slice(0, 3).map((order, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>
                {order.items?.map(i => `${i.quantity}x ${i.name}`).join(', ')}
              </span>
            </div>
          ))}
          {activeOrders.length > 3 && (
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0', fontWeight: 600 }}>
              +{activeOrders.length - 3} more order{activeOrders.length - 3 > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '2px solid #F5F5F5' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#555' }}>Total</span>
        <span style={{ fontSize: 22, fontWeight: 900, color: '#FF6B35' }}>₹{table.active_total ?? table.total_amount}</span>
      </div>
      <div style={{
        marginTop: 14, padding: '14px', borderRadius: 12,
        background: table.call_waiter
          ? 'linear-gradient(135deg, #FF1744, #D50000)'
          : 'linear-gradient(135deg, #FF6B35, #E85A20)',
        textAlign: 'center', color: '#FFF', fontWeight: 800, fontSize: 14
      }}>
        {table.call_waiter ? '👆 Tap to Respond & Serve' : '👆 Tap to Claim & Serve'}
      </div>
    </div>
  );
}
