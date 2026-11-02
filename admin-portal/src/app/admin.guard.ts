// -----------------------------------------------------------------------
// Route guard: the admin pages open only for a logged-in ADMIN.
// Anyone else is sent to the login page.
// (Convenience only: the backends check the admin role on every request.)
// -----------------------------------------------------------------------

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAdmin()) {
    return true;
  }

  // Returning a UrlTree = "go here instead"
  return router.createUrlTree(['/login']);
};
