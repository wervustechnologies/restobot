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
      <>
        <style>{`
          .wishlist-page { width: 100%; min-height: 100vh; background: #F9F9F9; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 20px; }
          .wishlist-page .order-success-icon { font-size: 64px; margin-bottom: 16px; }
          .wishlist-page .order-success-title { font-size: 26px; font-weight: 900; color: #1A1A1A; text-align: center; margin-bottom: 8px; }
          .wishlist-page .order-success-subtitle { color: #666; font-size: 15px; text-align: center; margin-bottom: 8px; font-weight: 600; }
          .wishlist-page .order-success-hint { color: #FF6B35; font-size: 13px; text-align: center; margin-bottom: 24px; font-weight: 700; }
          .wishlist-page .order-summary-card { background: #FFF; border-radius: 20px; padding: 20px; width: 100%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
          .wishlist-page .order-summary-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; }
          .wishlist-page .order-summary-row:not(:last-child) { border-bottom: 1px solid #F5F5F5; margin-bottom: 12px; padding-bottom: 12px; }
          .wishlist-page .order-summary-label { font-size: 15px; font-weight: 700; color: #888; }
          .wishlist-page .order-summary-value { font-size: 15px; font-weight: 900; color: #1A1A1A; }
          .wishlist-page .order-summary-total-value { font-size: 20px; font-weight: 900; color: #FF6B35; }
          .wishlist-page .order-success-btn { margin-top: 24px; width: 100%; max-width: 400px; padding: 16px; background: #FF6B35; color: #FFF; border: none; border-radius: 16px; font-size: 16px; font-weight: 800; cursor: pointer; }
          @media (max-width: 380px) {
            .wishlist-page { padding: 20px 16px; }
            .wishlist-page .order-success-icon { font-size: 52px; margin-bottom: 12px; }
            .wishlist-page .order-success-title { font-size: 22px; }
            .wishlist-page .order-success-subtitle { font-size: 14px; }
            .wishlist-page .order-summary-card { padding: 16px; }
          }
        `}</style>
        <div className="wishlist-page">
          <div className="order-success-icon">✅</div>
          <h1 className="order-success-title">Order Submitted!</h1>
          <p className="order-success-subtitle">
            Your order for Table {wishlist?.table_number} has been sent to the kitchen.
          </p>
          <p className="order-success-hint">
            A waiter will be with you shortly.
          </p>
          <div className="order-summary-card">
            <div className="order-summary-row">
              <span className="order-summary-label">Table</span>
              <span className="order-summary-value">{wishlist?.table_number}</span>
            </div>
            <div className="order-summary-row">
              <span className="order-summary-label">Items</span>
              <span className="order-summary-value">{wishlist?.items?.length}</span>
            </div>
            <div className="order-summary-row">
              <span className="order-summary-label">Total</span>
              <span className="order-summary-total-value">₹{wishlist?.total_amount}</span>
            </div>
          </div>
          <button className="order-success-btn" onClick={() => navigate(`/menu?rid=${rid}&t=${qrToken}`)}>
            Back to Menu
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        .wishlist-page { width: 100%; min-height: 100vh; background: var(--bg, #F9F9F9); padding: 24px 20px 40px; }
        .wishlist-page .wl-header { text-align: center; margin-bottom: 28px; }
        .wishlist-page .wl-header-icon { font-size: 52px; margin-bottom: 12px; }
        .wishlist-page .wl-header-title { font-size: 28px; font-weight: 900; color: var(--text, #1A1A1A); letter-spacing: -1px; }
        .wishlist-page .wl-header-table { color: #FF6B35; font-weight: 800; font-size: 15px; margin-top: 6px; }
        .wishlist-page .wl-device-badge { background: var(--surface-alt, #EEE); color: var(--text-muted, #666); padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-block; margin-top: 8px; }
        .wishlist-page .wl-card { padding: 20px; border-radius: 20px; background: var(--card-bg, #FFF); box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid var(--card-border, #EEE); }
        .wishlist-page .wl-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid var(--border, #F5F5F5); }
        .wishlist-page .wl-card-title { font-size: 18px; font-weight: 900; color: var(--text, #1A1A1A); }
        .wishlist-page .wl-card-count { background: #FFF0EA; color: #FF6B35; padding: 4px 10px; border-radius: 10px; font-size: 13px; font-weight: 800; }
        .wishlist-page .wl-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; gap: 12px; }
        .wishlist-page .wl-item:not(:last-child) { border-bottom: 1px solid var(--border, #F5F5F5); }
        .wishlist-page .wl-item-left { display: flex; gap: 10px; align-items: center; min-width: 0; flex: 1; }
        .wishlist-page .wl-item-dot { width: 8px; height: 8px; border-radius: 50%; background: #FF6B35; flex-shrink: 0; }
        .wishlist-page .wl-item-info { min-width: 0; }
        .wishlist-page .wl-item-name { font-size: 16px; font-weight: 800; color: var(--text, #1A1A1A); display: block; }
        .wishlist-page .wl-item-qty { font-size: 12px; color: var(--text-muted, #888); font-weight: 600; }
        .wishlist-page .wl-item-price { font-weight: 900; font-size: 16px; color: var(--text, #1A1A1A); white-space: nowrap; }
        .wishlist-page .wl-total-bar { display: flex; justify-content: space-between; margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #FF6B35 0%, #E85A20 100%); border-radius: 16px; color: #FFF; align-items: center; }
        .wishlist-page .wl-total-label { font-size: 16px; font-weight: 700; }
        .wishlist-page .wl-total-value { font-size: 22px; font-weight: 900; }
        .wishlist-page .wl-actions { margin-top: 28px; display: flex; flex-direction: column; gap: 12px; }
        .wishlist-page .wl-btn-submit { width: 100%; padding: 16px; font-size: 15px; }
        .wishlist-page .wl-btn-edit { width: 100%; padding: 16px; font-size: 15px; background: var(--surface, #FFF); color: #FF6B35; border: 2px solid #FF6B35; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .wishlist-page .wl-btn-edit:hover { background: #FFF0EA; }
        .wishlist-page .wl-btn-back { width: 100%; background: none; border: none; color: var(--text-muted, #888); font-weight: 700; font-size: 13px; cursor: pointer; padding: 8px; }
        @media (max-width: 380px) {
          .wishlist-page { padding: 20px 16px 32px; }
          .wishlist-page .wl-header-icon { font-size: 44px; }
          .wishlist-page .wl-header-title { font-size: 24px; }
          .wishlist-page .wl-card { padding: 16px; border-radius: 16px; }
          .wishlist-page .wl-item-name { font-size: 14px; }
          .wishlist-page .wl-item-price { font-size: 14px; }
          .wishlist-page .wl-total-bar { padding: 14px; }
          .wishlist-page .wl-total-label { font-size: 14px; }
          .wishlist-page .wl-total-value { font-size: 18px; }
        }
      `}</style>
      <div className="wishlist-page">
        <div className="wl-header">
          <div className="wl-header-icon">📋</div>
          <h1 className="wl-header-title">My Selections</h1>
          <p className="wl-header-table">Table {wishlist?.table_number}</p>
          {guest?.guest_id && (
            <div className="wl-device-badge">Device ID: {guest.guest_id.substring(0, 8)}</div>
          )}
        </div>
        
        <div className="wl-card">
          <div className="wl-card-header">
            <h3 className="wl-card-title">Selected Items</h3>
            <span className="wl-card-count">{wishlist?.items?.length} Items</span>
          </div>

          {wishlist?.items?.map((item, idx) => (
            <div key={idx} className="wl-item">
              <div className="wl-item-left">
                <div className="wl-item-dot" />
                <div className="wl-item-info">
                  <span className="wl-item-name">{item.name}</span>
                  <div className="wl-item-qty">Qty: {item.quantity}</div>
                </div>
              </div>
              <span className="wl-item-price">₹{item.price * item.quantity}</span>
            </div>
          ))}

          <div className="wl-total-bar">
            <span className="wl-total-label">Estimated Total</span>
            <span className="wl-total-value">₹{wishlist?.total_amount}</span>
          </div>
        </div>

        <div className="wl-actions">
          <button 
            onClick={handleSubmitOrder} 
            disabled={submitting}
            className="btn-primary wl-btn-submit" 
            style={{ opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Submitting...' : 'Submit Order 🍽️'}
          </button>
          <button className="wl-btn-edit" onClick={handleEditSelection}>
            Edit Selection
          </button>
          <button className="wl-btn-back" onClick={handleEditSelection}>
            Return to Menu
          </button>
        </div>
      </div>
    </>
  );
}
