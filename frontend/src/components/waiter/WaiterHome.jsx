import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../apiConfig';
import Swal from 'sweetalert2';

export default function WaiterHome() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waiter, setWaiter] = useState(null);
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
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
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
          <button onClick={handleLogout}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#FFF', padding: '10px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Logout
          </button>
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
                <MyTableCard key={table.table_number} table={table} onRelease={handleReleaseTable} onCompleteOrder={handleCompleteOrder} />
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
    </div>
  );
}

function MyTableCard({ table, onRelease, onCompleteOrder }) {
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

      {table.orders.filter(o => o.status !== 'completed').map(order => (
        <div key={order.id} style={{ background: '#F9F9F9', borderRadius: 14, padding: 16, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: order.status === 'pending' ? '#FFF3E0' : '#E8F5E9',
              color: order.status === 'pending' ? '#FF6B35' : '#1DB954'
            }}>
              {order.status === 'pending' ? '⏳ New Order' : '👤 In Progress'}
            </span>
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
