import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import Swal from 'sweetalert2';

export default function AdminReviews() {
  const { token } = useAuth();
  const [reviewLink, setReviewLink] = useState('');
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [resRes, fbRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/restaurant`, { headers }),
        fetch(`${API_BASE_URL}/admin/feedback`, { headers })
      ]);
      if (resRes.ok) {
        const resData = await resRes.json();
        setReviewLink(resData.review_link || '');
      }
      if (fbRes.ok) {
        setFeedbackList(await fbRes.json());
      }
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  const saveReviewLink = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/restaurant`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ review_link: reviewLink })
      });
      if (res.ok) {
        Swal.fire({ icon: 'success', title: 'Saved', text: 'Review link updated', timer: 1500, showConfirmButton: false });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save' });
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < rating ? '#FFD700' : '#DDD', fontSize: 18, marginRight: 2 }}>★</span>
    ));
  };

  if (loading) {
    return (
      <div>
        {/* Title skeleton */}
        <div className="skeleton skeleton-text lg" style={{ width: 220, marginBottom: 24 }} />

        {/* Review link card skeleton */}
        <div className="skeleton-card" style={{ padding: 24, marginBottom: 24 }}>
          <div className="skeleton skeleton-text md" style={{ width: '45%', marginBottom: 16 }} />
          <div className="skeleton skeleton-text" style={{ width: '80%', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="skeleton skeleton-rect" style={{ flex: 1, height: 48 }} />
            <div className="skeleton skeleton-rect" style={{ width: 80, height: 48 }} />
          </div>
        </div>

        {/* Feedback list skeleton */}
        <div className="skeleton-card" style={{ padding: 24 }}>
          <div className="skeleton skeleton-text md" style={{ width: '35%', marginBottom: 16 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ padding: 16, borderRadius: 12, background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1,2,3,4,5].map(s => (
                      <div key={s} className="skeleton skeleton-rect" style={{ width: 18, height: 18 }} />
                    ))}
                  </div>
                  <div className="skeleton skeleton-text sm" style={{ width: 100 }} />
                </div>
                <div className="skeleton skeleton-text" style={{ width: `${70 + (i * 8) % 25}%`, marginBottom: 6 }} />
                <div className="skeleton skeleton-text sm" style={{ width: '45%' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 24 }}>Reviews & Feedback</h1>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Google Reviews Link</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Set the Google Reviews URL for your restaurant. Customers will be redirected here when they tap "Reviews" on the menu page.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            value={reviewLink}
            onChange={e => setReviewLink(e.target.value)}
            placeholder="https://search.google.com/local/writereview?placeid=..."
            style={{ flex: 1 }}
          />
          <button onClick={saveReviewLink} className="btn-primary" disabled={saving} style={{ whiteSpace: 'nowrap', padding: '14px 24px' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
          User Feedback ({feedbackList.length})
        </h2>
        {feedbackList.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No feedback received yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {feedbackList.map(fb => (
              <div key={fb.id} style={{
                padding: 16,
                borderRadius: 12,
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>{renderStars(fb.rating)}</div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(fb.created_at * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {fb.description && (
                  <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{fb.description}</p>
                )}
                {fb.guest_id && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Guest: #{fb.guest_id.substring(0, 8)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
