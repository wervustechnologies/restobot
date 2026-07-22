import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ChatAssistant from './ChatAssistant';
import { useGuest } from '../context/GuestContext';
import { API_BASE_URL as API } from '../apiConfig';

export default function MenuPage() {
  const [data, setData] = useState(null);
  const [activeMainCategory, setActiveMainCategory] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState({});
  const [hasLoadedCart, setHasLoadedCart] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [orders, setOrders] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qrToken = searchParams.get('t');
  const wishlistId = searchParams.get('wid');
  const tableNum = searchParams.get('table');
  const restaurantId = searchParams.get('rid');
  const [resolvedTableNum, setResolvedTableNum] = useState(tableNum);
  const [lockInfo, setLockInfo] = useState(null);
  const { guest } = useGuest();

  // Load cart from DB
  useEffect(() => {
    if (guest?.guest_id && (restaurantId || data?.restaurant?.id)) {
      const rid = restaurantId || data?.restaurant?.id;
      fetch(`${API}/cart/${rid}/${guest.guest_id}`)
        .then(r => r.json())
        .then(d => {
          if (d && Object.keys(d).length > 0) {
            setCart(d);
          }
          setHasLoadedCart(true);
        })
        .catch(() => setHasLoadedCart(true));
    }
  }, [guest, restaurantId, data]);

  // Load original_cart comparison baseline from DB
  useEffect(() => {
    const rid = restaurantId || data?.restaurant?.id;
    if (wishlistId && rid) {
      fetch(`${API}/wishlist/${rid}/${wishlistId}`)
        .then(r => r.json())
        .then(d => {
          if (d.items) {
            const oc = {};
            d.items.forEach(i => {
              oc[String(i.menu_item_id)] = i.quantity;
            });
            setOriginalCart(oc);
          }
        });
    }
  }, [wishlistId, restaurantId, data]);

  const [originalCart, setOriginalCart] = useState(null);

  const isModified = React.useMemo(() => {
    // If we have a wishlistId but haven't loaded originalCart yet, wait
    if (wishlistId && !originalCart) return false;

    const baseline = originalCart || {};

    // Normalize both maps for comparison: { string_id: number_qty }
    const normalizedCart = {};
    Object.entries(cart).forEach(([k, v]) => {
      if (Number(v) > 0) normalizedCart[String(k)] = Number(v);
    });

    const normalizedOriginal = {};
    Object.entries(baseline).forEach(([k, v]) => {
      if (Number(v) > 0) normalizedOriginal[String(k)] = Number(v);
    });

    const cartKeys = Object.keys(normalizedCart).sort();
    const originalKeys = Object.keys(normalizedOriginal).sort();

    if (cartKeys.length !== originalKeys.length) return true;
    for (let i = 0; i < cartKeys.length; i++) {
      if (cartKeys[i] !== originalKeys[i]) return true;
      if (normalizedCart[cartKeys[i]] !== normalizedOriginal[cartKeys[i]]) return true;
    }
    return false;
  }, [cart, originalCart, wishlistId]);

  useEffect(() => {
    if (qrToken && (!restaurantId || !tableNum)) {
      fetch(`${API}/table/${qrToken}`)
        .then(r => r.json())
        .then(tData => {
          if (tData.restaurant_id) {
            setResolvedTableNum(tData.table_number);
            fetchMenu(tData.restaurant_id);
          }
        });
    } else {
      fetchMenu(restaurantId);
    }
  }, [restaurantId, qrToken, tableNum]);

  useEffect(() => {
    if (!qrToken) return;
    const interval = setInterval(() => {
      fetch(`${API}/table/${qrToken}/lock-status`)
        .then(r => r.json())
        .then(d => setLockInfo(d))
        .catch(() => {});
    }, 5000);
    fetch(`${API}/table/${qrToken}/lock-status`)
      .then(r => r.json())
      .then(d => setLockInfo(d))
      .catch(() => {});
    return () => clearInterval(interval);
  }, [qrToken]);

  const fetchMenu = (id) => {
    fetch(`${API}/menu/${id}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.main_categories?.length > 0) {
          const firstMain = d.main_categories[0];
          setActiveMainCategory(firstMain.id);
          if (firstMain.categories?.length > 0) {
            setActiveCategory(firstMain.categories[0].id);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (hasLoadedCart && guest?.guest_id && (restaurantId || data?.restaurant?.id)) {
      const rid = restaurantId || data?.restaurant?.id;
      fetch(`${API}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: rid, guest_id: guest.guest_id, cart })
      });
    }
  }, [cart, hasLoadedCart, guest, restaurantId, data]);

  // Load placed orders and poll for updates
  useEffect(() => {
    if (!guest?.guest_id || !(restaurantId || data?.restaurant?.id)) return;
    const rid = restaurantId || data?.restaurant?.id;
    const fetchOrders = () => {
      fetch(`${API}/orders/guest/${rid}/${guest.guest_id}`)
        .then(r => r.json())
        .then(d => setOrders(d.filter(o => o.status !== 'completed')))
        .catch(() => {});
    };
    fetchOrders();
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [guest, restaurantId, data]);

  const addItem = (item) => {
    setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  };
  const removeItem = (item) => {
    setCart(prev => {
      const qty = (prev[item.id] || 0) - 1;
      if (qty <= 0) { const next = { ...prev }; delete next[item.id]; return next; }
      return { ...prev, [item.id]: qty };
    });
  };

  const allItems = data?.main_categories?.flatMap(mc => mc.categories?.flatMap(c => c.items)) || [];
  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const item = allItems.find(i => i.id === id);
    return item ? { ...item, quantity: qty } : null;
  }).filter(Boolean);

  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  const saveWishlist = async () => {
    const res = await fetch(`${API}/wishlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qr_token: qrToken,
        restaurant_id: restaurantId || data?.restaurant?.id,
        items: cartItems.map(i => ({ menu_item_id: i.id, quantity: i.quantity, name: i.name, price: i.price })),
        total_amount: cartTotal
      })
    });
    const oData = await res.json();
    setOriginalCart(cart);
    if (oData.wishlist_id) navigate(`/wishlist/${oData.wishlist_id}?rid=${restaurantId || data?.restaurant?.id}&t=${qrToken}`);
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loader" /></div>;

  const activeMainCatObj = data?.main_categories?.find(mc => mc.id === activeMainCategory);
  const activeCat = activeMainCatObj?.categories?.find(c => c.id === activeCategory);

  return (
    <div style={{ width: '100%', minHeight: '100vh', paddingBottom: 120 }}>
      <ChatAssistant
        restaurantId={restaurantId || data?.restaurant?.id}
        initialMenuData={data}
        onAddToCart={addItem}
        onShowWishlist={() => setShowWishlist(true)}
        hideMascot={showWishlist}
      />

      {/* Header UI */}
      <div style={{
        padding: '24px 20px 24px',
        background: 'linear-gradient(135deg, #FF6B35 0%, #E85A20 100%)',
        borderRadius: '0 0 32px 32px',
        boxShadow: '0 10px 30px rgba(232,90,32,0.2)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.5px' }}>{data?.restaurant?.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <span style={{ width: 8, height: 8, background: '#FFF', borderRadius: '50%', opacity: 0.6 }} />
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>Table {resolvedTableNum}</p>
            </div>
            {lockInfo?.locked_by_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                  👨‍🍳 Being served by <b>{lockInfo.locked_by_name}</b>
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {data?.restaurant?.review_link && (
              <a href={data.restaurant.review_link} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(255,215,0,0.25)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,215,0,0.2)', padding: '10px 14px', borderRadius: 20, color: '#FFD700', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', textDecoration: 'none' }}>
                <span style={{ fontSize: 16 }}>⭐</span> Reviews
              </a>
            )}
            <button onClick={() => setShowOrders(true)} style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: 20, color: '#FFF', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <span style={{ fontSize: 18 }}>🍽️</span>
              <span style={{ background: orders.length > 0 ? '#FFF' : 'rgba(255,255,255,0.15)', color: orders.length > 0 ? '#FF6B35' : 'rgba(255,255,255,0.6)', borderRadius: 12, padding: '3px 8px', fontSize: 13, minWidth: 22, textAlign: 'center' }}>{orders.length}</span>
            </button>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '6px 12px',
              borderRadius: 16
            }}>
              <div style={{ width: 28, height: 28, background: '#FFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                👤
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Guest</span>
                <span style={{ fontSize: 12, color: '#FFF', fontWeight: 800 }}>#{guest?.guest_id?.substring(0, 6)}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Actions Row */}
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button onClick={async () => {
            const res = await fetch(`${API}/table/${qrToken}/call-waiter`, { method: 'POST' });
            if (res.ok) setLockInfo(prev => ({ ...prev, call_waiter: true, call_waiter_at: Date.now() }));
          }} style={{
            flex: 1, padding: '14px', borderRadius: 16, border: 'none',
            background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)',
            color: '#FFF', fontWeight: 900, fontSize: 15, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <span style={{ fontSize: 20 }}>🔔</span> Call Waiter
          </button>
          <button onClick={() => setShowFeedback(true)} style={{
            flex: 1, padding: '14px', borderRadius: 16, border: 'none',
            background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)',
            color: '#FFF', fontWeight: 900, fontSize: 15, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <span style={{ fontSize: 20 }}>💬</span> Give Feedback
          </button>
          {lockInfo?.call_waiter && (
            <div style={{
              padding: '10px 18px', borderRadius: 12,
              background: 'rgba(255,215,0,0.3)', backdropFilter: 'blur(10px)',
              color: '#FFD700', fontWeight: 800, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span>✅</span> Notified
            </div>
          )}
        </div>
      </div>

      {/* Main Categories Tabs */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 20px 10px', marginTop: 10 }} className="hide-scroll">
        {data?.main_categories?.map(mc => (
          <button key={mc.id} onClick={() => {
            setActiveMainCategory(mc.id);
            if (mc.categories?.length > 0) setActiveCategory(mc.categories[0].id);
            else setActiveCategory(null);
          }}
            style={{
              whiteSpace: 'nowrap', padding: '12px 22px', borderRadius: 16,
              fontSize: 15, fontWeight: 800, transition: 'all 0.2s',
              background: activeMainCategory === mc.id ? '#1A1A1A' : 'rgba(255,255,255,0.8)',
              color: activeMainCategory === mc.id ? '#fff' : '#444',
              boxShadow: activeMainCategory === mc.id ? '0 8px 20px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.03)',
              border: activeMainCategory === mc.id ? 'none' : '1px solid rgba(255,255,255,0.4)',
              flexShrink: 0
            }}>
            {mc.name}
          </button>
        ))}
      </div>

      {/* Sub Categories Tabs */}
      {activeMainCatObj?.categories?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 20px 20px' }} className="hide-scroll">
          {activeMainCatObj.categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              style={{
                whiteSpace: 'nowrap', padding: '8px 18px', borderRadius: 20,
                fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
                background: activeCategory === cat.id ? '#FF6B35' : 'rgba(255,107,53,0.05)',
                color: activeCategory === cat.id ? '#fff' : '#FF6B35',
                border: activeCategory === cat.id ? 'none' : '1px solid rgba(255,107,53,0.2)',
                flexShrink: 0
              }}>
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Recommendations UI */}
      {recommendations.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 }}>
            ✨ Recommended for You
          </h2>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 10 }} className="hide-scroll">
            {recommendations.map(item => (
              <div key={item.id} style={{ width: 150, flexShrink: 0, background: '#FFF', borderRadius: 16, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #EEE' }} onClick={() => addItem(item)}>
                <img src={item.image_url} style={{ width: '100%', height: 110, borderRadius: '16px 16px 0 0', objectFit: 'cover' }} />
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: '#FF6B35', fontWeight: 800, marginTop: 4 }}>₹{item.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items List */}
      <div style={{ padding: '0 20px' }}>
        {activeCat ? (
          <>
            <h2 style={{ fontSize: 13, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 }}>
              {activeCat.name}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {activeCat.items?.filter(item => item.is_enabled !== false)
                .sort((a, b) => {
                  const p = { high: 3, medium: 2, low: 1 };
                  return (p[b.priority] || 2) - (p[a.priority] || 2);
                })
                .map((item, i) => (
                  <MenuItemCard key={item.id} item={item} qty={cart[item.id] || 0}
                    onAdd={() => addItem(item)} onRemove={() => removeItem(item)} delay={i * 0.05} />
                ))}
              {(!activeCat.items || activeCat.items.length === 0) && (
                <p style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No items in this category yet.</p>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>Select a category to view items.</p>
        )}
      </div>

      {/* Wishlist component */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 20, left: 20, right: 20, zIndex: 100, animation: 'slideUp 0.3s ease' }}>
          <button onClick={() => setShowWishlist(true)} style={{ width: '100%', padding: '18px 24px', background: '#FF6B35', borderRadius: 18, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(255,107,53,0.4)', fontWeight: 800, border: 'none' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '4px 10px', fontSize: 13 }}>{cartCount}</span>
            <span style={{ fontSize: 16 }}>View Selections</span>
            <span style={{ fontSize: 16 }}>₹{cartTotal.toFixed(0)}</span>
          </button>
        </div>
      )}

      {showOrders && (
        <OrdersDrawer
          orders={orders}
          onClose={() => setShowOrders(false)}
          onNewOrder={() => { setShowOrders(false); setShowWishlist(true); }}
        />
      )}

      {showWishlist && (
        <WishlistDrawer
          items={cartItems}
          total={cartTotal}
          onAdd={addItem}
          onRemove={removeItem}
          onClose={() => setShowWishlist(false)}
          onSave={saveWishlist}
          isModified={isModified}
          wishlistId={wishlistId}
          navigate={navigate}
          restaurantId={restaurantId || data?.restaurant?.id}
          qrToken={qrToken}
        />
      )}

      {showFeedback && (
        <FeedbackModal
          restaurantId={restaurantId || data?.restaurant?.id}
          guestId={guest?.guest_id}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}

function MenuItemCard({ item, qty, onAdd, onRemove, delay }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 12, padding: 15, alignItems: 'flex-start', animation: `fadeUp 0.5s ease ${delay}s both`, transition: 'all 0.3s', borderColor: qty > 0 ? '#FF6B35' : 'rgba(0,0,0,0.06)', boxShadow: qty > 0 ? '0 8px 25px rgba(255,107,53,0.1)' : '0 4px 15px rgba(0,0,0,0.03)' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img src={item.image_url} alt={item.name} style={{ width: 100, height: 100, borderRadius: 16, objectFit: 'cover', background: '#F5F5F5' }} />
        {item.is_bestseller && <div style={{ position: 'absolute', top: -6, left: -6, background: '#FFD166', color: '#000', fontSize: 9, fontWeight: 900, padding: '4px 8px', borderRadius: 8, textTransform: 'uppercase', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>⭐ Best</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: `2.5px solid ${item.item_type === 'veg' ? '#1DB954' : '#E53935'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.item_type === 'veg' ? '#1DB954' : '#E53935' }} />
          </span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A' }}>{item.name}</span>
        </div>
        <p style={{ fontSize: 13, color: '#777', lineHeight: 1.5, marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.description}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#FF6B35' }}>₹{item.price}</span>
          <QtyControl qty={qty} onAdd={onAdd} onRemove={onRemove} />
        </div>
      </div>
    </div>
  );
}

