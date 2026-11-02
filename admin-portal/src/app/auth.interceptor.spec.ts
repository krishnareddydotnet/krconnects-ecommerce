import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService, TOKEN_KEY } from './services/auth.service';
import { fakeToken } from './testing/fake-token';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;

  function setUp(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => backend.verify());

  it('adds "Authorization: Bearer <token>" to our API calls', () => {
    const token = fakeToken({ role: 'admin' });
    localStorage.setItem(TOKEN_KEY, token);
    setUp();

    http.get('/order-api/admin/orders').subscribe();

    const request = backend.expectOne('/order-api/admin/orders');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    request.flush({});
  });

  it('never sends the token to other websites', () => {
    localStorage.setItem(TOKEN_KEY, fakeToken({ role: 'admin' }));
    setUp();

    http.get('https://example.com/data').subscribe();

    const request = backend.expectOne('https://example.com/data');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('sends no header when nobody is logged in', () => {
    setUp();

    http.get('/catalog-api/products/paged').subscribe();

    const request = backend.expectOne('/catalog-api/products/paged');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('401 from an API: logs out and goes to the login page', async () => {
    localStorage.setItem(TOKEN_KEY, fakeToken({ role: 'admin' }));
    setUp();

    const call = firstValueFrom(http.get('/catalog-api/admin/products/1'));
    backend.expectOne('/catalog-api/admin/products/1').flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(call).rejects.toMatchObject({ status: 401 });
    expect(TestBed.inject(AuthService).currentUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });

  it('401 from the login call itself does NOT redirect (wrong key is shown on the form)', async () => {
    setUp();

    const call = firstValueFrom(http.post('/api/auth/login', {}));
    backend.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(call).rejects.toMatchObject({ status: 401 });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('403 is passed on to the page, without logging out', async () => {
    localStorage.setItem(TOKEN_KEY, fakeToken({ role: 'admin' }));
    setUp();

    const call = firstValueFrom(http.delete('/catalog-api/admin/products/1'));
    backend.expectOne('/catalog-api/admin/products/1').flush({}, { status: 403, statusText: 'Forbidden' });

    await expect(call).rejects.toMatchObject({ status: 403 });
    expect(TestBed.inject(AuthService).isAdmin()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
