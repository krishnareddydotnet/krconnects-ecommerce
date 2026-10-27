// -----------------------------------------------------------------------
// KRConnects Customer Portal - Auth API service
//
// This code runs in the user's BROWSER, not inside the Kubernetes cluster,
// so it calls "/api/..." on the same site. nginx (inside the cluster)
// forwards "/api/..." to the Auth API Service (see nginx.conf):
//   /api/auth/signup  ->  http://auth-api:8080/auth/signup
// -----------------------------------------------------------------------

const AUTH_API_BASE_URL = import.meta.env.VITE_AUTH_API_BASE_URL || '/api';

// Where the login token is kept in the browser, so a page refresh keeps you logged in.
// NOTE: localStorage is simple but readable by JavaScript (XSS risk).
// Production apps often use an HttpOnly cookie instead.
const TOKEN_KEY = 'krconnects_token';

export function getSavedToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Small helper: send JSON, and turn an error response into an Error with the API's message
async function postJson(path, body) {
  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({})); // body may be empty

  if (!response.ok) {
    throw new Error(data.message || `Request failed (status ${response.status})`);
  }

  return data;
}

/**
 * Sign up: the Auth API asks the Data API to save the user in the database.
 * Returns { username, userKey }. Throws "That username is already taken." if it exists.
 */
export function signup(username) {
  return postJson('/auth/signup', { username });
}

/**
 * Log in: returns { token, username, expiresAt }.
 * Throws "Invalid username or user key." if wrong.
 */
export function login(username, userKey) {
  return postJson('/auth/login', { username, userKey });
}

/**
 * Who am I? Sends the saved token. Returns { id, username }.
 * Throws if the token is missing, wrong or expired (401).
 */
export async function fetchMe(token) {
  const response = await fetch(`${AUTH_API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Session not valid (status ${response.status})`);
  }

  return response.json();
}