function QtyControl({ qty, onAdd, onRemove }) {
  if (qty === 0) return <button onClick={onAdd} style={{ background: '#FFF', border: '1.5px solid #FF6B35', color: '#FF6B35', borderRadius: 12, padding: '8px 20px', fontSize: 14, fontWeight: 800 }}>ADD</button>;
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FF6B35', borderRadius: 12, padding: '7px 15px', boxShadow: '0 4px 12px rgba(255,107,53,0.3)' }}><button onClick={onRemove} style={{ background: 'none', color: '#fff', fontSize: 18, fontWeight: 900, border: 'none' }}>−</button><span style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>{qty}</span><button onClick={onAdd} style={{ background: 'none', color: '#fff', fontSize: 18, fontWeight: 900, border: 'none' }}>+</button></div>;
}

function FeedbackModal({ restaurantId, guestId, onClose }) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          rating,
          description,
          guest_id: guestId || ''
        })
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(8px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', zIndex: 201, background: '#FFF', borderRadius: '32px 32px 0 0', padding: '0 0 40px', animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -20px 60px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '15px 0' }}><div style={{ width: 40, height: 5, borderRadius: 10, background: '#EEE' }} /></div>
        {submitted ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A', marginBottom: 8 }}>Thank You!</h2>
            <p style={{ fontSize: 15, color: '#888', marginBottom: 24 }}>Your feedback helps us improve.</p>
            <button onClick={onClose} className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: 16 }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ padding: '10px 24px 20px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A' }}>Give Feedback</h2>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#999', padding: '4px 8px', borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ padding: '24px 24px 0' }}>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 16, fontWeight: 600 }}>Rate your experience</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 40,
                      cursor: 'pointer',
                      color: (hoveredStar || rating) >= star ? '#FFD700' : '#DDD',
                      transition: 'all 0.15s',
                      transform: (hoveredStar || rating) >= star ? 'scale(1.1)' : 'scale(1)'
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Tell us about your experience (optional)..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: 12,
                  border: '1.5px solid rgba(0,0,0,0.08)',
                  background: '#F5F5F5',
                  fontSize: 15,
                  color: '#1A1A1A',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div style={{ padding: '24px' }}>
              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '18px',
                  fontSize: 16,
                  opacity: rating === 0 ? 0.5 : 1,
                  cursor: rating === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Feedback ✨'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function WishlistDrawer({ items, total, onAdd, onRemove, onClose, onSave, isModified, wishlistId, navigate, restaurantId, qrToken }) {
  const showViewOnly = !isModified && wishlistId;
  const handleAction = () => {
    if (showViewOnly) {
      navigate(`/wishlist/${wishlistId}?rid=${restaurantId}&t=${qrToken}`);
    } else {
      onSave();
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(8px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', zIndex: 201, background: '#FFF', borderRadius: '32px 32px 0 0', padding: '0 0 40px', animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -20px 60px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '15px 0' }}><div style={{ width: 40, height: 5, borderRadius: 10, background: '#EEE' }} /></div>
        <div style={{ padding: '10px 24px 20px', borderBottom: '1px solid #F5F5F5' }}><h2 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A' }}>My Selections</h2></div>
        <div style={{ overflowY: 'auto', padding: '10px 24px', flex: 1 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #F5F5F5' }}>
              <div style={{ flex: 1 }}><p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{item.name}</p><p style={{ fontSize: 13, color: '#888', marginTop: 2 }}>₹{item.price}</p></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><QtyControl qty={item.quantity} onAdd={() => onAdd(item)} onRemove={() => onRemove(item)} /><span style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A', minWidth: 70, textAlign: 'right' }}>₹{(item.price * item.quantity).toFixed(0)}</span></div>
            </div>
          ))}
        </div>
        <div style={{ padding: '24px 24px 0', background: '#FFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#888' }}>Total Amount</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#FF6B35' }}>₹{total.toFixed(0)}</span>
          </div>
          <button onClick={handleAction} className="btn-primary" style={{ width: '100%', padding: '20px', fontSize: 18 }}>
            {showViewOnly ? 'View My List ✨' : 'Save to My List ✨'}
          </button>
        </div>
      </div>
    </>
  );
}

