// -----------------------------------------------------------------------
// Pages of the admin portal:
//   /login     -> LoginPage   (open to everyone)
//   /products  -> ProductsPage (admins only: adminGuard)
//   /orders    -> OrdersPage   (admins only: adminGuard)
//   anything else -> /products (the guard sends non-admins to /login)
// -----------------------------------------------------------------------

import { Routes } from '@angular/router';
import { adminGuard } from './admin.guard';
import { LoginPage } from './pages/login/login.page';
import { OrdersPage } from './pages/orders/orders.page';
import { ProductsPage } from './pages/products/products.page';

export const routes: Routes = [
  { path: 'login', component: LoginPage, title: 'Login · KRConnects Admin' },
  { path: 'products', component: ProductsPage, canActivate: [adminGuard], title: 'Products · KRConnects Admin' },
  { path: 'orders', component: OrdersPage, canActivate: [adminGuard], title: 'Orders · KRConnects Admin' },
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  { path: '**', redirectTo: 'products' },
];
