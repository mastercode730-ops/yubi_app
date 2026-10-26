// HTTP client for the Yubi7 backend. Talks to the same deployed API as the
// web portal (frontend/js/api.js → https://marketai.solutions/sapi), with the
// same JWT Bearer auth, so every request behaves exactly as it does on web.
import * as SecureStore from 'expo-secure-store';

export const API_BASE = 'https://marketai.solutions/sapi';
const TOKEN_KEY = 'yubi7_token';
const TIMEOUT_MS = 90000;

let token = null;
let unauthorizedHandler = null;

export async function loadToken() {
  try { token = await SecureStore.getItemAsync(TOKEN_KEY); } catch { token = null; }
  return token;
}

export async function setToken(t) {
  token = t || null;
  try {
    if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {}
}

export const hasToken = () => !!token;

// AuthProvider registers this; it signs the user out on any 401.
export function onUnauthorized(fn) { unauthorizedHandler = fn; }

const qs = (params) => {
  if (!params) return '';
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

async function request(method, path, { params, body, auth = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}${qs(params)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }

    if (res.status === 401 && auth) {
      const msg = data?.code === 'SESSION_EXPIRED_OTHER_DEVICE'
        ? 'You were logged out because this account signed in on another device.'
        : 'Your session has expired. Please log in again.';
      if (unauthorizedHandler) unauthorizedHandler(msg);
      return { success: false, message: msg, unauthorized: true };
    }
    if (data === null) {
      return { success: false, status: res.status, message: res.ok ? 'Unexpected server response' : `Server error (${res.status})` };
    }
    if (typeof data === 'object' && !Array.isArray(data)) data.status = res.status;
    return data;
  } catch (e) {
    const aborted = e?.name === 'AbortError';
    return { success: false, network: true, message: aborted ? 'Request timed out. Please try again.' : 'Network error. Check your internet connection.' };
  } finally {
    clearTimeout(timer);
  }
}

const api = {
  get: (path, params, opts) => request('GET', path, { ...opts, params }),
  post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body: body ?? {} }),
  // The backend reads DELETE bodies (e.g. /api/lc/delete needs { date }).
  del: (path, body, opts) => request('DELETE', path, { ...opts, body }),
};

export default api;
