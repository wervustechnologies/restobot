import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import Swal from 'sweetalert2';

/* ─── Pill Radio Button Component ─── */
function PillRadio({ label, options, value, onChange, hint }) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div className="pill-radio-group">
        {options.map(opt => {
          const isActive = (opt.value ?? opt) === value;
          const optLabel = opt.label || opt;
          const optValue = opt.value ?? opt;
          const dotColor = opt.dot;
          return (
            <button
              key={optValue}
              type="button"
              onClick={() => onChange(optValue)}
              className={`pill-radio ${isActive ? 'active' : ''}`}
            >
              {dotColor && <span className="pill-dot" style={{ background: dotColor }} />}
              {optLabel}
            </button>
          );
        })}
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

/* ─── Multi-Select Toggle Pills Component ─── */
function PillMulti({ label, options, values, onChange, hint }) {
  const selected = Array.isArray(values) ? values : [];
  const toggle = (val) => {
    const next = selected.includes(val)
      ? selected.filter(v => v !== val)
      : [...selected, val];
    onChange(next);
  };
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div className="pill-radio-group">
        {options.length === 0 && (
          <span className="field-hint" style={{ margin: 0 }}>No options yet.</span>
        )}
        {options.map(opt => {
          const isActive = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`pill-radio ${isActive ? 'active' : ''}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

/* ─── Excel Logo Icon (green tile with white X) ─── */
function ExcelIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#ffffff" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#217346" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function AdminMenuManager() {
  const [mainCategories, setMainCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [cuisines, setCuisines] = useState([]);
  const [tastes, setTastes] = useState([]);
  
  const [activeMainCategory, setActiveMainCategory] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [showMainCatForm, setShowMainCatForm] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  const [editMainCatId, setEditMainCatId] = useState(null);
  const [editCatId, setEditCatId] = useState(null);
  const { token } = useAuth();
  const [pendingRec, setPendingRec] = useState('');
  const [recMainCatFilter, setRecMainCatFilter] = useState('all');
  const [recSubCatFilter, setRecSubCatFilter] = useState('all');

  const [menuLoading, setMenuLoading] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [formStep, setFormStep] = useState(1);

  // Menu Setup (ingredients + cuisines + tastes) management
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newCuisineName, setNewCuisineName] = useState('');
  const [newTasteName, setNewTasteName] = useState('');
  const [newTasteEmoji, setNewTasteEmoji] = useState('');

  // Excel import
  const [showImportForm, setShowImportForm] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);

  // POS menu sync
  const [fetchingPos, setFetchingPos] = useState(false);

  const [newMainCat, setNewMainCat] = useState({ name: '', display_order: 0 });
  const [newCat, setNewCat] = useState({ name: '', display_order: 0, main_category_id: '' });
  
  const initialItemState = {
    name: '', description: '', price: 0, image_url: '', 
    item_type: 'veg', taste: [], heaviness: 'medium', category_id: '', main_category_id: '',
    main_ingredient: '', cuisine: '',
    is_enabled: true, priority: 'medium'
  };
  const [newItem, setNewItem] = useState(initialItemState);
  const [itemRecs, setItemRecs] = useState({});

  const fetchData = async () => {
    setMenuLoading(true);
    const [mainCatRes, catRes, itemRes, ingRes, cuiRes, tasteRes] = await Promise.all([
      fetch(`${API_BASE_URL}/admin/main_categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/admin/categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/admin/items`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/admin/ingredients`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/admin/cuisines`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/admin/tastes`, { headers: { 'Authorization': `Bearer ${token}` } })
    ]);
    const mainCatData = await mainCatRes.json();
    const catData = await catRes.json();
    const itemData = await itemRes.json();
    const ingData = await ingRes.json();
    const cuiData = await cuiRes.json();
    const tasteData = await tasteRes.json();
    
    if (catData.some(c => !c.main_category_id)) {
      mainCatData.push({ id: 'legacy-other', name: 'Other' });
    }
    
    setMainCategories(mainCatData);
    setCategories(catData);
    setItems(itemData);
    setIngredients(Array.isArray(ingData) ? ingData : []);
    setCuisines(Array.isArray(cuiData) ? cuiData : []);
    setTastes(Array.isArray(tasteData) ? tasteData : []);
    
    if (!activeMainCategory && mainCatData.length > 0) {
      setActiveMainCategory(mainCatData[0].id);
    }
    if (!activeCategory && catData.length > 0) {
      setActiveCategory(catData[0].id);
    }

    setMenuLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // ── Excel template download + import ──
  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/menu/template`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu-import-template.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      Swal.fire({ title: 'Error', text: 'Could not download the template.', icon: 'error' });
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      Swal.fire({ title: 'Choose a file', text: 'Please select an Excel file first.', icon: 'warning', timer: 2000, showConfirmButton: false });
      return;
    }
    setImporting(true);
    setImportReport(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await fetch(`${API_BASE_URL}/admin/menu/import`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      // 200 (partial/full success) and 400 (everything failed) both carry the
      // report. Only non-report payloads (bad file / missing columns) are hard
      // errors here.
      if (data && (typeof data.total === 'number')) {
        setImportReport(data);
        fetchData();
      } else {
        Swal.fire({ title: 'Import failed', text: data.error || 'Could not import the file.', icon: 'error' });
      }
    } catch (e) {
      Swal.fire({ title: 'Import failed', text: 'Network error while importing.', icon: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const closeImportForm = () => {
    setShowImportForm(false);
    setImportFile(null);
    setImportReport(null);
  };

  // ── Fetch menu from POS ──
  const handleFetchFromPos = async () => {
    const confirm = await Swal.fire({
      title: 'Fetch menu from POS?',
      text: 'Matching items are updated (price, name, availability, category); new POS items are added under "Petpooja Menu". Your local tweaks (taste, images, recommendations) are kept.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Fetch',
      confirmButtonColor: '#FF6B35'
    });
    if (!confirm.isConfirmed) return;
    setFetchingPos(true);
    setImportReport(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/menu/fetch-pos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data && typeof data.total === 'number') {
        setImportReport(data);
        fetchData();
      } else {
        Swal.fire({ title: 'Fetch failed', text: data?.error || 'Could not fetch the menu from the POS.', icon: 'error' });
      }
    } catch {
      Swal.fire({ title: 'Fetch failed', text: 'Network error while contacting the POS.', icon: 'error' });
    } finally {
      setFetchingPos(false);
    }
  };

  const handleAddMainCategory = async (e) => {
    e.preventDefault();
    if (editMainCatId) {
      await fetch(`${API_BASE_URL}/admin/main_categories/${editMainCatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newMainCat.name })
      });
      setNewMainCat({ name: '', display_order: mainCategories.length + 1 });
      setEditMainCatId(null);
      setShowMainCatForm(false);
      Swal.fire({ title: 'Success!', text: 'Category updated successfully', icon: 'success', timer: 1500, showConfirmButton: false });
      fetchData();
      return;
    }
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
    if (editCatId) {
      await fetch(`${API_BASE_URL}/admin/categories/${editCatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newCat.name })
      });
      setNewCat({ name: '', display_order: categories.length + 1, main_category_id: '' });
      setEditCatId(null);
      setShowCatForm(false);
      Swal.fire({ title: 'Success!', text: 'Sub Category updated successfully', icon: 'success', timer: 1500, showConfirmButton: false });
      fetchData();
      return;
    }
    await fetch(`${API_BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newCat)
    });
    setNewCat({ name: '', display_order: categories.length + 1, main_category_id: '' });
    setShowCatForm(false);
    Swal.fire({ title: 'Success!', text: 'Sub Category added successfully', icon: 'success', timer: 1500, showConfirmButton: false });
    fetchData();
  };

  const openEditMainCat = (mc) => {
    setNewMainCat({ name: mc.name, display_order: mc.display_order || 0 });
    setEditMainCatId(mc.id);
    setShowMainCatForm(true);
  };

  const openEditCat = (cat) => {
    setNewCat({ name: cat.name, main_category_id: cat.main_category_id || '', display_order: cat.display_order || 0 });
    setEditCatId(cat.id);
    setShowCatForm(true);
  };

  const closeMainCatForm = () => {
    setEditMainCatId(null);
    setShowMainCatForm(false);
  };

  const closeCatForm = () => {
    setEditCatId(null);
    setShowCatForm(false);
  };

  // ── Ingredients & Cuisines management ──
  const handleAddIngredient = async (e) => {
    e.preventDefault();
    const name = newIngredientName.trim();
    if (!name) return;
    await fetch(`${API_BASE_URL}/admin/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, display_order: ingredients.length })
    });
    setNewIngredientName('');
    fetchData();
  };

  const handleDeleteIngredient = async (id) => {
    await fetch(`${API_BASE_URL}/admin/ingredients/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  };

  const handleAddCuisine = async (e) => {
    e.preventDefault();
    const name = newCuisineName.trim();
    if (!name) return;
    await fetch(`${API_BASE_URL}/admin/cuisines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, display_order: cuisines.length })
    });
    setNewCuisineName('');
    fetchData();
  };

  const handleDeleteCuisine = async (id) => {
    await fetch(`${API_BASE_URL}/admin/cuisines/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  };

  const handleAddTaste = async (e) => {
    e.preventDefault();
    const name = newTasteName.trim();
    if (!name) return;
    await fetch(`${API_BASE_URL}/admin/tastes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, display_order: tastes.length, emoji: newTasteEmoji.trim() })
    });
    setNewTasteName('');
    setNewTasteEmoji('');
    fetchData();
  };

  const handleDeleteTaste = async (id) => {
    await fetch(`${API_BASE_URL}/admin/tastes/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
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

  // Opens the item form with category auto-filled from sidebar
  const openAddItemForm = (catId, mainCatId) => {
    const cid = catId || activeCategory;
    const cat = categories.find(c => c.id === cid);
    const mcid = mainCatId || cat?.main_category_id || activeMainCategory;
    setNewItem({ ...initialItemState, category_id: cid || '', main_category_id: mcid || '' });
    setEditItemId(null);
    setItemRecs({});
    setPendingRec('');
    setRecMainCatFilter('all');
    setRecSubCatFilter('all');
    setFormStep(1);
    setShowItemForm(true);
  };

  const handleSave = async () => {
    if (!newItem.name || !newItem.price) {
      Swal.fire({ title: 'Required Fields', text: 'Please fill in the item name and price before proceeding.', icon: 'warning', timer: 2000, showConfirmButton: false });
      return;
    }
    const url = editItemId ? `${API_BASE_URL}/admin/items/${editItemId}` : `${API_BASE_URL}/admin/items`;
    const method = editItemId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newItem)
    });
    
    if (res.ok) {
      let itemId = editItemId;
      if (!editItemId) {
        const created = await res.json();
        itemId = created.id;
      }
      await fetch(`${API_BASE_URL}/admin/items/${itemId}/recommendations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(itemRecs)
      });
      closeItemForm();
      Swal.fire({ title: 'Success!', text: editItemId ? 'Item updated successfully' : 'Item added successfully', icon: 'success', timer: 1500, showConfirmButton: false });
      fetchData();
    } else {
      const err = await res.json();
      console.error("Save failed:", err);
      Swal.fire({ title: 'Error', text: err.error || 'Failed to save item', icon: 'error' });
    }
  };

  const submitOrAdvance = () => {
    if (formStep === 1) {
      if (!newItem.name || !newItem.price) {
        Swal.fire({ title: 'Required Fields', text: 'Please fill in the item name and price before proceeding.', icon: 'warning', timer: 2000, showConfirmButton: false });
        return;
      }
      setFormStep(2);
    } else if (formStep === 2) {
      setFormStep(3);
    } else {
      handleSave();
    }
  };

  const handleEnter = (e) => {
    if (e.key !== 'Enter') return;
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag !== 'input') return;
    e.preventDefault();
    submitOrAdvance();
  };

  const closeItemForm = () => {
    setNewItem(initialItemState);
    setEditItemId(null);
    setShowItemForm(false);
    setItemRecs({});
    setPendingRec('');
    setRecMainCatFilter('all');
    setRecSubCatFilter('all');
    setFormStep(1);
  };

  const handleEditClick = (item) => {
    const rawTaste = item.taste;
    const tasteList = Array.isArray(rawTaste)
      ? rawTaste
      : (rawTaste ? [rawTaste] : []);
    setNewItem({
      ...initialItemState,
      ...item,
      taste: tasteList
    });
    setEditItemId(item.id);
    setFormStep(1);
    setShowItemForm(true);
    setPendingRec('');
    setRecMainCatFilter('all');
    setRecSubCatFilter('all');
    fetch(`${API_BASE_URL}/admin/items/${item.id}/recommendations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(data => setItemRecs(data || {}));
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

  // Derive the context label for the current sidebar selection
  const activeCatObj = categories.find(c => c.id === activeCategory);
  const activeMainCatObj = mainCategories.find(mc => mc.id === activeMainCategory);

  return (
    <div>
      <style>{`
        .menu-manager-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .menu-manager-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .menu-manager-actions button { font-size: 13px; padding: 10px 14px; }

        /* ── Excel-themed green buttons (template / import) ── */
        .btn-excel {
          display: inline-flex; align-items: center; gap: 7px;
          background: #217346; color: #ffffff;
          border: 1px solid #1b5e38;
          font-size: 13px; font-weight: 800; letter-spacing: 0.1px;
          padding: 10px 14px; border-radius: 10px;
          cursor: pointer; transition: all 0.15s ease;
          box-shadow: 0 2px 6px rgba(33, 115, 70, 0.28);
        }
        .btn-excel:hover {
          background: #1b5e38; color: #ffffff;
          box-shadow: 0 5px 14px rgba(33, 115, 70, 0.38);
          transform: translateY(-1px);
        }
        .btn-excel:active { transform: translateY(0); box-shadow: 0 2px 5px rgba(33, 115, 70, 0.28); }
        .btn-excel svg { flex-shrink: 0; }
        .menu-layout { display: flex; gap: 20px; flex-direction: row; }
        .menu-sidebar { width: 280px; flex-shrink: 0; }
        .menu-items-panel { flex: 1; min-width: 0; }
        .item-row { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--border); }
        .item-row-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100vw; height: 100vh;
          background: rgba(15, 15, 22, 0.65);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.2s ease-out;
        }
        .modal-card {
          width: 90vw; max-width: 530px; padding: 28px 30px; max-height: 88vh; overflow-y: auto;
          margin: auto;
          background: var(--surface) !important;
          border: 1px solid var(--border) !important;
          border-top: 4px solid var(--primary) !important;
          border-radius: 20px !important;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.22), 0 8px 24px rgba(0, 0, 0, 0.12) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
          .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .field-group { display: flex; flex-direction: column; gap: 6px; }
          .field-label { font-size: 13px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 4px; }
          .field-label .req { color: #FF4B4B; }
          .field-hint { font-size: 11.5px; color: var(--text-muted); line-height: 1.3; margin-top: -2px; }
          .section-header { font-size: 13px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.4px; margin: 18px 0 2px; display: flex; align-items: center; gap: 8px; }
          .section-header:first-child { margin-top: 0; }
          .section-divider { height: 1px; background: var(--border); margin: 18px 0 0; border: none; }
          .field-box { background: var(--input-bg); padding: 13px 15px; border-radius: 12px; }
          .modal-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
          .modal-close { background: none; border: none; font-size: 22px; line-height: 1; color: var(--text-muted); cursor: pointer; padding: 0 4px; border-radius: 8px; }
          .modal-close:hover { color: var(--text); background: var(--input-bg); }

          /* ── Stepper Navigation ── */
          .stepper-nav {
            display: flex; gap: 4px; background: var(--surface-alt);
            padding: 4px; border-radius: 10px; margin: 14px 0 16px;
            border: 1px solid var(--border);
          }
          .stepper-btn {
            flex: 1; padding: 8px 10px; border: none; background: transparent;
            border-radius: 7px; font-size: 12px; font-weight: 600;
            color: var(--text-muted); cursor: pointer; transition: all 0.15s;
            display: flex; align-items: center; justify-content: center; gap: 6px;
            white-space: nowrap;
          }
          .stepper-btn:hover { color: var(--text); }
          .stepper-btn.active {
            background: var(--surface); color: var(--primary);
            font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          }
          .stepper-num {
            width: 18px; height: 18px; border-radius: 50%;
            background: var(--border); color: var(--text-muted);
            font-size: 10px; font-weight: 800; display: flex;
            align-items: center; justify-content: center;
          }
          .stepper-btn.active .stepper-num {
            background: var(--primary); color: #FFF;
          }
          .pill-radio-group {
            display: flex; flex-wrap: wrap; gap: 6px;
          }
          .pill-radio {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 8px 16px; border-radius: 8px;
            border: 1.5px solid var(--border);
            background: var(--surface);
            color: var(--text-muted);
            font-size: 13px; font-weight: 600;
            cursor: pointer; transition: all 0.15s;
            white-space: nowrap;
          }
          .pill-radio:hover {
            border-color: #CCC;
            color: var(--text);
            background: var(--surface-alt);
          }
          .pill-radio.active {
            border-color: var(--primary);
            background: rgba(255,107,53,0.06);
            color: var(--primary);
            font-weight: 700;
          }
          .pill-dot {
            width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          }

          /* ── Sidebar styles ── */
          .sidebar-search {
            padding: 10px 14px; margin: 10px; border-radius: 10px;
            background: var(--input-bg); border: 1.5px solid transparent;
            font-size: 13px; font-weight: 600; width: calc(100% - 20px);
            transition: all 0.2s;
          }
          .sidebar-search:focus { border-color: var(--primary); background: var(--surface); outline: none; box-shadow: 0 0 0 3px rgba(255,107,53,0.08); }
          .sidebar-course-group {
            border-bottom: 1px solid var(--border);
          }
          .sidebar-course-header {
            padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;
            cursor: pointer; transition: background 0.15s; user-select: none;
          }
          .sidebar-course-header:hover { background: var(--surface-alt); }
          .sidebar-cat-item {
            display: flex; align-items: center; justify-content: space-between; gap: 8px;
            padding: 10px 14px 10px 20px; cursor: pointer; transition: all 0.15s;
            border-left: 3px solid transparent; font-size: 13.5px; font-weight: 500;
            color: var(--text-muted);
          }
          .sidebar-cat-item:hover { background: rgba(255,107,53,0.04); color: var(--text); }
          .sidebar-cat-item.active {
            background: rgba(255,107,53,0.07); color: #FF6B35;
            font-weight: 800; border-left-color: #FF6B35;
          }
          .sidebar-cat-item .cat-count {
            font-size: 11px; font-weight: 700; min-width: 22px; height: 22px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 6px; background: var(--surface-alt); color: var(--text-muted);
            flex-shrink: 0;
          }
          .sidebar-cat-item.active .cat-count {
            background: rgba(255,107,53,0.12); color: #FF6B35;
          }
          .sidebar-add-btn {
            display: flex; align-items: center; gap: 6px;
            padding: 8px 14px 8px 20px; width: 100%;
            background: none; border: none; border-left: 3px solid transparent;
            cursor: pointer; font-size: 12px; font-weight: 700;
            color: var(--primary); opacity: 0.7; transition: all 0.15s;
          }
          .sidebar-add-btn:hover { opacity: 1; background: rgba(255,107,53,0.04); }

          /* ── Category context banner ── */
          .cat-context-banner {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 14px; border-radius: 10px;
            background: var(--surface-alt);
            border: 1px solid var(--border);
            margin-bottom: 4px;
          }

          @media (max-width: 900px) {
          .menu-layout { flex-direction: column !important; }
          .menu-sidebar { width: 100% !important; }
          
          /* Make sidebar a horizontal scrollable bar on tablets/mobile */
          .menu-sidebar .hide-scroll > div {
            display: flex;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 8px;
          }
          .menu-sidebar .hide-scroll > div > div {
            display: flex;
            align-items: center;
          }
          .sidebar-cat-item {
            white-space: nowrap;
            border-left: none !important;
            border-bottom: 3px solid transparent;
            padding: 10px 14px !important;
          }
          .sidebar-cat-item.active {
            border-left: none !important;
            border-bottom-color: #FF6B35 !important;
          }
          .menu-sidebar .hide-scroll {
            max-height: none !important;
          }
          
          .item-row { flex-wrap: wrap; gap: 10px; }
          .item-row-info { min-width: 0; flex: 1 1 calc(100% - 70px); }
          .item-row-actions { width: 100%; justify-content: flex-end; }
          .form-grid-2 { grid-template-columns: 1fr !important; }
          .menu-manager-actions { width: 100%; }
          .menu-manager-actions button { flex: 1; }
          .pill-radio-group { gap: 4px; }
          .pill-radio { padding: 6px 12px; font-size: 12px; }
        }
      `}</style>

      {menuLoading ? (
        <>
          {/* Header skeleton */}
          <div className="menu-manager-header">
            <div className="skeleton skeleton-text lg" style={{ width: 200 }} />
            <div className="menu-manager-actions">
              <div className="skeleton skeleton-rect" style={{ width: 110, height: 38 }} />
              <div className="skeleton skeleton-rect" style={{ width: 120, height: 38 }} />
              <div className="skeleton skeleton-rect" style={{ width: 130, height: 38 }} />
              <div className="skeleton skeleton-rect" style={{ width: 110, height: 38 }} />
              <div className="skeleton skeleton-rect" style={{ width: 120, height: 38 }} />
              <div className="skeleton skeleton-rect" style={{ width: 120, height: 38 }} />
            </div>
          </div>

          {/* Main category tabs skeleton */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {[90, 75, 100, 80].map((w, i) => (
              <div key={i} className="skeleton skeleton-rect" style={{ width: w, height: 44 }} />
            ))}
          </div>

          {/* Layout skeleton */}
          <div className="menu-layout">
            <div className="menu-sidebar skeleton-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 15, borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton skeleton-text md" style={{ width: '70%' }} />
              </div>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)' }}>
                  <div className="skeleton skeleton-text" style={{ width: `${60 + (i * 7) % 30}%` }} />
                </div>
              ))}
            </div>
            <div className="menu-items-panel">
              <div className="skeleton-card" style={{ padding: 25 }}>
                <div className="skeleton skeleton-text lg" style={{ width: '45%', marginBottom: 20 }} />
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="skeleton-row" style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="skeleton skeleton-rect" style={{ width: 56, height: 56, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton skeleton-text md" style={{ width: `${50 + (i * 11) % 35}%`, marginBottom: 6 }} />
                      <div className="skeleton skeleton-text sm" style={{ width: '30%' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <div className="skeleton skeleton-rect" style={{ width: 44, height: 24 }} />
                      <div className="skeleton skeleton-rect" style={{ width: 50, height: 28 }} />
                      <div className="skeleton skeleton-rect" style={{ width: 40, height: 28 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
      <div className="menu-manager-header">
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Menu Manager</h1>
        <div className="menu-manager-actions">
          <button className="btn-outline" onClick={() => setShowSetupForm(true)}>Menu Setup</button>
          <button className="btn-excel" onClick={handleDownloadTemplate}><ExcelIcon /> Template</button>
          <button className="btn-excel" onClick={() => setShowImportForm(true)}><ExcelIcon /> Import Excel</button>
          <button className="btn-excel" onClick={handleFetchFromPos} disabled={fetchingPos} style={{ opacity: fetchingPos ? 0.6 : 1 }}>
            <ExcelIcon /> {fetchingPos ? 'Fetching…' : 'Fetch from POS'}
          </button>
          <button className="btn-outline" onClick={() => setShowMainCatForm(true)}>+ Category</button>
          <button className="btn-outline" onClick={() => setShowCatForm(true)}>+ Sub Category</button>
          <button className="btn-primary" onClick={() => openAddItemForm()}>+ Food Item</button>
        </div>
      </div>

      {/* Main Categories Tabs */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginBottom: 20, WebkitOverflowScrolling: 'touch' }} className="hide-scroll">
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
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8
            }}>
            <span>{mc.name}</span>
            {mc.id !== 'legacy-other' && (
              <span
                role="button"
                title="Rename category"
                onClick={(e) => { e.stopPropagation(); openEditMainCat(mc); }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, opacity: 0.6, cursor: 'pointer', background: 'rgba(0,0,0,0.05)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="menu-layout">
        {/* ═══ Redesigned Sidebar ═══ */}
        <div className="menu-sidebar card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>Sub Categories</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-alt)', padding: '3px 8px', borderRadius: 6 }}>
              {(() => {
                const mcCats = activeMainCategory === 'legacy-other' 
                  ? categories.filter(c => !c.main_category_id)
                  : categories.filter(c => c.main_category_id === activeMainCategory);
                return `${mcCats.length} total`;
              })()}
            </span>
          </div>

          {/* Sidebar search */}
          <input
            type="text"
            className="sidebar-search"
            placeholder="🔍  Search categories..."
            value={sidebarSearch}
            onChange={e => setSidebarSearch(e.target.value)}
          />

          <div style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }} className="hide-scroll">
          {(() => {
            if (!activeMainCategory) return <div style={{ padding: 15, color: '#888' }}>Select a main category first</div>;
            
            const mcCats = activeMainCategory === 'legacy-other' 
              ? categories.filter(c => !c.main_category_id)
              : categories.filter(c => c.main_category_id === activeMainCategory);
              
            // Filter by search
            const filteredCats = sidebarSearch.trim()
              ? mcCats.filter(c => c.name.toLowerCase().includes(sidebarSearch.toLowerCase()))
              : mcCats;

            // Sort sub-categories by display order
            const sortedCats = [...filteredCats].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

            return (
              <div>
                {sortedCats.length === 0 && (
                  <div style={{ padding: '20px 15px', fontSize: 13, color: '#999', textAlign: 'center' }}>
                    {sidebarSearch ? 'No matching categories' : 'No sub categories yet'}
                  </div>
                )}
                {sortedCats.map(cat => {
                  const catItemCount = items.filter(i => i.category_id === cat.id).length;
                  return (
                    <div key={cat.id}>
                      <div
                        onClick={() => setActiveCategory(cat.id)}
                        className={`sidebar-cat-item ${activeCategory === cat.id ? 'active' : ''}`}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span
                            role="button"
                            title="Rename subcategory"
                            onClick={(e) => { e.stopPropagation(); openEditCat(cat); }}
                            className="cat-count"
                            style={{ cursor: 'pointer', background: 'transparent' }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </span>
                          <span className="cat-count">{catItemCount}</span>
                        </span>
                      </div>
                      {/* Inline + Add Item button under each subcategory */}
                      {activeCategory === cat.id && (
                        <button
                          className="sidebar-add-btn"
                          onClick={(e) => { e.stopPropagation(); openAddItemForm(cat.id, cat.main_category_id); }}
                        >
                          <span style={{ fontSize: 14, lineHeight: 1 }}>＋</span> Add food item here
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          </div>
        </div>

        {/* Items List */}
        <div className="menu-items-panel">
          <div className="card" style={{ padding: 25 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                {activeCatObj?.name || 'Category'}
              </h3>
              {activeCategory && (
                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}
                  onClick={() => openAddItemForm()}>
                  + Add Item
                </button>
              )}
            </div>
            <div>
              {items.filter(i => i.category_id === activeCategory).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🍽️</div>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>No items yet</p>
                  <p style={{ fontSize: 12, margin: '6px 0 16px' }}>Add your first food item to this category</p>
                  {activeCategory && (
                    <button className="btn-primary" style={{ padding: '10px 20px', fontSize: 13 }}
                      onClick={() => openAddItemForm()}>+ Add Item</button>
                  )}
                </div>
              )}
              {items.filter(i => i.category_id === activeCategory).map(item => (
                <div key={item.id} className="item-row" style={{ opacity: item.is_enabled === false ? 0.5 : 1 }}>
                  <img src={item.image_url} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', background: '#F5F5F5', flexShrink: 0 }} />
                  <div className="item-row-info" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name} {!item.is_enabled && <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}>(Off)</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, flexWrap: 'wrap', rowGap: 4 }}>
                      <span style={{ fontSize: 13, color: '#FF6B35', fontWeight: 700 }}>₹{item.price}</span>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.item_type === 'veg' ? '#1DB954' : item.item_type === 'non-veg' ? '#E53935' : '#F59E0B' }} />
                      {(Array.isArray(item.taste) ? item.taste : []).map(t => {
                        const vocab = tastes.find(v => v.name === t);
                        const emoji = vocab?.emoji;
                        return (
                          <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#FFF4EE', color: '#B5531E', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            {emoji && <span>{emoji}</span>}{t}
                          </span>
                        );
                      })}
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: item.priority === 'high' ? '#FFEBEB' : item.priority === 'low' ? '#EBF5FF' : '#F5F5F5', color: item.priority === 'high' ? '#FF4B4B' : item.priority === 'low' ? '#3498DB' : '#888', fontWeight: 800, textTransform: 'uppercase' }}>{item.priority || 'med'}</span>
                    </div>
                  </div>
                  <div className="item-row-actions">
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

      </>
      )}

      {/* ═══ Main Category Modal ═══ */}
      {showMainCatForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeMainCatForm()}>
          <div className="modal-card">
            <h3 style={{ fontSize: 22, fontWeight: 900 }}>{editMainCatId ? 'Edit Category' : 'New Category'}</h3>
            <form onSubmit={handleAddMainCategory} style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 20 }}>
              <input type="text" placeholder="Name (e.g. Food, Beverages, Desserts)" required style={{ background: '#F5F5F5' }}
                value={newMainCat.name} onChange={e => setNewMainCat({ ...newMainCat, name: e.target.value })} />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={closeMainCatForm}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editMainCatId ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Sub Category Modal ═══ */}
      {showCatForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeCatForm()}>
          <div className="modal-card">
            <h3 style={{ fontSize: 22, fontWeight: 900 }}>{editCatId ? 'Edit Sub Category' : 'New Sub Category'}</h3>
            <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 20 }}>
              <select required disabled={!!editCatId} style={{ background: '#F5F5F5', padding: 15, borderRadius: 12, border: 'none' }}
                value={newCat.main_category_id} onChange={e => setNewCat({ ...newCat, main_category_id: e.target.value })}>
                <option value="">Select Main Category</option>
                {mainCategories.filter(mc => mc.id !== 'legacy-other').map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
              </select>
              {editCatId && <span className="field-hint">Only the name is editable.</span>}
              <input type="text" placeholder="Name (e.g. Pizza, Curries, Coffee)" required style={{ background: '#F5F5F5' }}
                value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={closeCatForm}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editCatId ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Add / Edit Item Modal (3-Step Wizard) ═══ */}
      {showItemForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeItemForm()}>
          <div className="modal-card">
            <div className="modal-head">
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: -0.3 }}>{editItemId ? 'Edit Item' : 'Add New Item'}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', fontWeight: 500 }}>
                  Step {formStep} of 3 — {formStep === 1 ? 'Basic Information' : formStep === 2 ? 'Food Attributes' : 'AI & Customer Visibility'}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeItemForm} aria-label="Close">✕</button>
            </div>

            {/* ── Stepper Navigation Tabs ── */}
            <div className="stepper-nav">
              <button type="button" className={`stepper-btn ${formStep === 1 ? 'active' : ''}`} onClick={() => setFormStep(1)}>
                <span className="stepper-num">1</span> Basic Info
              </button>
              <button type="button" className={`stepper-btn ${formStep === 2 ? 'active' : ''}`} onClick={() => setFormStep(2)}>
                <span className="stepper-num">2</span> Attributes
              </button>
              <button type="button" className={`stepper-btn ${formStep === 3 ? 'active' : ''}`} onClick={() => setFormStep(3)}>
                <span className="stepper-num">3</span> AI & Visibility
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submitOrAdvance(); }} onKeyDown={handleEnter} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ═════ STEP 1: BASIC INFO ═════ */}
              {formStep === 1 && (
                <>
                  {/* Category Context Banner */}
                  {(() => {
                    const selCat = categories.find(c => c.id === newItem.category_id);
                    const selMainCat = mainCategories.find(mc => mc.id === newItem.main_category_id);
                    if (!selCat && !selMainCat) return null;
                    return (
                      <div className="cat-context-banner">
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                          {selMainCat && <span style={{ color: 'var(--text)' }}>{selMainCat.name}</span>}
                          {selMainCat && selCat && <span style={{ opacity: 0.4 }}>/</span>}
                          {selCat && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{selCat.name}</span>}
                        </div>
                        {editItemId && (
                          <button type="button" style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline', textUnderlineOffset: 2 }}
                            onClick={() => {
                              Swal.fire({
                                title: 'Change Category',
                                html: `
                                  <select id="swal-maincat" class="swal2-select" style="margin-bottom:8px;width:100%">
                                    <option value="">Select Main Category</option>
                                    ${mainCategories.filter(mc => mc.id !== 'legacy-other').map(mc => `<option value="${mc.id}" ${mc.id === newItem.main_category_id ? 'selected' : ''}>${mc.name}</option>`).join('')}
                                  </select>
                                  <select id="swal-subcat" class="swal2-select" style="width:100%">
                                    <option value="">Select Sub Category</option>
                                    ${categories.filter(c => c.main_category_id === newItem.main_category_id).map(c => `<option value="${c.id}" ${c.id === newItem.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                  </select>
                                `,
                                preConfirm: () => ({
                                  main_category_id: document.getElementById('swal-maincat').value,
                                  category_id: document.getElementById('swal-subcat').value
                                }),
                                showCancelButton: true,
                                confirmButtonColor: '#FF6B35'
                              }).then(r => {
                                if (r.isConfirmed && r.value.category_id) {
                                  setNewItem(prev => ({ ...prev, main_category_id: r.value.main_category_id, category_id: r.value.category_id }));
                                }
                              });
                            }}>
                            Change
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Name & Price Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
                    <div className="field-group">
                      <label className="field-label">Name <span className="req">*</span></label>
                      <input type="text" placeholder="e.g. Chicken Biryani" required style={{ background: 'var(--input-bg)' }} value={newItem.name}
                        onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Price ₹ <span className="req">*</span></label>
                      <input type="number" placeholder="0" required style={{ background: 'var(--input-bg)', textAlign: 'right', fontWeight: 700 }} value={newItem.price || ''}
                        onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) })} />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="field-group">
                    <label className="field-label">Description <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 11 }}>optional</span></label>
                    <textarea placeholder="Brief description shown to customers in menu" value={newItem.description}
                      style={{ background: 'var(--input-bg)', border: 'none', padding: '12px 15px', borderRadius: 12, minHeight: 70, resize: 'vertical', fontSize: 14 }}
                      onChange={e => setNewItem({ ...newItem, description: e.target.value })} />
                  </div>

                  {/* Image Upload */}
                  <div className="field-group">
                    <label className="field-label">Image <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 11 }}>optional</span></label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {newItem.image_url && (
                        <img src={newItem.image_url} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }} />
                      )}
                      <label style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '12px 14px', borderRadius: 10, border: '1.5px dashed var(--border)',
                        cursor: 'pointer', transition: 'all 0.15s', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                        background: 'var(--surface-alt)'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        {newItem.image_url ? 'Change Image' : 'Upload Dish Image'}
                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* ═════ STEP 2: ATTRIBUTES ═════ */}
              {formStep === 2 && (
                <>
                  <PillRadio
                    label="Food Type"
                    value={newItem.item_type}
                    onChange={v => setNewItem({ ...newItem, item_type: v })}
                    options={[
                      { value: 'veg', label: 'Vegetarian', dot: '#1DB954' },
                      { value: 'non-veg', label: 'Non-Veg', dot: '#E53935' },
                      { value: 'mixed', label: 'Mixed', dot: '#F59E0B' }
                    ]}
                    hint="Mixed = staples like breads or rice shown to all customers"
                  />

                  <div className="form-grid-2">
                    <div className="field-group">
                      <label className="field-label">Main Ingredient <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 11 }}>used by AI chat</span></label>
                      <select
                        value={newItem.main_ingredient || ''}
                        onChange={e => setNewItem({ ...newItem, main_ingredient: e.target.value })}
                        style={{ background: 'var(--input-bg)', border: 'none', padding: '13px 15px', borderRadius: 12, fontSize: 14, color: 'var(--text)', width: '100%' }}
                      >
                        <option value="">Select ingredient…</option>
                        {ingredients.map(ing => <option key={ing.id} value={ing.name}>{ing.name}</option>)}
                      </select>
                      <span className="field-hint">Manage this list under “Menu Setup”</span>
                    </div>

                    <div className="field-group">
                      <label className="field-label">Cuisine Label <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 11 }}>optional</span></label>
                      <select
                        value={newItem.cuisine || ''}
                        onChange={e => setNewItem({ ...newItem, cuisine: e.target.value })}
                        style={{ background: 'var(--input-bg)', border: 'none', padding: '13px 15px', borderRadius: 12, fontSize: 14, color: 'var(--text)', width: '100%' }}
                      >
                        <option value="">None / Others</option>
                        {cuisines.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                      <span className="field-hint">Shown as a chat filter only when cuisines are defined</span>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <PillRadio
                      label="Heaviness"
                      value={newItem.heaviness}
                      onChange={v => setNewItem({ ...newItem, heaviness: v })}
                      options={[
                        { value: 'light', label: 'Light' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'heavy', label: 'Heavy' }
                      ]}
                    />
                  </div>

                  <PillMulti
                    label="Taste Profile"
                    values={newItem.taste || []}
                    onChange={vals => setNewItem({ ...newItem, taste: vals })}
                    options={tastes.map(t => ({
                      value: t.name,
                      label: t.emoji ? `${t.emoji} ${t.name}` : t.name
                    }))}
                    hint={tastes.length === 0
                      ? "Add tastes under “Menu Setup” to enable flavour filtering in the chat"
                      : "Pick one or more; the chat lets customers filter by any matching flavour"}
                  />
                </>
              )}

              {/* ═════ STEP 3: AI RECOMMENDATIONS & VISIBILITY ═════ */}
              {formStep === 3 && (
                <>
                  <PillRadio
                    label="Display Priority"
                    value={newItem.priority || 'medium'}
                    onChange={v => setNewItem({ ...newItem, priority: v })}
                    options={[
                      { value: 'high', label: 'High (Top of list)' },
                      { value: 'medium', label: 'Standard' },
                      { value: 'low', label: 'Low (Bottom)' }
                    ]}
                    hint="Controls the sort order shown to customers in the digital menu"
                  />

                  <div className="field-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderRadius: 10 }}>
                    <div className="field-group" style={{ gap: 2 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Available to Customers</label>
                      <span className="field-hint">Toggle off to temporarily hide from customer menus</span>
                    </div>
                    <div onClick={() => setNewItem({ ...newItem, is_enabled: newItem.is_enabled !== false ? false : true })}
                      style={{ width: 44, height: 24, borderRadius: 24, cursor: 'pointer', background: newItem.is_enabled !== false ? '#1DB954' : '#CCC', position: 'relative', transition: '0.3s', flexShrink: 0 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#FFF', position: 'absolute', top: 2, left: newItem.is_enabled !== false ? 22 : 2, transition: '0.3s' }} />
                    </div>
                  </div>

                  {/* Associated Recommendations */}
                  <div className="section-divider" style={{ margin: '8px 0' }} />
                  <div className="section-header">AI Chat Assistant Recommendations</div>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>Items the AI waiter suggests, and shown as "others love to buy together" on the wishlist.</p>

                  {(() => {
                    const recs = itemRecs || {};
                    // Subcategories belonging to the selected main category filter
                    const subCatsForFilter = (categories || []).filter(c =>
                      recMainCatFilter === 'all' || c.main_category_id === recMainCatFilter
                    );
                    return (
                      <div style={{ marginBottom: 12 }}>
                        {Object.keys(recs).length > 0 && (
                          <div style={{ marginBottom: 6 }}>
                            {Object.entries(recs).map(([recId, recData]) => {
                              const item = items.find(i => i.id === recId);
                              if (!item) return null;
                              return (
                                <div key={recId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                                  <img src={item.image_url} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', background: 'var(--input-bg)', flexShrink: 0 }} />
                                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                  <select value={recData.priority} onChange={e => setItemRecs(prev => ({ ...prev, [recId]: { priority: e.target.value } }))}
                                    style={{ background: 'var(--input-bg)', border: 'none', padding: '3px 6px', borderRadius: 6, fontSize: 11 }}>
                                    <option value="high">High</option>
                                    <option value="medium">Med</option>
                                    <option value="low">Low</option>
                                  </select>
                                  <button type="button" onClick={() => {
                                    const updated = { ...itemRecs };
                                    delete updated[recId];
                                    setItemRecs(updated);
                                  }} style={{ background: 'none', border: 'none', color: '#FF4B4B', cursor: 'pointer', fontSize: 13, padding: 2 }}>✕</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 4, flexWrap: 'wrap' }}>
                          <div>
                            <select value={recMainCatFilter} onChange={e => { setRecMainCatFilter(e.target.value); setRecSubCatFilter('all'); }}
                              style={{ background: 'var(--input-bg)', border: 'none', padding: '8px 6px', borderRadius: 8, fontSize: 11 }}>
                              <option value="all">All Main Categories</option>
                              {(mainCategories || []).map(mc => (
                                <option key={mc.id} value={mc.id}>{mc.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <select value={recSubCatFilter} onChange={e => setRecSubCatFilter(e.target.value)}
                              style={{ background: 'var(--input-bg)', border: 'none', padding: '8px 6px', borderRadius: 8, fontSize: 11 }}>
                              <option value="all">All Subcategories</option>
                              {subCatsForFilter.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ flex: '1 1 140px', minWidth: 140 }}>
                            <select value={pendingRec} onChange={e => {
                              const id = e.target.value;
                              if (id) {
                                setItemRecs(prev => ({ ...prev, [id]: { priority: 'medium' } }));
                                setPendingRec('');
                              }
                            }}
                              style={{ width: '100%', background: 'var(--input-bg)', border: 'none', padding: '8px 10px', borderRadius: 8, fontSize: 12 }}>
                              <option value="">+ Add recommended item...</option>
                              {items.filter(i => i.id !== editItemId && !recs[i.id] &&
                                (recMainCatFilter === 'all' || i.main_category_id === recMainCatFilter) &&
                                (recSubCatFilter === 'all' || i.category_id === recSubCatFilter)
                              ).map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* ── Wizard Footer Actions ── */}
              <div style={{ display: 'flex', gap: 10, marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                {formStep > 1 ? (
                  <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={() => setFormStep(s => s - 1)}>
                    ← Back
                  </button>
                ) : (
                  <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={closeItemForm}>
                    Cancel
                  </button>
                )}

                {formStep < 3 ? (
                  <button key="next-btn" type="button" className="btn-primary" style={{ flex: 1 }} onClick={submitOrAdvance}>
                    Next →
                  </button>
                ) : (
                  <button key="submit-btn" type="submit" className="btn-primary" style={{ flex: 1 }}>
                    {editItemId ? 'Save Changes' : 'Add Item'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Menu Setup (Ingredients + Cuisines) Modal ═══ */}
      {showSetupForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSetupForm(false)}>
          <div className="modal-card">
            <div className="modal-head">
              <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Menu Setup</h3>
              <button type="button" className="modal-close" onClick={() => setShowSetupForm(false)} aria-label="Close">✕</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 16px' }}>
              Manage the pickable lists the AI chat uses to recommend dishes.
            </p>

            <div className="form-grid-2">
              {/* Ingredients */}
              <div className="field-box">
                <div className="section-header" style={{ margin: '0 0 10px' }}>Main Ingredients</div>
                <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
                  {ingredients.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>No ingredients yet.</div>
                  )}
                  {ingredients.map(ing => (
                    <div key={ing.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{ing.name}</span>
                      <button type="button" onClick={() => handleDeleteIngredient(ing.id)} style={{ background: 'none', border: 'none', color: '#FF4B4B', cursor: 'pointer', fontSize: 13 }}>✕</button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddIngredient} style={{ display: 'flex', gap: 6 }}>
                  <input type="text" placeholder="Add ingredient…" value={newIngredientName}
                    onChange={e => setNewIngredientName(e.target.value)}
                    style={{ flex: 1, background: 'var(--input-bg)', border: 'none', padding: '10px 12px', borderRadius: 10, fontSize: 13 }} />
                  <button type="submit" className="btn-primary" style={{ padding: '10px 16px', fontSize: 13 }}>Add</button>
                </form>
              </div>

              {/* Cuisines */}
              <div className="field-box">
                <div className="section-header" style={{ margin: '0 0 10px' }}>Cuisines (optional)</div>
                <span className="field-hint" style={{ display: 'block', marginBottom: 8 }}>Chat shows a cuisine filter only when this list has entries.</span>
                <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
                  {cuisines.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>No cuisines yet.</div>
                  )}
                  {cuisines.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                      <button type="button" onClick={() => handleDeleteCuisine(c.id)} style={{ background: 'none', border: 'none', color: '#FF4B4B', cursor: 'pointer', fontSize: 13 }}>✕</button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddCuisine} style={{ display: 'flex', gap: 6 }}>
                  <input type="text" placeholder="Add cuisine…" value={newCuisineName}
                    onChange={e => setNewCuisineName(e.target.value)}
                    style={{ flex: 1, background: 'var(--input-bg)', border: 'none', padding: '10px 12px', borderRadius: 10, fontSize: 13 }} />
                  <button type="submit" className="btn-primary" style={{ padding: '10px 16px', fontSize: 13 }}>Add</button>
                </form>
              </div>
            </div>

            {/* Tastes */}
            <div className="field-box" style={{ marginTop: 12 }}>
              <div className="section-header" style={{ margin: '0 0 4px' }}>Tastes (optional)</div>
              <span className="field-hint" style={{ display: 'block', marginBottom: 8 }}>Multi-select flavour tags shown on items; the chat shows a flavour filter only when this list has entries.</span>
              <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
                {tastes.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>No tastes yet.</div>
                )}
                {tastes.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t.emoji ? `${t.emoji} ${t.name}` : t.name}</span>
                    <button type="button" onClick={() => handleDeleteTaste(t.id)} style={{ background: 'none', border: 'none', color: '#FF4B4B', cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddTaste} style={{ display: 'flex', gap: 6 }}>
                <input type="text" placeholder="Add taste (e.g. Spicy)…" value={newTasteName}
                  onChange={e => setNewTasteName(e.target.value)}
                  style={{ flex: 1, background: 'var(--input-bg)', border: 'none', padding: '10px 12px', borderRadius: 10, fontSize: 13 }} />
                <input type="text" placeholder="Emoji" value={newTasteEmoji}
                  onChange={e => setNewTasteEmoji(e.target.value)}
                  style={{ width: 70, background: 'var(--input-bg)', border: 'none', padding: '10px 12px', borderRadius: 10, fontSize: 13, textAlign: 'center' }} />
                <button type="submit" className="btn-primary" style={{ padding: '10px 16px', fontSize: 13 }}>Add</button>
              </form>
            </div>

            <button type="button" className="btn-primary" style={{ width: '100%', marginTop: 16 }}
              onClick={() => setShowSetupForm(false)}>Done</button>
          </div>
        </div>
      )}

      {/* ═══ Import from Excel / POS sync report Modal ═══ */}
      {(showImportForm || importReport) && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeImportForm()}>
          <div className="modal-card">
            <div className="modal-head">
              <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>{importReport ? 'Menu Sync Report' : 'Import Menu from Excel'}</h3>
              <button type="button" className="modal-close" onClick={closeImportForm} aria-label="Close">✕</button>
            </div>

            {!importReport ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Download the template (it comes as a ZIP with a step-by-step instruction guide), fill in your items, then upload the .xlsx here. Categories, ingredients, cuisines and tastes are created automatically when they don't already exist. Duplicate item names fail individually without blocking the rest.
                </p>
                <button type="button" className="btn-excel" onClick={handleDownloadTemplate} style={{ alignSelf: 'flex-start' }}>
                  <ExcelIcon /> Download blank template
                </button>
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '18px 14px', borderRadius: 12, border: '1.5px dashed var(--border)',
                  cursor: 'pointer', background: 'var(--surface-alt)', fontSize: 13, fontWeight: 600,
                  color: importFile ? 'var(--text)' : 'var(--text-muted)'
                }}>
                  {importFile ? `📄 ${importFile.name}` : 'Choose Excel file (.xlsx or .zip)'}
                  <input type="file" accept=".xlsx,.xls,.zip" onChange={e => setImportFile(e.target.files[0] || null)} style={{ display: 'none' }} />
                </label>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={closeImportForm}>Cancel</button>
                  <button type="button" className="btn-primary" style={{ flex: 1, opacity: importing ? 0.6 : 1 }} disabled={importing} onClick={handleImport}>
                    {importing ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1, background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.22)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#1DB954' }}>{importReport.added}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Added</div>
                  </div>
                  {typeof importReport.updated === 'number' && (
                    <div style={{ flex: 1, background: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.22)', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ fontSize: 26, fontWeight: 900, color: '#2196F3' }}>{importReport.updated}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Updated</div>
                    </div>
                  )}
                  <div style={{ flex: 1, background: 'rgba(255,75,75,0.06)', border: '1px solid rgba(255,75,75,0.2)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#FF4B4B' }}>{importReport.failed}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Failed</div>
                  </div>
                </div>

                {importReport.failed > 0 && (
                  <div>
                    <div className="section-header" style={{ marginTop: 0 }}>Failed rows</div>
                    <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }} className="hide-scroll">
                      {importReport.failures.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-muted)', minWidth: 46 }}>{f.row ? `Row ${f.row}` : `#${i + 1}`}</span>
                          <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || '(empty)'}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#FF4B4B', background: 'rgba(255,75,75,0.08)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{f.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importReport.failed === 0 && (importReport.added > 0 || importReport.updated > 0) && (
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    {importReport.added} item{importReport.added !== 1 ? 's' : ''} added{typeof importReport.updated === 'number' && importReport.updated > 0 ? `, ${importReport.updated} updated` : ''} successfully.
                  </p>
                )}

                <button type="button" className="btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={closeImportForm}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
