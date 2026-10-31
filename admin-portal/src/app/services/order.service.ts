// -----------------------------------------------------------------------
// Orders: order-api's ADMIN endpoints (they check the admin token).
//   browser -> /order-api/admin/... -> nginx -> order-api -> data-api
// -----------------------------------------------------------------------

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Order, OrderStatus, PagedOrders } from '../models';

const BASE_URL = '/order-api/admin/orders';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  /** All orders, newest first, one page at a time. */
  getPage(page: number, pageSize: number): Observable<PagedOrders> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedOrders>(BASE_URL, { params });
  }

  /** Change an order's status; returns the updated order. */
  updateStatus(orderId: number, status: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(`${BASE_URL}/${orderId}/status`, { status });
  }
}
