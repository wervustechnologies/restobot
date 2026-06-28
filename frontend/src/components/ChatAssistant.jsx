import React, { useState, useRef, useEffect } from 'react';
import Chef3D from './Chef3D';
import { API_BASE_URL } from '../apiConfig';

const DEFAULT_COURSE_ORDER = ['starter', 'main', 'bread', 'rice', 'dessert'];

const getCourseInfo = (ct) => {
  const labels = {
    starter: 'Starter',
    main: 'Main Course',
    bread: 'Bread',
    rice: 'Rice',
    dessert: 'Dessert'
  };
  const questions = {
    starter: 'Pick a <b>starter</b> to begin your meal:',
    main: 'Now choose your <b>main course</b>:',
    bread: 'Add a <b>bread</b> to go with it?',
    rice: 'Would you like a <b>rice dish</b>?',
    dessert: 'End on a sweet note? Pick a <b>dessert</b>:'
  };
  const skippable = !['starter', 'main'].includes(ct.toLowerCase());
  return {
    label: labels[ct.toLowerCase()] || ct.charAt(0).toUpperCase() + ct.slice(1),
    question: questions[ct.toLowerCase()] || `How about some <b>${ct}</b>?`,
    skippable
  };
};

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
.ctag-sp{background:#faece7;color:#712b13}
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

export default function ChatAssistant({ restaurantId, initialMenuData, onAddToCart, onShowWishlist, hideMascot }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [menuData, setMenuData] = useState(initialMenuData || null);
  const [resName, setResName] = useState(initialMenuData?.restaurant?.name || '');
  const [items, setItems] = useState([]);   // { type, ... }
  const [isTyping, setIsTyping] = useState(false);
  const [step, setStep] = useState(0);
  const [flow, setFlow] = useState({});   // diet, mainCat, selections
  const [llmOn, setLlmOn] = useState(false);
  const [freeMsg, setFreeMsg] = useState('');
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmHistory, setLlmHistory] = useState([]);
  const bottomRef = useRef(null);

  const [dynamicCourses, setDynamicCourses] = useState([]);

  useEffect(() => { injectCSS(); }, []);
  useEffect(() => { setTimeout(() => setShowBubble(true), 800); }, []);
  useEffect(() => { setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80); }, [items, isTyping]);

  useEffect(() => {
    if (menuData) {
      // Extract unique course types
      const types = new Set();
      menuData.main_categories?.forEach(mc => {
        mc.categories?.forEach(cat => {
          if (cat.course_type) types.add(cat.course_type.toLowerCase());
        });
      });
      const sortedTypes = Array.from(types).sort((a, b) => {
        const idxA = DEFAULT_COURSE_ORDER.indexOf(a);
        const idxB = DEFAULT_COURSE_ORDER.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
      setDynamicCourses(sortedTypes);
    }
  }, [menuData]);

  useEffect(() => {
    if (isOpen && menuData && items.length === 0) {
      startFlowWithName(menuData, resName);
    } else if (isOpen && !menuData && restaurantId) {
      fetch(`${API_BASE_URL}/menu/${restaurantId}`)
        .then(r => r.json())
        .then(d => {
          const name = d.restaurant?.name || 'Restaurant';
          setMenuData(d);
          setResName(name);
          if (items.length === 0) startFlowWithName(d, name);
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

  // ── Flow ──────────────────────────────────────────────────────────────────
  const startFlowWithName = async (mData, name) => {
    setStep(1);
    await botSay(`<div style="font-size:15px;font-weight:500;margin-bottom:4px;color:#333">👋 Namaskaram! Welcome to ${name}</div>I'm your personal menu guide. I'll help you build the perfect meal in just a few taps — no scrolling through a long menu!<br><br>Let's start with one simple question:`, 300);
    await botSay('🍽️ Are you dining <b>veg, non-veg, or mix</b> today?', 400);
    showOpts([
      { label: '🥦 Pure Veg', val: 'veg' },
      { label: '🍗 Non-Veg', val: 'non-veg' },
      { label: '🍲 Mix / Flexible', val: 'non-veg' },
    ], async (o, id) => {
      lockOpts(id, o.val); userSay(o.label);
      setFlow(prev => ({ ...prev, diet: o.val }));
      await askCuisine(mData, o.val);
    });
  };

  const askCuisine = async (mData, diet) => {
    setStep(2);
    const mainCats = mData?.main_categories || [];
    await botSay('🌍 What <b>cuisine</b> are you in the mood for?', 400);
    showOpts(mainCats.map(mc => ({ label: `${mc.name}`, val: mc.id, mc })),
      async (o, id) => {
        lockOpts(id, o.val); userSay(`${o.mc.name}`);
        setFlow(prev => ({ ...prev, mainCat: o.mc }));
        await askSpice(mData, diet, o.mc);
      },
      async (id) => {
        lockOpts(id, '__back'); userSay('Wait, go back ⬅️');
        await startFlowWithName(mData, resName);
      }
    );
  };

  const askSpice = async (mData, diet, mainCat) => {
    setStep(3);
    await botSay('🌶️ How <b>bold</b> do you want the flavours?', 400);
    showOpts([
      { label: '😌 Mild & Gentle', val: 'mild' },
      { label: '🌶️ Medium Kick', val: 'medium' },
      { label: '🔥 Full Spice', val: 'spicy' },
    ], async (o, id) => {
      lockOpts(id, o.val); userSay(o.label);
      setFlow(prev => ({ ...prev, spice: o.val }));
      await askHunger(mData, diet, mainCat, o.val);
    },
      async (id) => {
        lockOpts(id, '__back'); userSay('Let me change the cuisine ⬅️');
        await askCuisine(mData, diet);
      });
  };

  const askHunger = async (mData, diet, mainCat, spice) => {
    setStep(4);
    await botSay('😋 How <b>hungry</b> are you?', 400);
    showOpts([
      { label: '👍 Light — starter only', val: 'light' },
      { label: '🙋 Moderate — starter + main', val: 'moderate' },
      { label: '🍱 Feast — full meal!', val: 'full' },
    ], async (o, id) => {
      lockOpts(id, o.val); userSay(o.label);
      const hunger = o.val;
      setFlow(prev => ({ ...prev, hunger, selections: {} }));

      const courses = hunger === 'light' ? [dynamicCourses[0]] :
        hunger === 'moderate' ? [dynamicCourses[0], dynamicCourses[1]].filter(Boolean) :
          dynamicCourses;

      await runCourses(mData, diet, mainCat, spice, hunger, courses, 0, {});
    },
      async (id) => {
        lockOpts(id, '__back'); userSay('Change spice level ⬅️');
        await askSpice(mData, diet, mainCat);
      });
  };

  const runCourses = async (mData, diet, mainCat, spice, hunger, courses, idx, selections) => {
    if (idx >= courses.length) {
      await evaluateAndShowSummary(diet, mainCat, spice, hunger, selections);
      return;
    }
    const courseKey = courses[idx];
    const info = getCourseInfo(courseKey);
    const stepNum = 5 + idx;
    setStep(stepNum);

    const subCats = (mainCat.categories || []).filter(c => c.course_type?.toLowerCase() === courseKey);
    let dishes = subCats.flatMap(c => (c.items || []).filter(i => i.is_enabled !== false));
    if (diet === 'veg') {
      dishes = dishes.filter(i => i.item_type === 'veg');
    } else if (diet === 'non-veg') {
      const strictDishes = dishes.filter(i => i.item_type === 'non-veg');
      if (strictDishes.length > 0) dishes = strictDishes;
    }

    if (dishes.length === 0) {
      await runCourses(mData, diet, mainCat, spice, hunger, courses, idx + 1, selections);
      return;
    }

    await botSay(`${info.question}`, 500);

    const handleBack = async (backId) => {
      lockCards(backId, '__back'); userSay('Wait, go back ⬅️');
      if (idx === 0) {
        await askHunger(mData, diet, mainCat, spice);
      } else {
        const newSel = { ...selections };
        delete newSel[courses[idx - 1]];
        setFlow(prev => ({ ...prev, selections: newSel }));
        await runCourses(mData, diet, mainCat, spice, hunger, courses, idx - 1, newSel);
      }
    };

    const handleSkip = info.skippable ? async (skipId) => {
      lockCards(skipId, '__skip'); userSay(`No ${info.label} thanks ⏭️`);
      await runCourses(mData, diet, mainCat, spice, hunger, courses, idx + 1, selections);
    } : null;

    showCards(dishes, async (dish, cardId) => {
      lockCards(cardId, dish.name); userSay(`✓ ${dish.name}`);
      const newSel = { ...selections, [courseKey]: dish };
      setFlow(prev => ({ ...prev, selections: newSel }));
      await runCourses(mData, diet, mainCat, spice, hunger, courses, idx + 1, newSel);
    }, handleBack, handleSkip, `Skip ${info.label}`);
  };

  const evaluateAndShowSummary = async (diet, mainCat, spice, hunger, selections) => {
    const totalSteps = 4 + dynamicCourses.length;
    setStep(totalSteps);

    if (Object.keys(selections).length === 0) {
      await botSay("Oops! I couldn't find any items matching those exact preferences. 😕", 300);
      await botSay("Would you like to try again with a different cuisine or dining type?", 400);
      showOpts([
        { label: '🔄 Start Over', val: 'restart' },
        { label: '📖 Show All Menu', val: 'menu' }
      ], (o) => {
        if (o.val === 'restart') restart();
        else setIsOpen(false);
      });
      return;
    }

    console.log("Evaluating meal for suggestions...", selections);
    try {
      const r = await fetch(`${API_BASE_URL}/chat/evaluate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, selections })
      });
      
      if (!r.ok) {
        console.error("AI Evaluation failed:", await r.text());
        throw new Error("Evaluation failed");
      }

      const d = await r.json();
      console.log("AI Recommendation response:", d);

      if (d.suggested_item && d.suggested_item.id) {
        await botSay(d.suggestion_text, 400);
        showCards([d.suggested_item], async (dish, cardId) => {
          lockCards(cardId, dish.name); userSay(`Yes, add ${dish.name}`);
          const newSel = { ...selections, suggested: dish };
          setFlow(prev => ({ ...prev, selections: newSel }));
          await showSummary(diet, mainCat, spice, hunger, newSel);
        }, async (backId) => {
          lockCards(backId, '__back'); userSay('Wait, let me change my choices ⬅️');
          const hungerCourses = hunger === 'light' ? [dynamicCourses[0]] : hunger === 'moderate' ? [dynamicCourses[0], dynamicCourses[1]].filter(Boolean) : dynamicCourses;
          await runCourses(menuData, diet, mainCat, spice, hunger, hungerCourses, hungerCourses.length - 1, selections);
        }, async (skipId) => {
          lockCards(skipId, '__skip'); userSay('No, just confirm my meal');
          await showSummary(diet, mainCat, spice, hunger, selections);
        }, "No thanks");
      } else {
        if (d.suggestion_text) await botSay(d.suggestion_text, 400);
        await showSummary(diet, mainCat, spice, hunger, selections);
      }
    } catch {
      await showSummary(diet, mainCat, spice, hunger, selections);
    }
  };

  const showSummary = async (diet, mainCat, spice, hunger, selections) => {
    const totalSteps = 4 + dynamicCourses.length + 1;
    setStep(totalSteps);
    await botSay('🎉 <b>Your perfect meal is ready!</b> Here\'s what we\'ve put together for you:', 600);
    push({ type: 'summary', diet, mainCat, spice, hunger, selections, id: 'sum-' + Date.now() });
  };

  const confirmAndUnlock = async (sumItem) => {
    setItems(prev => prev.map(x => x.id === sumItem.id ? { ...x, confirmed: true } : x));
    userSay('✅ Confirmed! Add to my Wishlist!');

    if (onAddToCart) {
      Object.values(sumItem.selections).forEach(dish => {
        if (dish) onAddToCart(dish);
      });
      if (onShowWishlist) setTimeout(() => onShowWishlist(), 1500);
    }

    await botSay('🎉 <b>Wonderful! I have added everything to your Wishlist.</b><br><br>You can now ask me anything — ingredients, allergens, or to add more items to your wishlist!', 600);
    const context = `I'm a ${sumItem.diet} diner at ${resName}. My cuisine: ${sumItem.mainCat?.name}. Selections: ${Object.entries(sumItem.selections).map(([k, v]) => `${k}: ${v?.name}`).join(', ')}.`;
    setLlmHistory([{ role: 'user', content: context }]);
    setLlmOn(true);
  };

  const handleLlmSend = async (e) => {
    e?.preventDefault();
    if (!freeMsg.trim() || llmLoading) return;
    const txt = freeMsg.trim(); setFreeMsg('');
    const newHist = [...llmHistory, { role: 'user', content: txt }];
    setLlmHistory(newHist);
    push({ type: 'user', text: txt });
    setLlmLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, messages: newHist })
      });
      const d = await r.json();
      if (d.message) {
        push({ type: 'bot', html: d.message.replace(/\n/g, '<br>') });
        setLlmHistory(prev => [...prev, { role: 'assistant', content: d.message }]);
      }
      if (d.action === 'ADD_ITEM' && d.item_id && onAddToCart) {
        const allItems = menuData?.main_categories?.flatMap(mc => mc.categories?.flatMap(c => c.items)) || [];
        const itemToAdd = allItems.find(i => String(i.id) === String(d.item_id));
        if (itemToAdd) {
          onAddToCart(itemToAdd);
          push({ type: 'bot', html: `✅ I've added <b>${itemToAdd.name}</b> to your wishlist!` });
          if (onShowWishlist) setTimeout(() => onShowWishlist(), 1000);
        }
      }
    } catch { push({ type: 'bot', html: 'Sorry, I had a hiccup. Try again!' }); }
    finally { setLlmLoading(false); }
  };

  const restart = () => {
    setItems([]); setStep(0); setFlow({}); setLlmOn(false);
    setLlmHistory([]); setFreeMsg('');
    setTimeout(() => startFlowWithName(menuData, resName), 100);
  };

  const totalPossibleSteps = 4 + dynamicCourses.length + 1;
  const pct = Math.round((step / totalPossibleSteps) * 100);

  const getStepLabel = () => {
    if (step === 1) return 'Food Type';
    if (step === 2) return 'Cuisine';
    if (step === 3) return 'Spice Level';
    if (step === 4) return 'Hunger';
    if (step > 4 && step <= 4 + dynamicCourses.length) {
      return getCourseInfo(dynamicCourses[step - 5]).label;
    }
    return 'Your Meal';
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
                  <span className={`ctag ${d.item_type === 'veg' ? 'ctag-veg' : 'ctag-nov'}`}>
                    {d.item_type === 'veg' ? 'Veg' : 'Non-Veg'}
                  </span>
                  {d.spice_level >= 3 && <span className="ctag ctag-sp">🌶️ Spicy</span>}
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

    if (item.type === 'summary') {
      const sel = item.selections;
      const rows = dynamicCourses.filter(k => sel[k]).map(k => ({
        label: getCourseInfo(k).label,
        dish: sel[k]
      }));
      if (sel.suggested) rows.push({ label: 'Our Choice', dish: sel.suggested });

      return (
        <div key={item.id} style={{ paddingLeft: 34 }}>
          <div style={{ background: '#fff', border: '0.5px solid #eee', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#666', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Your complete meal</div>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid #eee', fontSize: 12 }}>
                <span style={{ color: '#666' }}>{r.label}</span>
                <span>🍽️ {r.dish.name}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid #eee', fontSize: 12 }}>
              <span style={{ color: '#666' }}>Cuisine</span>
              <span style={{ textTransform: 'capitalize' }}>{item.mainCat?.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 2px', fontWeight: 500, fontSize: 13 }}>
              <span style={{ color: '#666' }}>Total</span>
              <span style={{ color: '#c05c28' }}>₹{rows.reduce((s, r) => s + (r.dish.price || 0), 0)}</span>
            </div>
            {!item.confirmed ? (
              <>
                <button style={{ width: '100%', marginTop: 10, padding: '11px', background: '#c05c28', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  onClick={() => confirmAndUnlock(item)}>✅ Confirm this meal</button>
                <button style={{ width: '100%', marginTop: 6, padding: '8px', background: 'transparent', border: '0.5px solid #ddd', borderRadius: 10, fontSize: 12, color: '#666', cursor: 'pointer' }}
                  onClick={restart}>🔄 Start over</button>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '10px 0', color: '#1DB954', fontWeight: 500 }}>✅ Confirmed!</div>
                <button style={{ width: '100%', marginTop: 6, padding: '11px', background: '#fff', border: '1.5px solid #c05c28', color: '#c05c28', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  onClick={restart}>➕ Add another meal</button>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {/* Floating Chef — always visible */}
      {!hideMascot && (
        <div
          onClick={() => !isOpen && setIsOpen(true)}
          style={{ position: 'fixed', bottom: isOpen ? 560 : 0, left: isOpen ? 10 : 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', cursor: isOpen ? 'default' : 'pointer', pointerEvents: 'auto', padding: '20px', transition: 'bottom 0.3s, left 0.3s' }}>
          {!isOpen && showBubble && (
            <div style={{ position: 'absolute', bottom: 135, left: 105, background: 'linear-gradient(135deg, #FFFFFF 0%, #FFD2B8 100%)', padding: '10px 20px', borderRadius: '20px 20px 20px 0', boxShadow: '0 10px 25px rgba(255,107,53,0.25)', border: '1px solid #FFC4A3', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 800, color: '#E85A20', zIndex: 1001, display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
              Confused? Click me! 🍽️
              <div style={{ position: 'absolute', bottom: 0, left: -10, width: 0, height: 0, borderRight: '10px solid #FFFFFF', borderTop: '10px solid transparent' }} />
            </div>
          )}
          <Chef3D width={isOpen ? 70 : 120} height={isOpen ? 90 : 160} />
        </div>
      )}

      {/* Close */}
      {isOpen && (
        <button onClick={() => setIsOpen(false)}
          style={{ position: 'fixed', bottom: 95, right: 25, zIndex: 1001, width: 44, height: 44, borderRadius: '50%', background: '#FFF', border: '1.5px solid #F0F0F0', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, fontWeight: 900, color: '#666' }}>✕</button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{ position: 'fixed', bottom: 150, right: 20, zIndex: 1000, width: 'calc(100% - 40px)', maxWidth: 380, background: '#f9f9f9', borderRadius: 24, border: '1px solid #eee', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)', height: 540 }}>

          {/* Header */}
          <div style={{ padding: '14px 16px', background: '#c05c28', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
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
            {(isTyping || llmLoading) && <Typing />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleLlmSend} style={{ padding: '10px 12px', background: '#fff', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input value={freeMsg} onChange={e => setFreeMsg(e.target.value)}
              placeholder={llmOn ? 'Ask me anything...' : 'Complete the steps above to chat freely...'}
              disabled={!llmOn || llmLoading}
              style={{ flex: 1, background: '#f5f5f5', border: '0.5px solid #ddd', borderRadius: 20, padding: '10px 14px', fontSize: 13, color: '#333', outline: 'none', opacity: llmOn ? 1 : 0.5 }} />
            <button type="submit" disabled={!llmOn || llmLoading}
              style={{ background: llmOn ? '#c05c28' : '#ccc', border: 'none', borderRadius: 20, width: 40, height: 40, color: '#fff', cursor: llmOn ? 'pointer' : 'default', fontWeight: 500, fontSize: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
          </form>
        </div>
      )}
    </>
  );
}
