# krconnects-auth-api
Authentication and identity API for KRConnects, built with ASP.NET Core (C#). Handles user authentication, authorization, and token issuance for downstream services.

## Roles (admin or customer)

Every login token has a `role` claim: `admin` or `customer`. `GET /auth/me` returns it too (`{ id, username, role }`).

| Setting | Env var (Kubernetes) | Default | Meaning |
|---|---|---|---|
| `Admin:Usernames` | `Admin__Usernames` | *(empty = no admins)* | Comma-separated usernames that get `role = admin`, e.g. `admin,krishna` (case doesn't matter) |

Admin-only endpoints are checked by the **backend services** that own them (catalog-api `/admin/products`,
order-api `/admin/orders`), never only hidden in the UI. After changing the list, users must log in again to get a
token with the new role.
