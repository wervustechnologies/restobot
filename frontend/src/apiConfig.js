// In production (Vercel): set VITE_API_BASE_URL to your Render backend URL
// e.g. https://restobot-backend.onrender.com/api
// In local dev: falls back to http://YOUR_LOCAL_IP:5000/api automatically
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:5000/api`;
