// -----------------------------------------------------------------------
// HTTP interceptor: runs for EVERY request made with HttpClient.
//   1. Adds "Authorization: Bearer <token>" to calls to our own APIs.
//   2. If an API answers 401 (token missing/expired/invalid), logs out and
//      goes back to the login page.
// 403 is NOT handled here: the page shows a "not allowed" message instead.
// -----------------------------------------------------------------------

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './services/auth.service';

// Only send the token to our own backends (behind nginx), never to other websites
const OUR_APIS = ['/api/', '/catalog-api/', '/order-api/'];

function isOurApi(url: string): boolean {
  return OUR_APIS.some((prefix) => url.startsWith(prefix));
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.getToken();
  let outgoing = request;
  if (token && isOurApi(request.url)) {
    // Requests can't be changed, so we send a copy with the extra header
    outgoing = request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      // A wrong key on the login form is also a 401: the login page shows that itself
      const isLoginCall = request.url.startsWith('/api/auth/login');

      if (error instanceof HttpErrorResponse && error.status === 401 && !isLoginCall) {
        auth.logout();
        router.navigate(['/login'], { queryParams: { reason: 'expired' } });
      }
      return throwError(() => error);   // the page can still show its own message
    }),
  );
};
