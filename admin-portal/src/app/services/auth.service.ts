// -----------------------------------------------------------------------
// Login and "who am I" for the admin portal.
//
// Login uses the SAME demo login as the customer portal:
//   browser -> /api/auth/login -> nginx -> auth-api
// auth-api returns a signed token (JWT). Its "role" claim says "admin" or
// "customer". Only admins may use this portal.
//
// IMPORTANT: hiding pages here is only for a nice user experience. The real
// protection is in the backend: catalog-api and order-api check the token's
// role on every admin request (401 / 403).
// -----------------------------------------------------------------------

import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminUser } from '../models';

interface LoginResponse {
  token: string;
  username: string;
  expiresAt: string;
}

/** Result of a login attempt, so the login page knows what to show. */
export type LoginResult = 'ok' | 'not-admin';

// Where the token is kept, so a page refresh keeps the admin logged in.
// NOTE: localStorage is simple but readable by JavaScript (XSS risk);
// production apps often use an HttpOnly cookie instead.
export const TOKEN_KEY = 'krconnects_admin_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // The logged-in user (null = logged out). A signal, so the header updates by itself.
  private readonly user = signal<AdminUser | null>(null);
  readonly currentUser = this.user.asReadonly();
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  constructor() {
    // After a page refresh: use the saved token if it is still valid
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      const user = readUserFromToken(saved);
      if (user && user.role === 'admin') {
        this.user.set(user);
      } else {
        localStorage.removeItem(TOKEN_KEY);   // expired, broken or not an admin
      }
    }
  }

  /**
   * Log in with username + user key. Returns 'ok' for an admin, 'not-admin' for
   * a valid customer account. Throws the HTTP error for a wrong key (401) etc.
   */
  async login(username: string, userKey: string): Promise<LoginResult> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>('/api/auth/login', { username, userKey }),
    );

    const user = readUserFromToken(response.token);

    // Not an admin: don't keep the token at all
    if (!user || user.role !== 'admin') {
      this.logout();
      return 'not-admin';
    }

    localStorage.setItem(TOKEN_KEY, response.token);
    this.user.set(user);
    return 'ok';
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.user.set(null);
  }

  /** The token to send as "Authorization: Bearer <token>", or null. */
  getToken(): string | null {
    if (!this.user()) {
      return null;
    }
    return localStorage.getItem(TOKEN_KEY);
  }
}

/**
 * Reads username, role and expiry from the token's middle part (the "payload").
 * This only READS the token; it can't check the signature (the browser doesn't
 * have the secret key). That's fine: the backends check the signature.
 * Returns null for a broken or expired token.
 */
export function readUserFromToken(token: string): AdminUser | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));

    // "exp" = expiry time in SECONDS since 1970; Date.now() is in milliseconds
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      return null;
    }
    if (typeof payload.name !== 'string') {
      return null;
    }

    // Tokens from before roles existed have no "role": treat as customer
    const role = payload.role === 'admin' ? 'admin' : 'customer';
    return { username: payload.name, role };
  } catch {
    return null;
  }
}

// JWT parts use "base64url" (- and _ instead of + and /, no = padding).
// TextDecoder turns the bytes into text, so names like "Kṛṣṇa" stay correct.
function decodeBase64Url(text: string): string {
  let base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}
