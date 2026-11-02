import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { adminGuard } from './admin.guard';
import { TOKEN_KEY } from './services/auth.service';
import { fakeToken } from './testing/fake-token';

describe('adminGuard', () => {
  // Runs the guard the way the router would
  function runGuard(): boolean | UrlTree {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    return TestBed.runInInjectionContext(
      () => adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as boolean | UrlTree,
    );
  }

  beforeEach(() => localStorage.clear());

  it('lets a logged-in admin in', () => {
    localStorage.setItem(TOKEN_KEY, fakeToken({ role: 'admin' }));

    expect(runGuard()).toBe(true);
  });

  it('sends a logged-out visitor to /login', () => {
    const result = runGuard();

    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('sends a customer (not admin) to /login', () => {
    localStorage.setItem(TOKEN_KEY, fakeToken({ role: 'customer' }));

    const result = runGuard();

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });
});
