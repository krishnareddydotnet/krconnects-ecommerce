// -----------------------------------------------------------------------
// Products: read with catalog-api's PUBLIC endpoints, change with its
// ADMIN endpoints (which check the admin token).
//   browser -> /catalog-api/... -> nginx -> catalog-api -> data-api
// The admin portal never calls data-api directly.
// -----------------------------------------------------------------------

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedProducts, Product, ProductInput } from '../models';

const BASE_URL = '/catalog-api';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  /** One page of products (public endpoint), in the same order as the shop. */
  getPage(page: number, pageSize: number, search: string): Observable<PagedProducts> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search.trim() !== '') {
      params = params.set('search', search.trim());
    }
    return this.http.get<PagedProducts>(`${BASE_URL}/products/paged`, { params });
  }

  /** One product with its image PATH (admin endpoint), for the edit form. */
  getForEdit(id: number): Observable<Product> {
    return this.http.get<Product>(`${BASE_URL}/admin/products/${id}`);
  }

  create(input: ProductInput): Observable<Product> {
    return this.http.post<Product>(`${BASE_URL}/admin/products`, input);
  }

  update(id: number, input: ProductInput): Observable<void> {
    return this.http.put<void>(`${BASE_URL}/admin/products/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE_URL}/admin/products/${id}`);
  }
}
