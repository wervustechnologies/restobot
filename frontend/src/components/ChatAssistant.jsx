import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../apiConfig';

// Inject styles once
const CSS = `
.copt{background:#fff;border:0.5px solid #ddd;border-radius:20px;padding:7px 14px;font-size:12px;cursor:pointer;color:#333;transition:background 0.15s, border-color 0.15s;white-space:nowrap;font-family:inherit;display:flex;align-items:center;gap:5px}
.copt:hover{background:#f5f5f5;border-color:#bbb}
.copt.sel{background:#c05c28;color:#fff;border-color:#c05c28}
.copt.dis{opacity:.45;cursor:default;pointer-events:none}
.dcard{background:#fff;border:0.5px solid #eee;border-radius:12px;padding:10px 12px;cursor:pointer;transition:.15s;display:flex;align-items:flex-start;gap:12px}
.dcard:hover{border-color:#c05c28}
.dcard.chosen{border:1.5px solid #c05c28;background:#fff8f5}
.dcard.dis{opacity:.5;pointer-events:none}
.dcard-img-wrap{width:48px;height:48px;border-radius:8px;overflow:hidden;flex-shrink:0;background:#f5f5f5;display:flex;align-items:center;justify-content:center}
.dcard-img{width:100%;height:100%;object-fit:cover}
.dcard-icon{font-size:24px}
.dcard-info{flex:1;min-width:0}
.dcard-title{font-size:13px;font-weight:600;color:#333;line-height:1.4;word-break:break-word;overflow-wrap:anywhere}
.dcard-desc{font-size:11px;color:#666;margin-top:2px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dcard-tags{display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;align-items:center}
.ctag{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:500}
.ctag-pop{background:#faeeda;color:#633806}
.ctag-veg{background:#e1f5ee;color:#085041}
.ctag-nov{background:#fce8e8;color:#7a1111}
.ctag-mix{background:#fef3e0;color:#7a4a06}
.ctyping{display:flex;gap:3px;align-items:center;padding:4px 0}
.ctyping span{width:6px;height:6px;border-radius:50%;background:#ccc;display:inline-block;animation:cb 1.2s infinite}
.ctyping span:nth-child(2){animation-delay:.2s}
.ctyping span:nth-child(3){animation-delay:.4s}
@keyframes cb{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
`;
function injectCSS() {
  if (!document.getElementById('ca-css')) {
    const s = document.createElement('style');
    s.id = 'ca-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
}

function BotBubble({ html }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#c05c28', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 500, flexShrink: 0 }}>SG</div>
      <div style={{ maxWidth: '82%', padding: '9px 13px', borderRadius: '16px 16px 16px 4px', fontSize: 13, lineHeight: 1.5, background: '#fff', border: '0.5px solid #eee', color: '#333' }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
function UserBubble({ text }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ maxWidth: '82%', padding: '9px 13px', borderRadius: '16px 16px 4px 16px', fontSize: 13, lineHeight: 1.5, background: '#c05c28', color: '#fff' }} dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  );
}
function Typing() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#c05c28', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 500, flexShrink: 0 }}>SG</div>
      <div style={{ padding: '9px 13px', borderRadius: '16px 16px 16px 4px', background: '#fff', border: '0.5px solid #eee' }}>
        <div className="ctyping"><span /><span /><span /></div>
      </div>
    </div>
  );
}

