import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fakeToken } from '../testing/fake-token';
import { AuthService, TOKEN_KEY, readUserFromToken } from './auth.service';

describe('readUserFromToken (role check)', () => {
  it('reads username and role "admin"', () => {
    expect(readUserFromToken(fakeToken({ name: 'boss', role: 'admin' }))).toEqual({ username: 'boss', role: 'admin' });
  });

  it('treats any other role as "customer"', () => {
    expect(readUserFromToken(fakeToken({ role: 'customer' }))?.role).toBe('customer');
    expect(readUserFromToken(fakeToken({ role: 'superuser' }))?.role).toBe('customer');
  });

  it('treats a token without a role as "customer" (tokens from before roles existed)', () => {
    expect(readUserFromToken(fakeToken({}))?.role).toBe('customer');
  });

  it('rejects an expired token', () => {
    expect(readUserFromToken(fakeToken({ role: 'admin', expiresInSeconds: -60 }))).toBeNull();
  });

  it('rejects a broken token', () => {
    expect(readUserFromToken('not-a-token')).toBeNull();
    expect(readUserFromToken('a.b.c')).toBeNull();
  });

  it('keeps non-English usernames correct', () => {
    expect(readUserFromToken(fakeToken({ name: 'Kṛṣṇa', role: 'admin' }))?.username).toBe('Kṛṣṇa');
  });
});

describe('AuthService', () => {
  let http: HttpTestingController;

  function createService(): AuthService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => http.verify());   // no unexpected HTTP calls

  it('login as admin: saves the token and sets the user', async () => {
    const auth = createService();
    const token = fakeToken({ name: 'boss', role: 'admin' });

    const result = auth.login('boss', 'key');
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'boss', userKey: 'key' });
    request.flush({ token, username: 'boss', expiresAt: '' });

    expect(await result).toBe('ok');
    expect(auth.isAdmin()).toBe(true);
    expect(auth.currentUser()?.username).toBe('boss');
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token);
  });

  it('login as customer: returns "not-admin" and does NOT keep the token', async () => {
    const auth = createService();

    const result = auth.login('krishna', 'key');
    http.expectOne('/api/auth/login').flush({ token: fakeToken({ role: 'customer' }), username: 'krishna', expiresAt: '' });

    expect(await result).toBe('not-admin');
    expect(auth.isAdmin()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('keeps a saved admin token after a page refresh', () => {
    localStorage.setItem(TOKEN_KEY, fakeToken({ name: 'boss', role: 'admin' }));

    const auth = createService();

    expect(auth.isAdmin()).toBe(true);
    expect(auth.getToken()).not.toBeNull();
  });

  it('forgets a saved token that has expired', () => {
    localStorage.setItem(TOKEN_KEY, fakeToken({ role: 'admin', expiresInSeconds: -60 }));

    const auth = createService();

    expect(auth.isAdmin()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('logout removes the token and the user', () => {
    localStorage.setItem(TOKEN_KEY, fakeToken({ role: 'admin' }));
    const auth = createService();

    auth.logout();

    expect(auth.currentUser()).toBeNull();
    expect(auth.getToken()).toBeNull();
  });
});
