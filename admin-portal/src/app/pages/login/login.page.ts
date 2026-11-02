// -----------------------------------------------------------------------
// Login page ( URL: /login )
// Same demo login as the customer portal: username + user key.
// Only accounts with role "admin" get in; others see a clear message.
// -----------------------------------------------------------------------

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { friendlyError } from '../../format';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    userKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  // Signals: the page updates when these change
  readonly loading = signal(false);
  readonly error = signal('');

  // Sent here by the interceptor after a 401 (token expired)?
  readonly expired = inject(ActivatedRoute).snapshot.queryParamMap.get('reason') === 'expired';

  constructor() {
    // Already logged in as admin (e.g. opened /login by hand): go straight in
    if (this.auth.isAdmin()) {
      this.router.navigate(['/products']);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();   // show the "required" messages
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const { username, userKey } = this.form.getRawValue();

    try {
      const result = await this.auth.login(username.trim(), userKey.trim());

      if (result === 'not-admin') {
        this.error.set('This account is not an administrator.');
        return;
      }
      this.router.navigate(['/products']);
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        this.error.set('Invalid username or user key.');
      } else {
        this.error.set(friendlyError(err));
      }
    } finally {
      this.loading.set(false);
    }
  }
}