export default function ChatAssistant({ restaurantId, initialMenuData, onAddToCart, onShowWishlist, hideMascot, mode = 'menu' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [menuData, setMenuData] = useState(initialMenuData || null);
  const [resName, setResName] = useState(initialMenuData?.restaurant?.name || '');
  const [items, setItems] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [step, setStep] = useState(0);
  const [, setFlow] = useState({});
  const bottomRef = useRef(null);
  const mascotRef = useRef(null);
  const dragRef = useRef(null);

  // Minimize / drag state
  const [userMinimized, setUserMinimized] = useState(false);
  const [fabCorner, setFabCorner] = useState('bottom-left');

  const inOrdersMode = mode === 'orders';
  const isEffectivelyMinimized = userMinimized || (inOrdersMode && !isOpen);

  useEffect(() => { injectCSS(); }, []);
  useEffect(() => { setTimeout(() => setShowBubble(true), 800); }, []);
  useEffect(() => { setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80); }, [items, isTyping]);

  // Auto-close chat when switching to orders mode
  useEffect(() => {
    if (mode === 'orders') {
      setIsOpen(false);
    }
  }, [mode]);

  // ── Drag handlers for mascot (menu mode) ──
  const handleMascotPointerDown = (e) => {
    if (isOpen) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      moved: false
    };
    mascotRef.current?.setPointerCapture(e.pointerId);
  };

  const handleMascotPointerMove = (e) => {
    if (!dragRef.current || !mascotRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.moved = true;
      mascotRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      mascotRef.current.style.transition = 'none';
    }
  };

  const handleMascotPointerUp = (e) => {
    if (!dragRef.current) return;
    const wasMoved = dragRef.current.moved;
    const dist = Math.sqrt(
      Math.pow(e.clientX - dragRef.current.startX, 2) +
      Math.pow(e.clientY - dragRef.current.startY, 2)
    );

    if (mascotRef.current) {
      mascotRef.current.style.transform = '';
      mascotRef.current.style.transition = '';
    }
    dragRef.current = null;

    if (wasMoved && dist > 80) {
      // Snap to nearest corner
      const midX = window.innerWidth / 2;
      const midY = window.innerHeight / 2;
      const corner = (e.clientY < midY ? 'top' : 'bottom') + '-' + (e.clientX < midX ? 'left' : 'right');
      setFabCorner(corner);
      setUserMinimized(true);
      setIsOpen(false);
    } else if (!wasMoved) {
      // Treat as click — open chat
      setIsOpen(true);
    }
  };

  const handleFabClick = () => {
    if (inOrdersMode) {
      setIsOpen(true);
    } else {
      setUserMinimized(false);
    }
  };

  const fabPos = (() => {
    if (inOrdersMode) return { top: 20, right: 20 };
    switch (fabCorner) {
      case 'top-left': return { top: 80, left: 20 };
      case 'top-right': return { top: 80, right: 20 };
      case 'bottom-right': return { bottom: 20, right: 20 };
      default: return { bottom: 20, left: 20 };
    }
  })();

  useEffect(() => {
    if (isOpen && menuData && items.length === 0) {
      startFlow(menuData, resName);
    } else if (isOpen && !menuData && restaurantId) {
      fetch(`${API_BASE_URL}/menu/${restaurantId}`)
        .then(r => r.json())
        .then(d => {
          const name = d.restaurant?.name || 'Restaurant';
          setMenuData(d);
          setResName(name);
          if (items.length === 0) startFlow(d, name);
        });
    }
  }, [isOpen, restaurantId, menuData, initialMenuData]);

  const push = (item) => setItems(prev => [...prev, item]);

  const botSay = (html, delay = 0) => new Promise(res => {
    setIsTyping(true);
    setTimeout(() => { setIsTyping(false); push({ type: 'bot', html }); res(); }, delay + 700);
  });

  const userSay = (text) => push({ type: 'user', text });

  const showOpts = (opts, onPick, onBack = null) => push({ type: 'opts', opts, onPick, onBack, id: Date.now() });
  const showCards = (dishes, onPick, onBack = null, onSkip = null, skipLabel = null) => push({ type: 'cards', dishes, onPick, onBack, onSkip, skipLabel, id: Date.now() });

  const lockOpts = (id, selVal) => setItems(prev => prev.map(x => x.id === id ? { ...x, dis: true, selVal } : x));
  const lockCards = (id, selName) => setItems(prev => prev.map(x => x.id === id ? { ...x, dis: true, selName } : x));
  const setDiscoverTaste = (itemId, taste) => setItems(prev => prev.map(x => x.id === itemId ? { ...x, selectedTaste: taste } : x));

  // ── Flow ──────────────────────────────────────────────────────────────────
  // Context object flows through the chain by value: { diet, cuisine,
  // main_category_id, subcategory, subName, ingredient, taste, picks: [dish,...] }.
  // Picks accumulate as the user accepts suggestions; onAddToCart fires for each
  // pick immediately.
  const dietOk = (item, diet) => {
    if (diet === 'veg') return item.item_type === 'veg' || item.item_type === 'mixed';
    if (diet === 'non-veg') return item.item_type === 'non-veg' || item.item_type === 'mixed';
    return true;
  };
  const cuisineOk = (item, cuisine) => (!cuisine || cuisine === 'any') ? true : item.cuisine === cuisine;

  const ingredientOptionsFor = (mData, ctx) => {
    // Candidate items in the chosen subcategory passing diet + cuisine.
    const mc = (mData?.main_categories || []).find(m => m.id === ctx.main_category_id);
    const cat = (mc?.categories || []).find(c => c.id === ctx.subcategory);
    const matched = (cat?.items || []).filter(i => i.is_enabled !== false && dietOk(i, ctx.diet) && cuisineOk(i, ctx.cuisine));
    // Intersection of the owner-managed ingredients collection with the distinct
    // main_ingredient values actually present in this subcategory. Guarantees the
    // chat never offers an ingredient that would yield zero results.
    const managed = (mData?.ingredients || []).map(i => i.name);
    const present = [];
    matched.forEach(i => {
      if (i.main_ingredient && managed.includes(i.main_ingredient) && !present.includes(i.main_ingredient)) {
        present.push(i.main_ingredient);
      }
    });
    return present;
  };

  const startFlow = async (mData, name) => {
    setStep('diet');
    setFlow({});
    await botSay(`<div style="font-size:15px;font-weight:500;margin-bottom:4px;color:#333">👋 Welcome to ${name}!</div>I'm your AI menu guide. Answer a few quick questions and I'll suggest the perfect dishes — no scrolling through a long menu.`, 300);

    const rtype = mData?.restaurant?.restaurant_type || 'mixed';
    const base = { diet: 'mix', cuisine: '', picks: [] };
    if (rtype === 'veg') {
      // Pure-veg restaurant: auto-select veg and skip the diet question.
      userSay('🥦 Pure Veg');
      await afterDiet(mData, { ...base, diet: 'veg' });
      return;
    }

    await botSay('🍽️ Are you dining <b>veg, non-veg, or open to both</b> today?', 400);
    showOpts([
      { label: '🥦 Pure Veg', val: 'veg' },
      { label: '🍗 Non-Veg', val: 'non-veg' },
      { label: '🍲 Open to Both', val: 'mix' },
    ], async (o, id) => {
      lockOpts(id, o.val); userSay(o.label);
      setFlow({ diet: o.val, picks: [] });
      await afterDiet(mData, { ...base, diet: o.val });
    });
  };

  const afterDiet = async (mData, ctx) => {
    const cuisines = mData?.cuisines || [];
    if (cuisines.length) {
      await askCuisine(mData, ctx);
    } else {
      await askMainCategory(mData, ctx);
    }
  };

  const askCuisine = async (mData, ctx) => {
    setStep('cuisine');
    const cuisines = mData?.cuisines || [];
    await botSay('🌍 Do you have a <b>cuisine</b> in mind?', 400);
    const opts = cuisines.map(c => ({ label: c.name, val: c.name }));
    opts.push({ label: '🤷 Any', val: 'any' });
    showOpts(opts, async (o, id) => {
      lockOpts(id, o.val); userSay(o.label);
      await askMainCategory(mData, { ...ctx, cuisine: o.val });
    }, async (id) => {
      lockOpts(id, '__back'); userSay('⬅️ Back');
      await startFlow(mData, resName);
    });
  };

  // Eligible main categories: those having >=1 subcategory with >=1 item that
  // passes the current diet (+cuisine) filter.
  const eligibleMainCats = (mData, ctx) =>
    (mData?.main_categories || []).filter(mc => {
      const subs = (mc.categories || []).filter(cat =>
        (cat.items || []).some(i => i.is_enabled !== false && dietOk(i, ctx.diet) && cuisineOk(i, ctx.cuisine))
      );
      return subs.length > 0;
    });

  const askMainCategory = async (mData, ctx) => {
    setStep('main_category');
    const mcs = eligibleMainCats(mData, ctx);
    if (mcs.length === 0) {
      await botSay("I couldn't find dishes for those preferences. Let's start over. 😕", 300);
      showOpts([{ label: '🔄 Start Over', val: 'restart' }], () => restart());
      return;
    }
    // Exactly one eligible main category -> auto-select and advance silently.
    if (mcs.length === 1) {
      const mc = mcs[0];
      await askSubcategory(mData, { ...ctx, main_category_id: mc.id });
      return;
    }
    await botSay('📂 Which <b>category</b> are you in the mood for?', 400);
    showOpts(mcs.map(mc => ({ label: mc.name, val: mc.id, name: mc.name })), async (o, id) => {
      lockOpts(id, o.val); userSay(o.name);
      await askSubcategory(mData, { ...ctx, main_category_id: o.val });
    }, async (id) => {
      lockOpts(id, '__back'); userSay('⬅️ Back');
      const cuisines = mData?.cuisines || [];
      if (cuisines.length) await askCuisine(mData, ctx);
      else await startFlow(mData, resName);
    });
  };

  const askSubcategory = async (mData, ctx) => {
    setStep('subcategory');
    const mc = (mData?.main_categories || []).find(m => m.id === ctx.main_category_id);
    const subsAll = mc?.categories || [];
    const subs = subsAll.filter(cat => {
      const its = (cat.items || []).filter(i => i.is_enabled !== false && dietOk(i, ctx.diet) && cuisineOk(i, ctx.cuisine));
      return its.length > 0;
    });
    if (subs.length === 0) {
      await botSay("I couldn't find dishes for those preferences. Let's start over. 😕", 300);
      showOpts([{ label: '🔄 Start Over', val: 'restart' }], () => restart());
      return;
    }
    // Exactly one eligible subcategory -> auto-select and advance silently.
    if (subs.length === 1) {
      const s = subs[0];
      await askIngredient(mData, { ...ctx, subcategory: s.id, subName: s.name });
      return;
    }
    await botSay('🍽️ What <b>type of dish</b> are you in the mood for?', 400);
    showOpts(subs.map(s => ({ label: s.name, val: s.id, name: s.name })), async (o, id) => {
      lockOpts(id, o.val); userSay(o.name);
      await askIngredient(mData, { ...ctx, subcategory: o.val, subName: o.name });
    }, async (id) => {
      lockOpts(id, '__back'); userSay('⬅️ Back');
      await askMainCategory(mData, ctx);
    });
  };

  const askIngredient = async (mData, ctx) => {
    const present = ingredientOptionsFor(mData, ctx);
    if (present.length === 0) {
      // No ingredient data for this selection -> skip the step.
      await runDiscover(mData, { ...ctx, ingredient: 'any' });
      return;
    }
    setStep('ingredient');
    await botSay('🥩 Pick a <b>main ingredient</b> you fancy:', 400);
    const opts = present.map(p => ({ label: p, val: p }));
    opts.push({ label: '🤷 Any', val: 'any' });
    showOpts(opts, async (o, id) => {
      lockOpts(id, o.val); userSay(o.label);
      await runDiscover(mData, { ...ctx, ingredient: o.val });
    }, async (id) => {
      lockOpts(id, '__back'); userSay('⬅️ Back');
      await askSubcategory(mData, ctx);
    });
  };

  const runDiscover = async (mData, ctx) => {
    setStep('results');
    await botSay('🔎 Finding the best matches for you…', 300);
    let suggestions = [];
    let message = '';
    try {
      const res = await fetch(`${API_BASE_URL}/chat/discover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          diet: ctx.diet,
          cuisine: ctx.cuisine || '',
          main_category_id: ctx.main_category_id || '',
          subcategory_id: ctx.subcategory,
          ingredient: ctx.ingredient || 'any',
          taste: ''
        })
      });
      const data = await res.json();
      suggestions = data.suggestions || [];
      message = data.message || '';
    } catch { /* keep empty */ }

    if (suggestions.length === 0) {
      await botSay(message || "Hmm, no exact match. Try a different ingredient?", 400);
      showOpts([
        { label: '🔄 Start Over', val: 'restart' },
        { label: '⬅️ Change Ingredient', val: 'back' }
      ], (o, id) => {
        lockOpts(id, o.val);
        if (o.val === 'restart') restart();
        else askIngredient(mData, ctx);
      });
      return;
    }

    await botSay(message, 400);

    const presentNames = [];
    suggestions.forEach(d => {
      (d.taste || []).forEach(t => {
        const tn = (t || '').toLowerCase();
        if (tn && !presentNames.includes(tn)) presentNames.push(tn);
      });
    });
    const tasteChips = [];
    (mData?.tastes || []).forEach(t => {
      if (presentNames.includes((t.name || '').toLowerCase())) {
        tasteChips.push({ name: t.name, emoji: t.emoji, label: t.emoji ? `${t.emoji} ${t.name}` : t.name });
      }
    });
    presentNames.forEach(tn => {
      if (!tasteChips.some(c => c.name.toLowerCase() === tn)) {
        tasteChips.push({ name: tn, emoji: '', label: tn });
      }
    });

    push({
      type: 'discover',
      allDishes: suggestions,
      tasteChips,
      selectedTaste: '',
      onPick: async (dish, cardId) => {
        lockCards(cardId, dish.name); userSay(`✓ ${dish.name}`);
        const picks = [...ctx.picks, dish];
        setFlow(prev => ({ ...prev, picks }));
        if (onAddToCart) onAddToCart(dish);
        await chainOrBeverage(mData, { ...ctx, picks }, 0);
      },
      onSkip: async (skipId) => {
        lockCards(skipId, '__skip'); userSay('None of these');
        showOpts([{ label: '🔄 Start Over', val: 'restart' }, { label: '⬅️ Change Ingredient', val: 'back' }],
          (o, id) => { lockOpts(id, o.val); if (o.val === 'restart') restart(); else askIngredient(mData, ctx); });
      },
      id: Date.now()
    });
  };

  // After a pick, suggest associated items (chat chain) up to 2 rounds, then summary.
  const chainOrBeverage = async (mData, ctx, round) => {
    setStep('results');
    const last = ctx.picks[ctx.picks.length - 1];
    let suggestions = [];
    let message = '';
    try {
      const res = await fetch(`${API_BASE_URL}/chat/suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, current_item: last, diet: ctx.diet })
      });
      const data = await res.json();
      suggestions = data.suggestions || [];
      message = data.message || '';
    } catch { /* keep empty */ }

    if (suggestions.length === 0) {
      await showSummary(ctx);
      return;
    }
    if (message) await botSay(message, 400);
    const canChain = round < 1; // 1 extra chain round after the first associated pick
    showCards(suggestions, async (dish, cardId) => {
      lockCards(cardId, dish.name); userSay(`✓ Add ${dish.name}`);
      const picks = [...ctx.picks, dish];
      setFlow(prev => ({ ...prev, picks }));
      if (onAddToCart) onAddToCart(dish);
      if (canChain) await chainOrBeverage(mData, { ...ctx, picks }, round + 1);
      else await showSummary({ ...ctx, picks });
    }, null, async (skipId) => {
      lockCards(skipId, '__skip'); userSay('No thanks');
      await showSummary(ctx);
    }, 'No thanks');
  };

  const showSummary = async (ctx) => {
    setStep('summary');
    await botSay('🎉 <b>Here’s your selection!</b> Review and add everything to your wishlist.', 500);
    push({ type: 'summary', ctx, id: 'sum-' + Date.now() });
  };

  const confirmAndUnlock = async (sumItem) => {
    setItems(prev => prev.map(x => x.id === sumItem.id ? { ...x, confirmed: true } : x));
    userSay('✅ Add to Wishlist!');

    if (onAddToCart) {
      (sumItem.ctx?.picks || []).forEach(dish => { if (dish) onAddToCart(dish); });
      if (onShowWishlist) setTimeout(() => onShowWishlist(), 1200);
    }

    push({ type: 'bot', html: '🎉 <b>Added everything to your Wishlist!</b>' });
    showOpts([
      { label: '➕ Find more dishes', val: 'add_more' },
      { label: '❌ Close', val: 'close' },
    ], async (o, id) => {
      lockOpts(id, o.val);
      if (o.val === 'add_more') { userSay('Find more dishes'); restart(); }
      else { userSay('Close'); setIsOpen(false); }
    });
  };

  const restart = () => {
    setItems([]); setStep('diet'); setFlow({});
    setTimeout(() => startFlow(menuData, resName), 100);
  };

  const stepList = () => {
    const list = ['diet'];
    if ((menuData?.cuisines || []).length) list.push('cuisine');
    list.push('main_category', 'subcategory', 'ingredient', 'results', 'summary');
    return list;
  };
  const stepIdx = stepList().indexOf(step);
  const pct = stepIdx < 0 ? 0 : Math.round(((stepIdx + 1) / stepList().length) * 100);

  const getStepLabel = () => {
    const map = {
      diet: 'Food Type', cuisine: 'Cuisine', main_category: 'Category',
      subcategory: 'Dish Type', ingredient: 'Ingredient',
      results: 'Suggestions', summary: 'Your Picks'
    };
    return map[step] || '';
  };

  const renderItem = (item, idx) => {
    if (item.type === 'bot') return <BotBubble key={idx} html={item.html} />;
    if (item.type === 'user') return <UserBubble key={idx} text={item.text} />;

    if (item.type === 'opts') return (
      <div key={item.id} style={{ paddingLeft: 34 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
          {item.opts.map((o, i) => (
            <button key={i}
              className={`copt ${item.selVal === o.val ? 'sel' : ''} ${item.dis ? 'dis' : ''}`}
              onClick={() => !item.dis && item.onPick(o, item.id)}>
              {o.label}
            </button>
          ))}
        </div>
        {item.onBack && (
          <button onClick={() => !item.dis && item.onBack(item.id)} className={`copt ${item.dis ? 'dis' : ''}`} style={{ border: 'none', background: '#f0f0f0', color: '#666', fontSize: 11 }}>⬅️ Back</button>
        )}
      </div>
    );

    if (item.type === 'cards') return (
      <div key={item.id} style={{ paddingLeft: 34 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {item.dishes.map((d, i) => (
            <div key={i}
              className={`dcard ${item.selName === d.name ? 'chosen' : ''} ${item.dis ? 'dis' : ''}`}
              onClick={() => !item.dis && item.onPick(d, item.id)}>
              <div className="dcard-img-wrap">
                {d.image_url ? (
                  <img src={d.image_url} alt={d.name} className="dcard-img" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                ) : null}
                <div className="dcard-icon" style={{ display: d.image_url ? 'none' : 'block' }}>🍽️</div>
              </div>
              <div className="dcard-info">
                <div className="dcard-title">{d.name}</div>
                {d.description && <div className="dcard-desc">{d.description}</div>}
                <div className="dcard-tags">
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#c05c28', marginRight: 4 }}>₹{d.price}</span>
                  {d.is_bestseller && <span className="ctag ctag-pop">🔥 Popular</span>}
                  <span className={`ctag ${d.item_type === 'veg' ? 'ctag-veg' : d.item_type === 'non-veg' ? 'ctag-nov' : 'ctag-mix'}`}>
                    {d.item_type === 'veg' ? 'Veg' : d.item_type === 'non-veg' ? 'Non-Veg' : 'Mixed'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {(item.onBack || item.onSkip) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {item.onBack && <button onClick={() => !item.dis && item.onBack(item.id)} className={`copt ${item.dis ? 'dis' : ''}`}>⬅️ Back</button>}
            {item.onSkip && <button onClick={() => !item.dis && item.onSkip(item.id)} className={`copt ${item.dis ? 'dis' : ''}`}>{item.skipLabel || 'Skip ⏭️'}</button>}
          </div>
        )}
      </div>
    );

    if (item.type === 'discover') {
      const sel = (item.selectedTaste || '').toLowerCase();
      const dishes = sel
        ? item.allDishes.filter(d => (d.taste || []).some(t => (t || '').toLowerCase() === sel))
        : item.allDishes;
      return (
        <div key={item.id} style={{ paddingLeft: 34 }}>
          {item.tasteChips && item.tasteChips.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 5 }}>👅 Filter by flavour:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  className={`copt ${item.selectedTaste === '' ? 'sel' : ''} ${item.dis ? 'dis' : ''}`}
                  onClick={() => !item.dis && setDiscoverTaste(item.id, '')}>All</button>
                {item.tasteChips.map((c, i) => (
                  <button key={i}
                    className={`copt ${item.selectedTaste === c.name ? 'sel' : ''} ${item.dis ? 'dis' : ''}`}
                    onClick={() => !item.dis && setDiscoverTaste(item.id, c.name)}>{c.label}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {dishes.map((d, i) => (
              <div key={i}
                className={`dcard ${item.selName === d.name ? 'chosen' : ''} ${item.dis ? 'dis' : ''}`}
                onClick={() => !item.dis && item.onPick(d, item.id)}>
                <div className="dcard-img-wrap">
                  {d.image_url ? (
                    <img src={d.image_url} alt={d.name} className="dcard-img" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                  ) : null}
                  <div className="dcard-icon" style={{ display: d.image_url ? 'none' : 'block' }}>🍽️</div>
                </div>
                <div className="dcard-info">
                  <div className="dcard-title">{d.name}</div>
                  {d.description && <div className="dcard-desc">{d.description}</div>}
                  <div className="dcard-tags">
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#c05c28', marginRight: 4 }}>₹{d.price}</span>
                    {d.is_bestseller && <span className="ctag ctag-pop">🔥 Popular</span>}
                    <span className={`ctag ${d.item_type === 'veg' ? 'ctag-veg' : d.item_type === 'non-veg' ? 'ctag-nov' : 'ctag-mix'}`}>
                      {d.item_type === 'veg' ? 'Veg' : d.item_type === 'non-veg' ? 'Non-Veg' : 'Mixed'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {item.onSkip && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => !item.dis && item.onSkip(item.id)} className={`copt ${item.dis ? 'dis' : ''}`}>None of these</button>
            </div>
          )}
        </div>
      );
    }

    if (item.type === 'summary') {
      const picks = item.ctx?.picks || [];
      const rows = picks.map((d, i) => ({ label: `Dish ${i + 1}`, dish: d }));

      return (
        <div key={item.id} style={{ paddingLeft: 34 }}>
          <div style={{ background: '#fff', border: '0.5px solid #eee', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#666', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Your selection</div>
            {rows.length === 0 && (
              <div style={{ fontSize: 12, color: '#999', padding: '6px 0' }}>No dishes selected.</div>
            )}
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid #eee', fontSize: 12 }}>
                <span style={{ color: '#666' }}>{r.label}</span>
                <span>🍽️ {r.dish.name}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 2px', fontWeight: 500, fontSize: 13 }}>
              <span style={{ color: '#666' }}>Total</span>
              <span style={{ color: '#c05c28' }}>₹{rows.reduce((s, r) => s + (r.dish.price || 0), 0)}</span>
            </div>
            {!item.confirmed ? (
              <>
                <button style={{ width: '100%', marginTop: 10, padding: '11px', background: '#c05c28', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  onClick={() => confirmAndUnlock(item)}>✅ Add all to Wishlist</button>
                <button style={{ width: '100%', marginTop: 6, padding: '8px', background: 'transparent', border: '0.5px solid #ddd', borderRadius: 10, fontSize: 12, color: '#666', cursor: 'pointer' }}
                  onClick={restart}>🔄 Start over</button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '10px 0', color: '#1DB954', fontWeight: 500 }}>✅ Added!</div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // ── Shared chat content (header + progress + messages) ──
  const renderChatContent = (showCloseInHeader = false, onClose = null) => (
    <>
      {/* Header */}
      <div style={{ padding: '14px 16px', background: '#c05c28', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {showCloseInHeader && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff', fontSize: 16, fontWeight: 900,
              flexShrink: 0,
            }}
          >✕</button>
        )}
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍽️</div>
        <div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{resName || 'AI Menu Guide'}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>AI Menu Guide — online</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ height: 3, background: '#eee', flexShrink: 0 }}>
        <div style={{ height: '100%', background: '#c05c28', width: `${pct}%`, transition: 'width 0.4s ease' }} />
      </div>

      {/* Step Label */}
      <div style={{ padding: '6px 12px 0', fontSize: 11, color: '#999', textAlign: 'center', background: '#fff', flexShrink: 0 }}>{getStepLabel()}</div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, idx) => renderItem(item, idx))}
        {isTyping && <Typing />}
        <div ref={bottomRef} />
      </div>
    </>
  );

  return (
    <>
      {/* ── Minimized FAB (drag-to-corner or orders mode) ── */}
      {isEffectivelyMinimized && !hideMascot && (
        <div
          onClick={handleFabClick}
          style={{
            position: 'fixed',
            ...fabPos,
            zIndex: 1001,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF6B35 0%, #E85A20 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 25px rgba(255,107,53,0.4)',
            animation: 'pulse-ai 2s infinite',
            transition: 'all 0.3s ease',
            overflow: 'hidden',
            border: '3px solid rgba(255,255,255,0.3)',
          }}
        >
          <img src="/kidai.png" alt="AI Assistant" style={{ width: 36, height: 46, objectFit: 'contain' }} />
          {/* AI badge */}
          <div style={{
            position: 'absolute', top: -2, right: -2,
            background: '#fff', borderRadius: 8,
            padding: '1px 5px', fontSize: 8, fontWeight: 900,
            color: '#E85A20', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            letterSpacing: 0.5, lineHeight: '14px',
          }}>AI</div>
        </div>
      )}

      {/* ── Floating Mascot (menu mode, not minimized) ── */}
      {!isEffectivelyMinimized && !hideMascot && !inOrdersMode && (
        <div
          ref={mascotRef}
          onPointerDown={handleMascotPointerDown}
          onPointerMove={handleMascotPointerMove}
          onPointerUp={handleMascotPointerUp}
          style={{
            position: 'fixed',
            bottom: isOpen ? 560 : 0,
            left: isOpen ? 10 : 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            cursor: isOpen ? 'default' : 'grab',
            pointerEvents: 'auto',
            padding: '20px',
            transition: 'bottom 0.3s, left 0.3s',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {!isOpen && showBubble && (
            <div style={{ position: 'absolute', bottom: 135, left: 105, background: 'linear-gradient(135deg, #FFFFFF 0%, #FFD2B8 100%)', padding: '10px 20px', borderRadius: '20px 20px 20px 0', boxShadow: '0 10px 25px rgba(255,107,53,0.25)', border: '1px solid #FFC4A3', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 800, color: '#E85A20', zIndex: 1001, display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
              Confused? Click me! 🍽️
              <div style={{ position: 'absolute', bottom: 0, left: -10, width: 0, height: 0, borderRight: '10px solid #FFFFFF', borderTop: '10px solid transparent' }} />
            </div>
          )}
          <img src="/kidai.png" alt="AI Assistant" style={{ width: isOpen ? 70 : 120, height: isOpen ? 90 : 160, objectFit: 'contain' }} />
        </div>
      )}

      {/* ── Close Button (menu mode chat) ── */}
      {isOpen && !inOrdersMode && (
        <button onClick={() => setIsOpen(false)}
          style={{ position: 'fixed', bottom: 95, right: 25, zIndex: 1001, width: 44, height: 44, borderRadius: '50%', background: '#FFF', border: '1.5px solid #F0F0F0', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, fontWeight: 900, color: '#666' }}>✕</button>
      )}

      {/* ── Chat Window (menu mode) ── */}
      {isOpen && !inOrdersMode && (
        <div style={{ position: 'fixed', bottom: 150, right: 20, zIndex: 1000, width: 'calc(100% - 40px)', maxWidth: 380, background: '#f9f9f9', borderRadius: 24, border: '1px solid #eee', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)', height: 540 }}>
          {renderChatContent()}
        </div>
      )}

      {/* ── Side Panel Chat (orders mode) ── */}
      {isOpen && inOrdersMode && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 1002,
              backdropFilter: 'blur(2px)',
            }}
          />
          {/* Panel sliding from right */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: '88%', maxWidth: 380,
            zIndex: 1003,
            background: '#f9f9f9',
            display: 'flex', flexDirection: 'column',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.15)',
            animation: 'slideInRight 0.3s cubic-bezier(0.4,0,0.2,1)',
          }}>
            {renderChatContent(true, () => setIsOpen(false))}
          </div>
        </>
      )}
    </>
  );
}
