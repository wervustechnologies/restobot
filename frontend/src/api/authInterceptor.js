/**
 * window.fetch interceptor: automatic access-token refresh on 401.
 *
 * WHY ONLY BEARER REQUESTS ARE TOUCHED
 * ------------------------------------
 * This app hosts two authenticated session types simultaneously — admin and
 * waiter — distinguished only by their localStorage keys. Guest/customer flows
 * (QR `?t=` links) never send an `Authorization` header; they authenticate via
 * the query param server-side. To avoid touching those, this interceptor is a
 * no-op for every request that has no `Authorization: Bearer <token>` header.
 * Login, refresh, logout, OPTIONS preflight, and all public endpoints therefore
 * pass through untouched.
 *
 * SESSION DETECTION (route-independent)
 * -------------------------------------
 * We do NOT key off the request URL to decide which session a 401 belongs to —
 * both admins and waiters hit overlapping API routes. Instead, on a 401 we read
 * the presented bearer token and find the SESSION whose
 * `localStorage[accessKey]` equals that exact token string. The token uniquely
 * identifies the session because admin and waiter JWTs are distinct and stored
 * under different keys. If no session matches (e.g. the token was already
 * rotated/cleared), the original 401 response is returned unchanged so the
 * caller fails gracefully.
 *
 * REFRESH-TOKEN STORAGE TRADEOFF
 * ------------------------------
 * Refresh tokens currently live in localStorage to stay symmetric with the
 * existing dual-Vite-app setup (admin + waiter share one storage namespace but
 * use distinct keys). localStorage is readable by XSS, so the long-lived
 * refresh token is somewhat exposed. Migrating to httpOnly+Secure cookies later
 * is localized to this module (the refresh request would rely on the cookie
 * instead of the JSON body) plus the login/logout writers in AuthContext,
 * AdminLogin, WaiterLogin, and WaiterHome. Nothing else in the app would need
 * to change. We accept the localStorage tradeoff for now because the
 * two-session model is simpler with explicit keys.
 *
 * GUEST `?t=` FLOWS
 * -----------------
 * Intentionally untouched: those requests carry no Authorization header and
 * fall into the pass-through branch above.
 *
 * The patch is framework-agnostic (no React) and installs before React mounts.
 */

import { API_BASE_URL } from '../apiConfig';

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} accessKey   localStorage key holding the access JWT
 * @property {string} refreshKey  localStorage key holding the opaque refresh token
 * @property {string[]} clearKeys localStorage keys to wipe on refresh failure
 * @property {string} loginUrl    redirect target when the session dies
 */
const SESSIONS = [
  {
    id: 'admin',
    accessKey: 'token',
    refreshKey: 'refresh_token',
    clearKeys: ['token', 'user', 'refresh_token'],
    loginUrl: '/admin/login',
  },
  {
    id: 'waiter',
    accessKey: 'waiter_token',
    refreshKey: 'waiter_refresh_token',
    clearKeys: ['waiter_token', 'waiter_user', 'waiter_rid', 'waiter_refresh_token'],
    loginUrl: '/waiter/login',
  },
];

/** Native fetch captured at install time. All internal calls use this to avoid recursion. */
let originalFetch = null;

/** Per-session in-flight refresh promises (single-flight within each session). */
const refreshPromises = new Map();

/**
 * Return the SESSION whose stored access token equals the presented one.
 * @param {string} presentedAccessToken
 * @returns {Session|null}
 */
function detectSession(presentedAccessToken) {
  if (!presentedAccessToken) return null;
  for (const s of SESSIONS) {
    if (localStorage.getItem(s.accessKey) === presentedAccessToken) {
      return s;
    }
  }
  return null;
}

/** Remove every localStorage key registered for a session. */
function clearSession(session) {
  session.clearKeys.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage unavailable */
    }
  });
}

/**
 * Normalize a fetch `input` argument to a URL string.
 * Supports string, URL, and Request.
 * @param {RequestInfo|URL} input
 * @returns {string}
 */
function normalizeInputToString(input) {
  if (typeof input === 'string') return input;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.toString();
  return String(input);
}

/**
 * Build a merged Headers view from a (input, init) pair. `init.headers`
 * overrides Request headers, mirroring the fetch spec.
 * @param {RequestInfo|URL} input
 * @param {RequestInit} [init]
 * @returns {Headers}
 */