function OrdersDrawer({ orders, onClose, onNewOrder }) {
  const statusColor = { pending: '#FF6B35', claimed: '#3498DB', completed: '#1DB954' };
  const statusLabel = { pending: 'Pending', claimed: 'Preparing', completed: 'Completed' };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(8px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', zIndex: 201, background: '#FFF', borderRadius: '32px 32px 0 0', padding: '0 0 40px', animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -20px 60px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '15px 0' }}><div style={{ width: 40, height: 5, borderRadius: 10, background: '#EEE' }} /></div>
        <div style={{ padding: '10px 24px 20px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A' }}>My Orders</h2>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 24px', flex: 1 }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#888', marginBottom: 8 }}>All orders served!</p>
              <p style={{ fontSize: 13, color: '#AAA' }}>Served orders are cleared. Place a new order to see it here.</p>
              <button onClick={onNewOrder} className="btn-primary" style={{ marginTop: 20, padding: '14px 28px', fontSize: 15 }}>Start New Order</button>
            </div>
          ) : (
            orders.map(order => (
              <div key={order.id} style={{ marginBottom: 16, background: '#F9F9F9', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>Table {order.table_number}</span>
                    <span style={{ fontSize: 11, color: '#AAA', marginLeft: 8 }}>{new Date(order.created_at * 1000).toLocaleTimeString()}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 10, background: (statusColor[order.status] || '#888') + '20', color: statusColor[order.status] || '#888' }}>
                    {statusLabel[order.status] || order.status}
                  </span>
                </div>
                {order.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{item.quantity}x {item.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>₹{item.price * item.quantity}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #EEE' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#FF6B35' }}>₹{order.total_amount}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
