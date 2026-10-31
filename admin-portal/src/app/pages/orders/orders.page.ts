// -----------------------------------------------------------------------
// Orders page ( URL: /orders )
// All orders, newest first, with paging. The status can be changed with a
// dropdown (order-api checks that the user is an admin).
// -----------------------------------------------------------------------

import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { formatDate, formatPrice, friendlyError } from '../../format';
import { ORDER_STATUSES, Order, OrderStatus, PagedOrders } from '../../models';
import { OrderService } from '../../services/order.service';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-orders-page',
  templateUrl: './orders.page.html',
})
export class OrdersPage implements OnInit {
  private readonly orders = inject(OrderService);
  readonly formatPrice = formatPrice;
  readonly formatDate = formatDate;
  readonly statuses = ORDER_STATUSES;

  readonly data = signal<PagedOrders | null>(null);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly savingId = signal<number | null>(null);   // order whose status is being saved

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(this.orders.getPage(this.page(), PAGE_SIZE));
      this.data.set(result);
    } catch (err) {
      this.error.set(friendlyError(err));
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  /** Items count = number of pieces (2 mice + 1 book = 3), like the cart badge. */
  itemCount(order: Order): number {
    let count = 0;
    for (const item of order.items) {
      count += item.quantity;
    }
    return count;
  }

  /**
   * The dropdown changed. "select" is the <select> element itself, so we can
   * put the old value back if saving fails.
   */
  async changeStatus(order: Order, select: HTMLSelectElement): Promise<void> {
    const newStatus = select.value as OrderStatus;
    if (newStatus === order.status) {
      return;
    }

    this.savingId.set(order.id);
    this.error.set('');
    this.notice.set('');
    try {
      const updated = await firstValueFrom(this.orders.updateStatus(order.id, newStatus));
      this.replaceOrder(updated);
      this.notice.set(`Order ${updated.orderNumber} is now "${updated.status}".`);
    } catch (err) {
      select.value = order.status;   // show the real (unchanged) status again
      this.error.set(friendlyError(err));
    } finally {
      this.savingId.set(null);
    }
  }

  // Put the updated order into the list (a new object, so the signal notices the change)
  private replaceOrder(updated: Order): void {
    const current = this.data();
    if (!current) {
      return;
    }
    const items = current.items.map((order) => (order.id === updated.id ? updated : order));
    this.data.set({ ...current, items });
  }
}