function mergedHeaders(input, init) {
  const headers = new Headers();
  try {
    if (typeof Request !== 'undefined' && input instanceof Request) {
      input.headers.forEach((value, key) => headers.set(key, value));
    }
    if (init && init.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
  } catch {
    /* ignore malformed header input */
  }
  return headers;
}

/**
 * Extract the bearer token from a request, or null if absent/non-bearer.
 * @param {RequestInfo|URL} input
 * @param {RequestInit} [init]
 * @returns {string|null}
 */
function extractBearerToken(input, init) {
  const auth = mergedHeaders(input, init).get('Authorization');
  if (!auth) return null;
  const match = /^\s*Bearer\s+(.+?)\s*$/i.exec(auth);
  return match ? match[1] : null;
}

/**
 * Refresh a session's access token via the backend. Single-flight per session:
 * concurrent 401s for the SAME session share one promise, while different
 * sessions (admin vs waiter) refresh independently. Resolves with the new
 * access token string. Rejects if there is no refresh token or the backend
 * refuses.
 * @param {Session} session
 * @returns {Promise<string>}
 */
function doRefresh(session) {
  if (refreshPromises.has(session.id)) return refreshPromises.get(session.id);

  const p = (async () => {
    const refreshToken = localStorage.getItem(session.refreshKey);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const res = await originalFetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      throw new Error(`Refresh failed (${res.status})`);
    }

    const data = await res.json();
    localStorage.setItem(session.accessKey, data.token);
    localStorage.setItem(session.refreshKey, data.refresh_token);

    // Notify React (admin AuthContext) so its in-memory token state stays in
    // sync with the rotated token and avoids redundant 401s right after a
    // background refresh.
    try {
      window.dispatchEvent(
        new CustomEvent('restobot:token-refreshed', {
          detail: { sessionId: session.id, token: data.token },
        })
      );
    } catch {
      /* dispatch best-effort */
    }

    return data.token;
  })();

  refreshPromises.set(session.id, p);
  p.finally(() => refreshPromises.delete(session.id));
  return p;
}

/**
 * The patched fetch. See module JSDoc for the full contract.
 * @param {RequestInfo|URL} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
async function patchedFetch(input, init) {
  // Recursion guard: never intercept the refresh call itself (also uses the
  // saved native fetch, so it could not recurse anyway — belt and suspenders).
  const urlStr = normalizeInputToString(input);
  if (urlStr.includes('/auth/refresh')) {
    return originalFetch(input, init);
  }

  // Pass-through anything without a Bearer token (login, guest, public, OPTIONS).
  const presentedToken = extractBearerToken(input, init);
  if (!presentedToken) {
    return originalFetch(input, init);
  }

  // Keep an unconsumed clone for the one-shot retry when the caller passed a
  // Request with a body stream. String-URL callers are unaffected: their body
  // lives in `init` and can be reused directly across calls.
  let retryInput = null;
  if (typeof Request !== 'undefined' && input instanceof Request) {
    try {
      retryInput = input.clone();
    } catch {
      retryInput = null;
    }
  }

  // First attempt.
  const response = await originalFetch(input, init);
  if (response.status !== 401) return response;

  // Identify the session by the token that was actually sent.
  const session = detectSession(presentedToken);
  if (!session) return response; // unknown token — don't guess

  // Attempt a single shared refresh.
  let newToken;
  try {
    newToken = await doRefresh(session);
  } catch {
    clearSession(session);
    window.location.href = session.loginUrl;
    return Promise.reject(new Error('Session expired'));
  }

  // Retry exactly once with the rotated access token, preserving method/body.
  // Uses the native fetch so a second 401 does not loop back in here.
  const retryHeaders = mergedHeaders(input, init);
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  const retryInit = { ...init, headers: retryHeaders };
  return originalFetch(retryInput || input, retryInit);
}

/**
 * Install the fetch interceptor. Idempotent: safe to call (or import) multiple
 * times. Called once at module load below so a bare
 * `import './api/authInterceptor'` activates it.
 */
export function installFetchInterceptor() {
  if (typeof window === 'undefined') return;
  if (window.__fetchInterceptorInstalled) return;
  if (typeof window.fetch !== 'function') return;

  originalFetch = window.fetch;
  window.fetch = patchedFetch;
  window.__fetchInterceptorInstalled = true;
}

installFetchInterceptor();
