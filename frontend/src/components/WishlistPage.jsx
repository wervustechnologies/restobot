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
      // Sync this to the active cart in DB so MenuPage picks it up
      await fetch(`${API}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          restaurant_id: rid, 
          guest_id: guest?.guest_id, 
          cart: newCart 
        })
      });
      // Also clear local original_cart just in case, though MenuPage will fetch fresh
      localStorage.removeItem('original_cart');
    }
    navigate(`/menu?rid=${rid}&t=${qrToken}&wid=${wishlistId}`);
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loader" /></div>;

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
        <button className="btn-primary" onClick={handleEditSelection} style={{ width: '100%', padding: '20px', fontSize: 16 }}>
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
