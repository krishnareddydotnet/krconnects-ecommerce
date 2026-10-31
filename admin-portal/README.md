# krconnects-admin-portal

Admin website for KRConnects, built with **Angular** (standalone components, TypeScript strict, signals) and served by
**nginx**. Administrators use it to manage **products** and **orders**. Customers use the separate customer portal.

## Pages

| URL | Page | What it does |
|---|---|---|
| `/login` | Login | Same demo login as the customer portal (username + user key). Only **admin** accounts get in; others see *"This account is not an administrator"*. |
| `/products` | Products | Table with search and paging. **Add** / **Edit** (form with validation) and **Delete** (with a confirm step). |
| `/orders` | Orders | All orders, newest first, with paging: order number, customer, date, items, total (₹), status. Change the status with a dropdown (`Placed`, `Shipped`, `Delivered`, `Cancelled`). |

The header shows the logged-in admin's username and a **Log out** button.

## How admin rights work

1. **auth-api** puts a `role` claim in the login token: `admin` if the username is in the setting
   `Admin__Usernames` (comma-separated), otherwise `customer`.
2. The admin portal reads the role from the token to decide what to show:
   - a route guard (`admin.guard.ts`) opens the admin pages only for a logged-in admin;
   - an HTTP interceptor (`auth.interceptor.ts`) adds `Authorization: Bearer <token>` to calls to our APIs.
     A `401` from any API (expired or invalid token) logs out and returns to the login page. A `403` shows a
     *"not allowed"* message.
3. **The real protection is in the backends**, never only in the UI. Every admin request is checked again:

| Backend | Admin endpoints | No/invalid token | Not admin |
|---|---|---|---|
| catalog-api | `POST/PUT/DELETE /admin/products`, `GET /admin/products/{id}` | `401` | `403` |
| order-api | `GET /admin/orders`, `PATCH /admin/orders/{id}/status` | `401` | `403` |

The admin portal **never** calls data-api directly. Products are read with catalog-api's public endpoints.

```
Browser (admin portal)
   |-- /api/          -> auth-api:8080      (login)
   |-- /catalog-api/  -> catalog-api:8081   (products; /admin/** needs role admin)  --> data-api
   '-- /order-api/    -> order-api:8082     (/admin/orders needs role admin)        --> data-api
```

## Code layout

| File | What it is |
|---|---|
| `src/app/services/auth.service.ts` | Login, reading the role from the token, logout |
| `src/app/services/product.service.ts` | catalog-api calls |
| `src/app/services/order.service.ts` | order-api calls |
| `src/app/auth.interceptor.ts` | Adds the token; `401` → back to login |
| `src/app/admin.guard.ts` | Admin pages only for admins |
| `src/app/pages/…` | Login, Products and Orders pages |
| `nginx.conf` | Serves the app, SPA fallback, health endpoints, forwards the 3 APIs |

## Run locally

Needs Node.js 22 and the backends running locally (auth-api on 8080, catalog-api on 8081, order-api on 8082).
`proxy.conf.json` forwards `/api`, `/catalog-api` and `/order-api` the same way nginx does in the cluster.
Start auth-api with `Admin__Usernames=<your username>` so your account gets the admin role.

```bash
cd admin-portal
npm ci
npm start          # http://localhost:4200
```

## Test

Unit tests run headless with Angular's default test runner (Vitest + jsdom), no browser needed:

```bash
npm test
```

Covered: the route guard, the interceptor, the auth service (role check), the login page, the orders page and the
image-path validator.

## Docker

```bash
docker build -t krconnects-admin-portal .
docker run -p 8080:8080 krconnects-admin-portal
```

Runs as the **non-root** nginx user (101) on port **8080**. Health: `/health/live` and `/health/ready`.

## Exposing the admin site

The admin portal is a separate Deployment and Service (`admin-portal`, ClusterIP 8080). Like the customer portal it
is reached through the **Istio ingress gateway**, which needs a VirtualService route for it (not part of this repo
change). Two options:

| Option | Example | Notes |
|---|---|---|
| **Separate host (recommended)** | `admin.<your-domain>` → `admin-portal:8080` | Clean separation: its own TLS certificate and its own access rules, and the app works at `/` without path changes |
| Path on the shop's host | `<your-domain>/admin/` → `admin-portal:8080` | Needs Angular `--base-href /admin/` and path rewriting; mixes customer and admin traffic |

**In production, restrict who can reach the admin site**, for example: allow only office/VPN IP ranges (Istio
`AuthorizationPolicy` on the gateway with `ipBlocks`), or keep it on a private network / internal load balancer only.
The backend role checks stay in place either way; network restriction is an extra layer.
