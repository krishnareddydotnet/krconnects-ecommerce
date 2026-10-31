// -----------------------------------------------------------------------
// The app shell: header (title, menu, logged-in admin, Logout) + the page.
// -----------------------------------------------------------------------

import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
