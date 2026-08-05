/**
 * @file authInterceptor.js
 * @description
 * Self-contained, idempotent `window.fetch` monkey-patch that adds transparent
 * access-token auto-refresh to the superadmin frontend.
 *
 * Design
 * ------
 * - Patches `window.fetch` once (guarded by `window.__fetchInterceptorInstalled`).
 * - The ORIGINAL fetch is captured at install time and used for (a) the refresh
 *   call and (b) the single retry, so neither is re-intercepted.
 * - On a 401 from an authenticated request, a single-flight refresh is performed
 *   (`refreshPromise` is shared across concurrent callers), the new access token
 *   is persisted, and the original request is retried EXACTLY ONCE with the new
 *   `Authorization` header. Method / body / other headers are preserved.
 * - Requests that carry no `Authorization` header (login, preflight) and any
 *   request whose URL is the refresh endpoint are passed through untouched
 *   (recursion guard).
 * - If the refresh itself fails, both tokens are cleared and the user is sent to
 *   the login URL; the call rejects so callers' catch blocks still run.
 *
 * localStorage vs. cookies
 * -------------------------
 * Tokens currently live in `localStorage` for simplicity and because this is a
 * single-session admin tool. localStorage is readable by any same-origin script
 * (XSS-exposed); the refresh flow is intentionally isolated inside this module
 * (only `ACCESS_KEY` / `REFRESH_KEY` constants + the two write sites in Login /
 * Dashboard touch storage) so a future migration to httpOnly cookies can be done
 * by swapping this one module + the login response handling, without touching
 * call sites.
 *
 * Session scope
 * -------------
 * This app is isolated and manages exactly ONE session
 * (`superadminToken` / `superadminRefreshToken`). There is no shared code with
 * the main `frontend/` app, so no multi-session fanout is needed here.
 */

const ACCESS_KEY = 'superadminToken';
const REFRESH_KEY = 'superadminRefreshToken';
const LOGIN_URL = '/login';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const REFRESH_URL = `${API_BASE}/api/auth/refresh`;
const LOGOUT_URL = `${API_BASE}/api/auth/logout`;

let originalFetch = null;
let refreshPromise = null;

/**
 * Normalize a fetch `input` argument to a URL string for guard checks.
 */
function getRequestUrl(input) {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return String(input);
}

/**
 * Read the `Authorization` header value (if any) from a headers container.
 * Accepts a Headers instance, an array of [key, value], or a plain object.
 */
function readAuthorizationHeader(headers) {
  if (!headers) return null;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get('Authorization');
  }
  if (Array.isArray(headers)) {
    for (const pair of headers) {
      if (Array.isArray(pair) && typeof pair[0] === 'string' && pair[0].toLowerCase() === 'authorization') {
        return pair[1];
      }
    }
    return null;
  }
  if (typeof headers === 'object') {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'authorization') return headers[key];
    }
  }
  return null;
}

/**
 * Determine whether the outgoing request carries an Authorization header,
 * checking `init.headers` first, then a `Request` object's own headers.
 */
function requestHasAuth(input, init) {
  const fromInit = readAuthorizationHeader(init && init.headers);
  if (fromInit) return true;
  if (typeof Request !== 'undefined' && input instanceof Request) {
    try {
      if (input.headers.get('Authorization')) return true;
    } catch (_) {
      /* ignore */
    }
  }
  return false;
}

/**
 * Recursion guard: never intercept the refresh endpoint.
 */
function isRefreshUrl(url) {
  if (url === REFRESH_URL) return true;
  return typeof url === 'string' && url.indexOf('/auth/refresh') !== -1;
}

/**
 * Collect all existing request headers (from init and, if a Request, its own
 * headers) into a fresh plain object so the retry can preserve them.
 */
function collectHeaders(input, init) {
  const out = {};
  const merge = (headers) => {
    if (!headers) return;
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
      headers.forEach((value, key) => { out[key] = value; });
    } else if (Array.isArray(headers)) {
      for (const pair of headers) {
        if (Array.isArray(pair)) out[pair[0]] = pair[1];
      }
    } else if (typeof headers === 'object') {
      for (const key of Object.keys(headers)) out[key] = headers[key];
    }
  };
  merge(init && init.headers);
  if (typeof Request !== 'undefined' && input instanceof Request) {
    try {
      input.headers.forEach((value, key) => { out[key] = value; });
    } catch (_) {
      /* ignore */
    }
  }
  return out;
}

/**
 * Rebuild the (input, init) pair with a fresh Authorization header, preserving
 * method / body / other headers. If `input` was a Request object, downgrade to
 * its URL string so the original Request body is not re-consumed.
 */
function rebuildWithAuth(input, init, newToken) {
  const headers = collectHeaders(input, init);
  headers['Authorization'] = `Bearer ${newToken}`;

  const rebuiltInit = Object.assign({}, init || {});
  rebuiltInit.headers = headers;

  let rebuiltInput = input;
  if (typeof Request !== 'undefined' && input instanceof Request) {
    rebuiltInput = input.url;
    if (!('method' in rebuiltInit) && input.method) {
      rebuiltInit.method = input.method;
    }
  }
  return { input: rebuiltInput, init: rebuiltInit };
}

/**
 * Single-flight refresh. Concurrent callers share one in-flight promise.
 * Resolves with the new access token; rejects if there is no refresh token or
 * the backend refuses the refresh. `refreshPromise` is always cleared on settle.
 */
function doRefresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    const res = await originalFetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      throw new Error(`Refresh failed (${res.status})`);
    }
    const data = await res.json();
    if (!data.token || !data.refresh_token) {
      throw new Error('Malformed refresh response');
    }
    localStorage.setItem(ACCESS_KEY, data.token);
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    return data.token;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * The patched fetch.
 */
async function patchedFetch(input, init) {
  const url = getRequestUrl(input);
  const hasAuth = requestHasAuth(input, init);

  // Pass through: refresh endpoint (recursion guard) or any unauthenticated
  // request (login call, OPTIONS preflight, etc.).
  if (!hasAuth || isRefreshUrl(url)) {
    return originalFetch(input, init);
  }

  const response = await originalFetch(input, init);
  if (response.status !== 401) {
    return response;
  }

  // 401 on an authenticated request: attempt a single-flight refresh and retry
  // exactly once with the new token.
  try {
    const newToken = await doRefresh();
    const rebuilt = rebuildWithAuth(input, init, newToken);
    return originalFetch(rebuilt.input, rebuilt.init);
  } catch (err) {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    window.location.href = LOGIN_URL;
    throw err;
  }
}

/**
 * Install the interceptor. Safe to call multiple times.
 */
function installFetchInterceptor() {
  if (typeof window === 'undefined') return;
  if (window.__fetchInterceptorInstalled) return;
  if (typeof window.fetch !== 'function') return;
  originalFetch = window.fetch;
  window.fetch = patchedFetch;
  window.__fetchInterceptorInstalled = true;
}

// Auto-install on module load so a bare `import './api/authInterceptor'` is
// enough to activate it.
installFetchInterceptor();

export { installFetchInterceptor, LOGIN_URL, REFRESH_URL, LOGOUT_URL };
export default installFetchInterceptor;
