import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import Swal from 'sweetalert2';

export default function AdminMenuManager() {
  const [mainCategories, setMainCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  
  const [activeMainCategory, setActiveMainCategory] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [showMainCatForm, setShowMainCatForm] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  const { token } = useAuth();

  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const [newMainCat, setNewMainCat] = useState({ name: '', display_order: 0 });
  const [newCat, setNewCat] = useState({ name: '', display_order: 0, main_category_id: '', course_type: '' });
  
  const initialItemState = {
    name: '', description: '', price: 0, image_url: '', 
    item_type: 'veg', spice_level: 3, taste: 'spicy', heaviness: 'medium', category_id: '', main_category_id: '',
    is_enabled: true, priority: 'medium'
  };
  const [newItem, setNewItem] = useState(initialItemState);

  const fetchData = async () => {
    const [mainCatRes, catRes, itemRes] = await Promise.all([
      fetch(`${API_BASE_URL}/admin/main_categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/admin/categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/admin/items`, { headers: { 'Authorization': `Bearer ${token}` } })
    ]);
    const mainCatData = await mainCatRes.json();
    const catData = await catRes.json();
    const itemData = await itemRes.json();
    
    if (catData.some(c => !c.main_category_id)) {
      mainCatData.push({ id: 'legacy-other', name: 'Other' });
    }
    
    setMainCategories(mainCatData);
    setCategories(catData);
    setItems(itemData);
    
    if (!activeMainCategory && mainCatData.length > 0) {
      setActiveMainCategory(mainCatData[0].id);
    }
    if (!activeCategory && catData.length > 0) {
      setActiveCategory(catData[0].id);
    }
    
    // Auto-expand the group that contains the active category
    if (activeCategory) {
      const activeCat = catData.find(c => c.id === activeCategory);
      if (activeCat) {
        setExpandedGroups(prev => ({ ...prev, [activeCat.course_type || 'Other']: true }));
      }
    } else if (catData.length > 0) {
      setExpandedGroups({ [catData[0].course_type || 'Other']: true });
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleAddMainCategory = async (e) => {
    e.preventDefault();
    await fetch(`${API_BASE_URL}/admin/main_categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newMainCat)
    });
    setNewMainCat({ name: '', display_order: mainCategories.length + 1 });
    setShowMainCatForm(false);
    Swal.fire({ title: 'Success!', text: 'Main Category added successfully', icon: 'success', timer: 1500, showConfirmButton: false });
    fetchData();
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    await fetch(`${API_BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newCat)
    });
    setNewCat({ name: '', display_order: categories.length + 1, main_category_id: '', course_type: '' });
    setShowCatForm(false);
    Swal.fire({ title: 'Success!', text: 'Sub Category added successfully', icon: 'success', timer: 1500, showConfirmButton: false });
    fetchData();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewItem({ ...newItem, image_url: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    const url = editItemId ? `${API_BASE_URL}/admin/items/${editItemId}` : `${API_BASE_URL}/admin/items`;
    const method = editItemId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newItem)
    });
    
    if (res.ok) {
      closeItemForm();
      Swal.fire({ title: 'Success!', text: editItemId ? 'Item updated successfully' : 'Item added successfully', icon: 'success', timer: 1500, showConfirmButton: false });
      fetchData();
    } else {
      const err = await res.json();
      console.error("Save failed:", err);
      Swal.fire({ title: 'Error', text: err.error || 'Failed to save item', icon: 'error' });
    }
  };

  const closeItemForm = () => {
    setNewItem(initialItemState);
    setEditItemId(null);
    setShowItemForm(false);
  };

  const handleEditClick = (item) => {
    setNewItem({
      ...initialItemState,
      ...item
    });
    setEditItemId(item.id);
    setShowItemForm(true);
  };

  const handleToggleItem = async (item) => {
    await fetch(`${API_BASE_URL}/admin/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ...item, is_enabled: item.is_enabled === false ? true : false })
    });
    fetchData();
  };

  const handleDeleteItem = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#FF4B4B', cancelButtonColor: '#ccc', confirmButtonText: 'Yes, delete it!'
    });
    if (result.isConfirmed) {
      await fetch(`${API_BASE_URL}/admin/items/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      Swal.fire({ title: 'Deleted!', text: 'Item has been deleted.', icon: 'success', timer: 1500, showConfirmButton: false });
      fetchData();
    }
  };

  return (
    <div>
      <style>{`
        .menu-manager-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .menu-manager-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .menu-manager-actions button { font-size: 13px; padding: 10px 14px; }
        .menu-layout { display: flex; gap: 20px; flex-direction: row; }
        .menu-sidebar { width: 260px; flex-shrink: 0; }
        .menu-items-panel { flex: 1; min-width: 0; }
        .item-row { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--border); }
        .item-row-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .modal-card { width: 90vw; max-width: 480px; padding: 24px; max-height: 90vh; overflow-y: auto; }
        .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 640px) {
          .menu-layout { flex-direction: column !important; }
          .menu-sidebar { width: 100% !important; }
          .item-row { flex-wrap: wrap; gap: 10px; }
          .item-row-info { min-width: 0; flex: 1 1 calc(100% - 70px); }
          .item-row-actions { width: 100%; justify-content: flex-end; }
          .form-grid-2 { grid-template-columns: 1fr !important; }
          .menu-manager-actions { width: 100%; }
          .menu-manager-actions button { flex: 1; }
        }
      `}</style>
      <div className="menu-manager-header">
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Menu Manager</h1>
        <div className="menu-manager-actions">
          <button className="btn-outline" onClick={() => setShowMainCatForm(true)}>+ Main Category</button>
          <button className="btn-outline" onClick={() => setShowCatForm(true)}>+ Sub Category</button>
          <button className="btn-primary" onClick={() => setShowItemForm(true)}>+ Food Item</button>
        </div>
      </div>

      {/* Main Categories Tabs */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginBottom: 20 }} className="hide-scroll">
        {mainCategories.map(mc => (
          <button key={mc.id} onClick={() => {
            setActiveMainCategory(mc.id);
            const firstCat = categories.find(c => c.main_category_id === (mc.id === 'legacy-other' ? null : mc.id));
            if (firstCat) setActiveCategory(firstCat.id);
            else setActiveCategory(null);
          }}
            className={activeMainCategory === mc.id ? "btn-primary" : "btn-outline"}
            style={{ 
              padding: '12px 24px', 
              borderRadius: 12, 
              border: activeMainCategory === mc.id ? 'none' : '1px solid #DDD',
              fontWeight: 800,
              boxShadow: activeMainCategory === mc.id ? '0 4px 15px rgba(255,107,53,0.3)' : 'none',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}>
            {mc.name}
          </button>
        ))}
      </div>

      <div className="menu-layout">
        {/* Structure Sidebar for Active Main Category */}
        <div className="menu-sidebar card">
          <div style={{ padding: 15, borderBottom: '1px solid #EEE', fontWeight: 900 }}>Sub Categories</div>
          {(() => {
            if (!activeMainCategory) return <div style={{ padding: 15, color: '#888' }}>Select a main category first</div>;
            
            const mcCats = activeMainCategory === 'legacy-other' 
              ? categories.filter(c => !c.main_category_id)
              : categories.filter(c => c.main_category_id === activeMainCategory);
              
            // Group sub-categories by course_type (dynamic)
            const grouped = {};
            mcCats.forEach(cat => {
              const ct = cat.course_type || 'Other';
              if (!grouped[ct]) grouped[ct] = [];
              grouped[ct].push(cat);
            });
            
            // Sort groups by the minimum display_order of categories within them
            const orderedKeys = Object.keys(grouped).sort((a, b) => {
              const orderA = Math.min(...grouped[a].map(c => c.display_order || 999));
              const orderB = Math.min(...grouped[b].map(c => c.display_order || 999));
              return orderA - orderB || a.localeCompare(b);
            });

            const groupColors = ['#FF6B35', '#E85A20', '#D4A017', '#1DB954', '#9B59B6', '#3498DB', '#E74C3C'];
            
            return (
              <div>
                {orderedKeys.length === 0 && (
                  <div style={{ padding: '15px', fontSize: 13, color: '#999', fontStyle: 'italic' }}>No sub categories yet</div>
                )}
                {orderedKeys.map((courseKey, idx) => {
                  const groupColor = groupColors[idx % groupColors.length];
                  return (
                    <div key={courseKey}>
                      {/* Course Type Row */}
                      <div 
                        onClick={() => toggleGroup(courseKey)}
                        style={{ 
                          padding: '10px 15px', 
                          background: '#F8F9FA', 
                          borderBottom: '1px solid #EEE', 
                          display: 'flex', 
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderLeft: `4px solid ${groupColor}`,
                          cursor: 'pointer'
                        }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#333', textTransform: 'uppercase', letterSpacing: 0.5 }}>{courseKey}</span>
                        <span style={{ fontSize: 10, color: '#888' }}>{expandedGroups[courseKey] ? '▲' : '▼'}</span>
                      </div>
                      {/* Sub Categories (Collapsible) */}
                      {expandedGroups[courseKey] && grouped[courseKey].map(cat => (
                        <div key={cat.id}
                          onClick={() => setActiveCategory(cat.id)}
                          style={{
                            padding: '12px 15px 12px 25px', cursor: 'pointer', borderBottom: '1px solid #F5F5F5',
                            background: activeCategory === cat.id ? 'rgba(255,107,53,0.07)' : 'transparent',
                            color: activeCategory === cat.id ? '#FF6B35' : '#555',
                            fontWeight: activeCategory === cat.id ? 800 : 500,
                            fontSize: 14,
                            borderLeft: activeCategory === cat.id ? `3px solid #FF6B35` : '3px solid transparent',
                            transition: 'all 0.15s'
                          }}>
                          {cat.name}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Items List */}
        <div className="menu-items-panel">
          <div className="card" style={{ padding: 25 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800 }}>Items in {categories.find(c => c.id === activeCategory)?.name || 'Category'}</h3>
            <div style={{ marginTop: 20 }}>
              {items.filter(i => i.category_id === activeCategory).length === 0 && <p style={{ color: '#888' }}>No items in this sub category.</p>}
              {items.filter(i => i.category_id === activeCategory).map(item => (
                <div key={item.id} className="item-row" style={{ opacity: item.is_enabled === false ? 0.5 : 1 }}>
                  <img src={item.image_url} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', background: '#F5F5F5', flexShrink: 0 }} />
                  <div className="item-row-info" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name} {!item.is_enabled && <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}>(Off)</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                      <span style={{ fontSize: 13, color: '#FF6B35', fontWeight: 700 }}>₹{item.price}</span>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: item.priority === 'high' ? '#FFEBEB' : item.priority === 'low' ? '#EBF5FF' : '#F5F5F5', color: item.priority === 'high' ? '#FF4B4B' : item.priority === 'low' ? '#3498DB' : '#888', fontWeight: 800, textTransform: 'uppercase' }}>{item.priority || 'med'}</span>
                    </div>
                  </div>
                  <div className="item-row-actions">
                    {/* Toggle Switch */}
                    <div onClick={() => handleToggleItem(item)}
                      style={{ width: 44, height: 24, borderRadius: 24, cursor: 'pointer', background: item.is_enabled !== false ? '#1DB954' : '#CCC', position: 'relative', transition: '0.3s', flexShrink: 0 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#FFF', position: 'absolute', top: 2, left: item.is_enabled !== false ? 22 : 2, transition: '0.3s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} />
                    </div>
                    <button className="btn-outline" style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => handleEditClick(item)}>Edit</button>
                    <button className="btn-outline" style={{ color: '#FF4B4B', borderColor: 'rgba(255,0,0,0.1)', padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => handleDeleteItem(item.id)}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Forms */}
      {showMainCatForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card modal-card">
            <h3 style={{ fontSize: 22, fontWeight: 900 }}>New Main Category</h3>
            <form onSubmit={handleAddMainCategory} style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 20 }}>
              <input type="text" placeholder="Name (e.g. Indian, Arabic)" required style={{ background: '#F5F5F5' }}
                onChange={e => setNewMainCat({ ...newMainCat, name: e.target.value })} />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={() => setShowMainCatForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCatForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card modal-card">
            <h3 style={{ fontSize: 22, fontWeight: 900 }}>New Sub Category</h3>
            <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 20 }}>
              <select required style={{ background: '#F5F5F5', padding: 15, borderRadius: 12, border: 'none' }}
                value={newCat.main_category_id} onChange={e => setNewCat({ ...newCat, main_category_id: e.target.value })}>
                <option value="">Select Main Category</option>
                {mainCategories.filter(mc => mc.id !== 'legacy-other').map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
              </select>
              <input type="text" placeholder="Name (e.g. Curries)" required style={{ background: '#F5F5F5' }}
                onChange={e => setNewCat({ ...newCat, name: e.target.value })} />
              <div style={{ background: '#FFF0EA', padding: '10px 15px', borderRadius: 12, border: '1px solid rgba(255,107,53,0.2)' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35', marginBottom: 8, display: 'block' }}>Course Type <span style={{ fontSize: 10, color: '#888' }}>(Used by AI Chat Guide)</span></label>
                <input 
                  list="course-types"
                  placeholder="Enter or select Course Type" 
                  required 
                  style={{ background: '#F5F5F5', border: 'none', padding: '10px 15px', borderRadius: 10, width: '100%', color: '#333', fontWeight: 600 }}
                  value={newCat.course_type} 
                  onChange={e => setNewCat({ ...newCat, course_type: e.target.value })} 
                />
                <datalist id="course-types">
                  {[...new Set(categories.map(c => c.course_type).filter(Boolean))].map(ct => (
                    <option key={ct} value={ct} />
                  ))}
                </datalist>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={() => setShowCatForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showItemForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card modal-card">
            <h3 style={{ fontSize: 22, fontWeight: 900 }}>{editItemId ? 'Edit Item' : 'New Item'}</h3>
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 20 }}>
              
              <div className="form-grid-2">
                <select required style={{ background: '#F5F5F5', border: 'none', padding: 15, borderRadius: 12 }} value={newItem.main_category_id}
                  onChange={e => setNewItem({ ...newItem, main_category_id: e.target.value, category_id: '' })}>
                  <option value="">Select Main Category</option>
                  {mainCategories.filter(mc => mc.id !== 'legacy-other').map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
                </select>
                <select required style={{ background: '#F5F5F5', border: 'none', padding: 15, borderRadius: 12 }} value={newItem.category_id}
                  onChange={e => setNewItem({ ...newItem, category_id: e.target.value })} disabled={!newItem.main_category_id}>
                  <option value="">Select Sub Category</option>
                  {categories.filter(c => c.main_category_id === newItem.main_category_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <input type="text" placeholder="Food Name" required style={{ background: '#F5F5F5' }} value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
              <textarea placeholder="Description" value={newItem.description}
                style={{ background: '#F5F5F5', border: 'none', padding: 15, borderRadius: 12, minHeight: 80 }}
                onChange={e => setNewItem({ ...newItem, description: e.target.value })} />
              <input type="number" placeholder="Price" required style={{ background: '#F5F5F5' }} value={newItem.price || ''}
                onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) })} />
              
              <div style={{ background: '#F5F5F5', padding: 15, borderRadius: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, display: 'block' }}>Upload Image</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} />
                {newItem.image_url && (
                  <img src={newItem.image_url} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, marginTop: 10 }} />
                )}
              </div>
              <div className="form-grid-2">
                <select style={{ background: '#F5F5F5', border: 'none', padding: 15, borderRadius: 12 }} value={newItem.item_type}
                  onChange={e => setNewItem({ ...newItem, item_type: e.target.value })}>
                  <option value="veg">Veg</option>
                  <option value="non-veg">Non-Veg</option>
                </select>
                <select style={{ background: '#F5F5F5', border: 'none', padding: 15, borderRadius: 12 }} value={newItem.spice_level || 3}
                  onChange={e => setNewItem({ ...newItem, spice_level: parseInt(e.target.value) })}>
                  <option value="1">Low {(newItem.taste || 'spicy').charAt(0).toUpperCase() + (newItem.taste || 'spicy').slice(1)}</option>
                  <option value="3">Medium</option>
                  <option value="5">High</option>
                </select>
              </div>

              <div className="form-grid-2">
                <select style={{ background: '#F5F5F5', border: 'none', padding: 15, borderRadius: 12 }} value={newItem.taste || 'spicy'}
                  onChange={e => setNewItem({ ...newItem, taste: e.target.value })}>
                  <option value="spicy">Spicy</option>
                  <option value="sweet">Sweet</option>
                  <option value="sour">Sour</option>
                  <option value="salty">Salty</option>
                  <option value="creamy">Creamy</option>
                </select>
                <select style={{ background: '#F5F5F5', border: 'none', padding: 15, borderRadius: 12 }} value={newItem.heaviness}
                  onChange={e => setNewItem({ ...newItem, heaviness: e.target.value })}>
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="heavy">Heavy</option>
                </select>
              </div>

              <div style={{ background: '#F5F5F5', padding: 15, borderRadius: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, display: 'block' }}>Display Priority</label>
                <select style={{ background: 'none', border: 'none', width: '100%', fontWeight: 600 }} value={newItem.priority || 'medium'}
                  onChange={e => setNewItem({ ...newItem, priority: e.target.value })}>
                  <option value="high">High (Show First)</option>
                  <option value="medium">Medium (Standard)</option>
                  <option value="low">Low (Show Last)</option>
                </select>
              </div>

              <div style={{ background: '#F5F5F5', padding: 15, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#444' }}>Available to Customers</label>
                <div onClick={() => setNewItem({ ...newItem, is_enabled: newItem.is_enabled !== false ? false : true })}
                  style={{ width: 44, height: 24, borderRadius: 24, cursor: 'pointer', background: newItem.is_enabled !== false ? '#1DB954' : '#CCC', position: 'relative', transition: '0.3s' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#FFF', position: 'absolute', top: 2, left: newItem.is_enabled !== false ? 22 : 2, transition: '0.3s' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={closeItemForm}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editItemId ? 'Update Item' : 'Add Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
