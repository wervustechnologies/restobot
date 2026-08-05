import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [videoEnded, setVideoEnded] = useState(false);

  // Auto-navigate when video ends
  useEffect(() => {
    if (videoEnded) {
      navigate(`/menu${location.search}`);
    }
  }, [videoEnded, navigate, location.search]);

  // Fallback: If video doesn't load or play, redirect after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVideoEnded(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleVideoEnd = () => {
    setVideoEnded(true);
  };

  return (
    <div style={{ 
      position: 'fixed',
      inset: 0, // Top, Bottom, Left, Right = 0
      backgroundColor: '#000',
      zIndex: 9999,
      overflow: 'hidden',
      display: 'block'
    }}>
      <video
        autoPlay
        muted
        playsInline
        webkit-playsinline="true"
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        onEnded={handleVideoEnd}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          touchAction: 'none'
        }}
      >
        <source src="/splash.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Subtle Skip Button */}
      <button 
        onClick={() => setVideoEnded(true)}
        style={{
          position: 'absolute',
          bottom: '40px',
          right: '40px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#FFF',
          padding: '10px 20px',
          borderRadius: '30px',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 10,
          backdropFilter: 'blur(10px)',
          fontWeight: 600
        }}>
        Skip Intro →
      </button>

      {/* Branding Overlay */}
      <div style={{
        position: 'absolute',
        top: '40px',
        width: '100%',
        textAlign: 'center',
        zIndex: 5,
        opacity: 0.4
      }}>
        <span style={{ fontSize: '11px', letterSpacing: '4px', color: '#FFF', fontWeight: 800 }}>
          DISHLYST AI
        </span>
      </div>
    </div>
  );
}
