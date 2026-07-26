import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL as API } from '../apiConfig';
import { useGuest } from '../context/GuestContext';
import './QRLandingPage.css';

export default function QRLandingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { guest } = useGuest();

  const qrToken = searchParams.get('t');

  const [restaurantName, setRestaurantName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [reviewLink, setReviewLink] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [loading, setLoading] = useState(true);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Call waiter state
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);

  // Resolve QR token → restaurant info
  useEffect(() => {
    if (!qrToken) return;

    const load = async () => {
      try {
        // Step 1: resolve table token
        const tableRes = await fetch(`${API}/table/${qrToken}`);
        const tableData = await tableRes.json();

        if (!tableData.restaurant_id) {
          setLoading(false);
          return;
        }

        setRestaurantId(tableData.restaurant_id);
        setTableNumber(tableData.table_number);

        // Step 2: get restaurant info from menu endpoint
        const menuRes = await fetch(`${API}/menu/${tableData.restaurant_id}`);
        const menuData = await menuRes.json();

        setRestaurantName(menuData.restaurant?.name || 'Welcome');
        setReviewLink(menuData.restaurant?.review_link || '');
      } catch (err) {
        console.error('Failed to load restaurant info:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [qrToken]);

  const handleMenuClick = () => {
    navigate(`/menu?t=${qrToken}`);
  };

  const handleReviewClick = () => {
    if (reviewLink) {
      window.open(reviewLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleFeedbackSubmit = async () => {
    if (feedbackRating === 0) return;
    setSubmitting(true);

    try {
      await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          guest_id: guest?.guest_id || null,
          rating: feedbackRating,
          comment: feedbackText.trim(),
          table_number: tableNumber
        })
      });
      setFeedbackSubmitted(true);
      setTimeout(() => {
        setShowFeedback(false);
        setFeedbackSubmitted(false);
        setFeedbackRating(0);
        setFeedbackText('');
      }, 2500);
    } catch (err) {
      console.error('Feedback submission failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallWaiter = async () => {
    if (waiterCalled || callingWaiter || !qrToken) return;
    setCallingWaiter(true);
    try {
      await fetch(`${API}/table/${qrToken}/call-waiter`, { method: 'POST' });
      setWaiterCalled(true);
      setTimeout(() => setWaiterCalled(false), 30000); // Reset after 30s
    } catch (err) {
      console.error('Failed to call waiter:', err);
    } finally {
      setCallingWaiter(false);
    }
  };

  const hasReview = !!reviewLink;

  if (loading) {
    return (
      <div className="qr-landing">
        <div className="qr-landing__particles">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="qr-landing__particle" />
          ))}
        </div>
        <div className="qr-landing__loading">
          <div className="qr-landing__loading-spinner" />
          <span className="qr-landing__loading-text">Preparing your experience</span>
        </div>
      </div>
    );
  }

  return (
    <div className="qr-landing">
      {/* Floating particles */}
      <div className="qr-landing__particles">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="qr-landing__particle" />
        ))}
      </div>

      <div className="qr-landing__inner">
        {/* Header */}
        <div className="qr-landing__header">
          {tableNumber && (
            <div className="qr-landing__table-badge">
              <span>Table {tableNumber}</span>
            </div>
          )}
          <h1 className="qr-landing__restaurant-name">{restaurantName}</h1>
          <p className="qr-landing__subtitle">Welcome</p>
        </div>

        {/* Hero — Smart Menu */}
        <div className="qr-landing__hero">
          <div className="qr-landing__hero-card" onClick={handleMenuClick}>
            <div className="qr-landing__hero-icon">
              {/* Fork & Knife icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                <path d="M7 2v20" />
                <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
              </svg>
            </div>
            <h2 className="qr-landing__hero-title">Smart Menu</h2>
            <p className="qr-landing__hero-desc">
              Browse dishes, get Smart recommendations, and order directly from your table.
            </p>
            <button className="qr-landing__hero-cta" type="button">
              Explore Menu
              {/* Arrow icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Call Waiter Button */}
        <div className="qr-landing__call-waiter" style={{ animation: 'landingFadeUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both' }}>
          <button
            className={`qr-landing__waiter-btn ${waiterCalled ? 'qr-landing__waiter-btn--called' : ''}`}
            onClick={handleCallWaiter}
            disabled={waiterCalled || callingWaiter}
            type="button"
          >
            <span className="qr-landing__waiter-icon">
              {waiterCalled ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              )}
            </span>
            {callingWaiter ? 'Calling...' : waiterCalled ? 'Waiter Notified!' : 'Call Waiter'}
          </button>
        </div>

        {/* Secondary Options */}
        <div className={`qr-landing__secondary ${!hasReview ? 'qr-landing__secondary--single' : ''}`}>
          {/* Google Review — only if restaurant has a valid link */}
          {hasReview && (
            <div
              className="qr-landing__sec-card qr-landing__sec-card--review"
              onClick={handleReviewClick}
            >
              <div className="qr-landing__sec-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7" />
                  <path d="M7 7h10v10" />
                </svg>
              </div>
              <div className="qr-landing__sec-icon qr-landing__sec-icon--review">
                {/* Google "G" logo — official 4-color mark */}
                <svg viewBox="0 0 48 48" width="24" height="24">
                  <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.9 7.35 2.56 10.52l7.97-5.93z"/>
                  <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.93C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              </div>
              <h3 className="qr-landing__sec-title">Google Review</h3>
              <p className="qr-landing__sec-desc">Rate us on Google</p>
            </div>
          )}

          {/* Feedback */}
          <div
            className="qr-landing__sec-card qr-landing__sec-card--feedback"
            onClick={() => setShowFeedback(true)}
          >
            <div className="qr-landing__sec-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
            <div className="qr-landing__sec-icon qr-landing__sec-icon--feedback">
              {/* Chat/Feedback icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="qr-landing__sec-title">Feedback</h3>
            <p className="qr-landing__sec-desc">Tell us how we're doing</p>
          </div>
        </div>

        {/* Footer */}
        <div className="qr-landing__footer">
          <p className="qr-landing__powered">
            Powered by <strong>Restobot</strong>
          </p>
        </div>
      </div>

      {/* --------- Feedback Bottom Sheet --------- */}
      {showFeedback && (
        <div className="qr-landing__feedback-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowFeedback(false);
        }}>
          <div className="qr-landing__feedback-sheet">
            <div className="qr-landing__feedback-handle" />

            {feedbackSubmitted ? (
              <div className="qr-landing__feedback-success">
                <div className="qr-landing__feedback-success-icon">✓</div>
                <h3>Thank You!</h3>
                <p>Your feedback means a lot to us.</p>
              </div>
            ) : (
              <>
                <h2 className="qr-landing__feedback-title">How was your experience?</h2>
                <p className="qr-landing__feedback-subtitle">
                  Your feedback helps us serve you better
                </p>

                {/* Star Rating */}
                <div className="qr-landing__stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`qr-landing__star ${feedbackRating >= star ? 'qr-landing__star--active' : ''}`}
                      onClick={() => setFeedbackRating(star)}
                    >
                      {feedbackRating >= star ? '★' : '☆'}
                    </button>
                  ))}
                </div>

                <textarea
                  className="qr-landing__feedback-textarea"
                  placeholder="Tell us more about your experience (optional)..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={4}
                />

                <button
                  className="qr-landing__feedback-submit"
                  onClick={handleFeedbackSubmit}
                  disabled={feedbackRating === 0 || submitting}
                  type="button"
                >
                  {submitting ? 'Sending...' : 'Submit Feedback'}
                </button>

                <div className="qr-landing__feedback-actions">
                  <button
                    className="qr-landing__feedback-cancel"
                    onClick={() => setShowFeedback(false)}
                    type="button"
                  >
                    Maybe later
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
