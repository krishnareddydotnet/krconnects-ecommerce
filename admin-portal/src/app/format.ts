// -----------------------------------------------------------------------
// Small display helpers, shared by the pages.
// -----------------------------------------------------------------------

import { HttpErrorResponse } from '@angular/common/http';

/** ₹1,599.00 — same format as the customer portal (Indian digit grouping). */
export function formatPrice(value: number): string {
  const number = Number(value) || 0;
  return '₹' + number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 31 Oct 2026, 10:00 — in the admin's own time zone. */
export function formatDate(isoText: string): string {
  return new Date(isoText).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Turns an API error into a friendly sentence for the page.
 * (401 never gets here as a message: the interceptor sends the user to the login page.)
 */
export function friendlyError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Something went wrong. Please try again.';
  }
  if (error.status === 403) {
    return 'You are not allowed to do this. Only administrators can.';
  }
  if (error.status === 400 || error.status === 404) {
    // The APIs send { message } for these, e.g. "price must be more than 0"
    const message = error.error?.message;
    return typeof message === 'string' ? message : 'The request was not accepted.';
  }
  if (error.status === 0 || error.status >= 500) {
    return 'The service is not available right now. Please try again in a moment.';
  }
  return 'Something went wrong. Please try again.';
}
