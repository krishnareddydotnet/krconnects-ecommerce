// -----------------------------------------------------------------------
// Shapes of the data the backend APIs send and receive.
// (TypeScript interfaces only describe data; they don't exist at runtime.)
// -----------------------------------------------------------------------

/** The logged-in user, read from the login token. */
export interface AdminUser {
  username: string;
  role: string;   // "admin" or "customer"
}

/** A product as catalog-api returns it. */
export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  imageUrl: string | null;   // full URL on public endpoints, PATH on /admin/products/{id}
}

/** What the add/edit form sends to POST/PUT /catalog-api/admin/products. */
export interface ProductInput {
  name: string;
  category: string;
  price: number;
  imageUrl: string | null;   // relative path, e.g. "products/laptop-stand.webp"
}

export interface PagedProducts {
  items: Product[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface OrderItem {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  userId: number;
  username: string;
  status: OrderStatus;
  subtotal: number;
  delivery: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export interface PagedOrders {
  items: Order[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** Same list as order-api and data-api. */
export const ORDER_STATUSES = ['Placed', 'Shipped', 'Delivered', 'Cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
