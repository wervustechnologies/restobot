import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'qrcode';
import { PUBLIC_URL, API_BASE_URL } from '../../apiConfig';
import Swal from 'sweetalert2';

export default function AdminTables() {
  const [tables, setTables] = useState([]);
  const [newTableNum, setNewTableNum] = useState('');
  const [qrCodes, setQrCodes] = useState({});
  const [tablesLoading, setTablesLoading] = useState(true);
  const { token, user } = useAuth();

  const fetchData = async () => {
    setTablesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/tables`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        setTables([]);
        return;
      }
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);

      // Generate QR codes
      const codes = {};
      for (const table of Array.isArray(data) ? data : []) {
        const url = `${PUBLIC_URL}/?t=${table.qr_token}`;
        codes[table.id] = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
      }
      setQrCodes(codes);
    } catch (error) {
      console.error("Error fetching tables or server info:", error);
      setTables([]);
    }
    setTablesLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleAddTable = async (e) => {
    e.preventDefault();
    await fetch(`${API_BASE_URL}/admin/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ table_number: newTableNum })
    });
    setNewTableNum('');
    Swal.fire({
      title: 'Success!',
      text: 'Table added successfully',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    });
    fetchData();
  };

  const downloadQR = (tableId, tableNum) => {
    const link = document.createElement('a');
    link.href = qrCodes[tableId];
    link.download = `table-${tableNum}-qr.png`;
    link.click();
  };

  const handleDeleteTable = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#FF4B4B',
      cancelButtonColor: '#ccc',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      await fetch(`${API_BASE_URL}/admin/tables/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      Swal.fire({
        title: 'Deleted!',
        text: 'Table has been deleted.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      fetchData();
    }
  };

  if (tablesLoading) return (
    <div style={{ padding: '20px' }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 20 }}>
        <div>
          <div className="skeleton skeleton-text lg" style={{ width: 200, marginBottom: 8 }} />
          <div className="skeleton skeleton-text sm" style={{ width: 280 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skeleton skeleton-rect" style={{ width: 180, height: 44 }} />
          <div className="skeleton skeleton-rect" style={{ width: 110, height: 44 }} />
        </div>
      </div>

      {/* QR cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 25 }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="skeleton-card" style={{ padding: 25, textAlign: 'center' }}>
            <div className="skeleton skeleton-rect" style={{ width: 60, height: 22, position: 'absolute', top: 15, right: 15 }} />
            <div className="skeleton skeleton-text md" style={{ width: '50%', margin: '0 auto 5px' }} />
            <div className="skeleton skeleton-rect" style={{ width: 180, height: 180, margin: '20px auto', borderRadius: 12 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div className="skeleton skeleton-rect" style={{ flex: 1, height: 40 }} />
              <div className="skeleton skeleton-rect" style={{ flex: 1, height: 40 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px' }}>
      <style>{`
        .add-table-form { display: flex; gap: 10px; }
        .add-table-input { text-align: left; background: #F5F5F5; min-width: 180px; flex: 1; }
        @media (max-width: 640px) {
          .add-table-form { width: 100%; flex-direction: column; }
          .add-table-input { width: 100%; box-sizing: border-box; }
          .add-table-form button { width: 100%; box-sizing: border-box; }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '1 1 300px' }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 5 }}>Table Manager</h1>
          <p style={{ color: '#666' }}>Generate and download QR codes for your tables.</p>
        </div>
        <form onSubmit={handleAddTable} className="add-table-form">
          <input type="text" placeholder="Table Name/Number" required className="btn-outline add-table-input"
            value={newTableNum} onChange={e => setNewTableNum(e.target.value)} />
          <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>+ Add Table</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 25 }}>
        {tables.map(table => (
          <div key={table.id} className="card" style={{ padding: 25, textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 15, right: 15, background: 'rgba(255,107,53,0.1)', color: '#FF6B35', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              Active
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 5 }}>Table {table.table_number}</h3>

            {qrCodes[table.id] ? (
              <div style={{ background: '#FFF', padding: 15, borderRadius: 12, margin: '20px auto', display: 'inline-block', border: '1px solid #EEE' }}>
                <img src={qrCodes[table.id]} style={{ width: 180, height: 180, display: 'block' }} />
              </div>
            ) : (
              <div style={{ width: 180, height: 180, margin: '20px auto', background: '#F9F9F9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="loader"></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                onClick={() => downloadQR(table.id, table.table_number)}
                className="btn-primary" style={{ flex: 1, padding: '10px', fontSize: 14 }}>
                Download
              </button>
              <button
                onClick={() => handleDeleteTable(table.id)}
                className="btn-outline" style={{ flex: 1, padding: '10px', fontSize: 14, color: '#FF4B4B', borderColor: 'rgba(255,0,0,0.2)' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

