import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useGuest } from '../context/GuestContext';
import { API_BASE_URL as API } from '../apiConfig';


export default function WishlistPage() {
  const { wishlistId } = useParams();
  const [searchParams] = useSearchParams();
  const rid = searchParams.get('rid');
  const qrToken = searchParams.get('t');
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { guest } = useGuest();

  useEffect(() => {
    const fetchWishlist = () => {
      if (!rid) return;
      fetch(`${API}/wishlist/${rid}/${wishlistId}`)
        .then(r => r.json())
        .then(d => { setWishlist(d); setLoading(false); })
        .catch(() => setLoading(false));
    };
    fetchWishlist();
  }, [wishlistId, rid]);

  const handleEditSelection = async () => {
    if (wishlist && wishlist.items) {
      const newCart = {};
      wishlist.items.forEach(item => {
        newCart[item.menu_item_id] = item.quantity;
      });
      await fetch(`${API}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          restaurant_id: rid, 
          guest_id: guest?.guest_id, 
          cart: newCart 
        })
      });
      localStorage.removeItem('original_cart');
    }
    navigate(`/menu?rid=${rid}&t=${qrToken}&wid=${wishlistId}`);
  };

  const handleSubmitOrder = async () => {
    if (!wishlist || !wishlist.items) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: rid,
          items: wishlist.items,
          total_amount: wishlist.total_amount,
          qr_token: qrToken,
          guest_id: guest?.guest_id
        })
      });
      const data = await res.json();
      if (data.success) {
        if (guest?.guest_id && rid) {
          await fetch(`${API}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurant_id: rid, guest_id: guest.guest_id, cart: {} })
          });
        }
        localStorage.removeItem('original_cart');
        setOrderSubmitted(true);
      } else {
        console.error('Order failed:', data.error);
        alert('Failed to submit order: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to submit order:', err);
      alert('Failed to submit order. Please try again.');
    }
    setSubmitting(false);
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loader" /></div>;

  if (orderSubmitted) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', padding: '40px 20px', background: '#F9F9F9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 80, marginBottom: 20 }}>✅</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A1A', textAlign: 'center', marginBottom: 10 }}>Order Submitted!</h1>
        <p style={{ color: '#666', fontSize: 16, textAlign: 'center', marginBottom: 10, fontWeight: 600 }}>
          Your order for Table {wishlist?.table_number} has been sent to the kitchen.
        </p>
        <p style={{ color: '#FF6B35', fontSize: 14, textAlign: 'center', marginBottom: 30, fontWeight: 700 }}>
          A waiter will be with you shortly.
        </p>
        <div style={{ background: '#FFF', borderRadius: 20, padding: 24, width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15, paddingBottom: 15, borderBottom: '1px solid #F5F5F5' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#888' }}>Table</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A' }}>{wishlist?.table_number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15, paddingBottom: 15, borderBottom: '1px solid #F5F5F5' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#888' }}>Items</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A' }}>{wishlist?.items?.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#888' }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#FF6B35' }}>₹{wishlist?.total_amount}</span>
          </div>
        </div>
        <button onClick={() => navigate(`/menu?rid=${rid}&t=${qrToken}`)} style={{ marginTop: 30, width: '100%', padding: '16px', background: '#FF6B35', color: '#FFF', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', padding: '40px 20px', background: '#F9F9F9' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 60, marginBottom: 15 }}>📋</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1A1A1A', letterSpacing: '-1px' }}>My Selections</h1>
        <p style={{ color: '#FF6B35', fontWeight: 800, fontSize: 16 }}>Table {wishlist?.table_number}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          {guest?.points > 0 && (
            <div style={{ background: '#FF6B35', color: '#FFF', padding: '5px 15px', borderRadius: 20, fontSize: 14, fontWeight: 900 }}>
              ⭐ {guest.points} POINTS
            </div>
          )}
          {guest?.guest_id && (
            <div style={{ background: '#EEE', color: '#666', padding: '5px 15px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              Device ID: {guest.guest_id.substring(0, 8)}
            </div>
          )}
        </div>
        <p style={{ color: '#000', fontSize: 13, marginTop: 15, fontWeight: 700 }}>Show this list to your waiter to place your order</p>
      </div>
      
      <div className="card" style={{ 
        padding: 30, 
        borderRadius: 24, 
        background: '#FFF', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
        border: '1px solid #EEE'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, borderBottom: '2px solid #F5F5F5', paddingBottom: 15 }}>
          <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>Selected Items</h3>
          <span style={{ background: '#FFF0EA', color: '#FF6B35', padding: '4px 12px', borderRadius: 10, fontSize: 14, fontWeight: 800 }}>
            {wishlist?.items?.length} Items
          </span>
        </div>

        {wishlist?.items?.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #F5F5F5' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF6B35' }} />
              <div>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1A' }}>{item.name}</span>
                <div style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>Qty: {item.quantity}</div>
              </div>
            </div>
            <span style={{ fontWeight: 900, fontSize: 18, color: '#1A1A1A' }}>₹{item.price * item.quantity}</span>
          </div>
        ))}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: 30, 
          padding: '20px', 
          background: 'linear-gradient(135deg, #FF6B35 0%, #E85A20 100%)',
          borderRadius: 18,
          color: '#FFF'
        }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Estimated Total</span>
          <span style={{ fontSize: 24, fontWeight: 900 }}>₹{wishlist?.total_amount}</span>
        </div>
      </div>

      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 15 }}>
        <button 
          onClick={handleSubmitOrder} 
          disabled={submitting}
          className="btn-primary" 
          style={{ width: '100%', padding: '20px', fontSize: 16, opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Submitting...' : 'Submit Order 🍽️'}
        </button>
        <button className="btn-primary" onClick={handleEditSelection} style={{ width: '100%', padding: '20px', fontSize: 16, background: '#FFF', color: '#FF6B35', border: '2px solid #FF6B35' }}>
          Edit Selection
        </button>
        <button 
          onClick={handleEditSelection}
          style={{ width: '100%', background: 'none', border: 'none', color: '#888', fontWeight: 700, fontSize: 14 }}
        >
          Return to Menu
        </button>
      </div>
    </div>
  );
}
