import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TOKEN_KEY } from '../../services/auth.service';
import { fakeToken } from '../../testing/fake-token';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
  });

  // Fill in the form and press "Log in"
  async function logIn(username: string, userKey: string): Promise<void> {
    const page = fixture.nativeElement as HTMLElement;
    const usernameInput = page.querySelector<HTMLInputElement>('#username')!;
    const keyInput = page.querySelector<HTMLInputElement>('#userKey')!;
    usernameInput.value = username;
    usernameInput.dispatchEvent(new Event('input'));
    keyInput.value = userKey;
    keyInput.dispatchEvent(new Event('input'));
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('admin: logs in and opens the products page', async () => {
    await logIn('boss', 'key');
    backend.expectOne('/api/auth/login').flush({ token: fakeToken({ role: 'admin' }), username: 'boss', expiresAt: '' });
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(['/products']);
    expect(localStorage.getItem(TOKEN_KEY)).not.toBeNull();
  });

  it('customer: shows "This account is not an administrator" and stays on the login page', async () => {
    await logIn('krishna', 'key');
    backend.expectOne('/api/auth/login').flush({ token: fakeToken({ role: 'customer' }), username: 'krishna', expiresAt: '' });
    await fixture.whenStable();

    expect(text()).toContain('This account is not an administrator.');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('wrong key: shows "Invalid username or user key."', async () => {
    await logIn('boss', 'wrong');
    backend
      .expectOne('/api/auth/login')
      .flush({ message: 'Invalid username or user key.' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(text()).toContain('Invalid username or user key.');
  });

  it('empty form: shows what is missing and sends nothing', async () => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();

    expect(text()).toContain('Username is required.');
    expect(text()).toContain('User key is required.');
    backend.expectNone('/api/auth/login');
  });
});
