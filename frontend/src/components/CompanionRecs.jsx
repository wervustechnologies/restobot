import { useState } from 'react';

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

// Flatten any (legacy) {food_items, beverages} shape into a single id map.
function flattenRecs(recs) {
  if (!recs || typeof recs !== 'object') return {};
  if (recs.food_items || recs.beverages) {
    const flat = {};
    ['food_items', 'beverages'].forEach(k => {
      Object.entries(recs[k] || {}).forEach(([id, v]) => { if (!(id in flat)) flat[id] = v; });
    });
    return flat;
  }
  return recs;
}

/**
 * Small "Others love to buy together" companion strip shown under a wishlist/
 * cart item. Renders nothing when there are no eligible companions.
 *
 * Props:
 *  - recommendations: flat { id: { priority } } map on the item
 *  - itemsById:       id -> full item object (used to resolve image/price/etc.)
 *  - excludeIds:      Set of ids already in the cart/wishlist (hidden)
 *  - onAdd:           fn(item) when a companion's "+ Add" is tapped
 */
export default function CompanionRecs({ recommendations = {}, itemsById = {}, excludeIds = new Set(), onAdd }) {
  const [added, setAdded] = useState({});

  const recs = flattenRecs(recommendations);
  const exclude = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || []);

  const companions = Object.entries(recs)
    .map(([id, recData]) => ({ item: itemsById[id], priority: (recData || {}).priority }))
    .filter(({ item }) => item && item.is_enabled !== false && !exclude.has(item.id))
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3))
    .map(c => c.item);

  if (companions.length === 0) return null;

  const label = companions.length > 1 ? 'Others love to buy together' : 'Recommended';

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#FF6B35', textTransform: 'uppercase', letterSpacing: 0.4 }}>✨ {label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {companions.map(item => {
          const isAdded = !!added[item.id];
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF6F1', border: '1px solid #FFE2D1', borderRadius: 12, padding: '6px 8px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', background: '#F0F0F0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                ) : null}
                <span style={{ display: item.image_url ? 'none' : 'flex', fontSize: 16 }}>🍽️</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#FF6B35' }}>₹{item.price}</div>
              </div>
              <button type="button" disabled={isAdded} onClick={() => { setAdded(p => ({ ...p, [item.id]: true })); onAdd && onAdd(item); }}
                style={{ flexShrink: 0, background: isAdded ? '#1DB954' : '#FF6B35', color: '#FFF', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11.5, fontWeight: 800, cursor: isAdded ? 'default' : 'pointer' }}>
                {isAdded ? '✓ Added' : '+ Add'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
