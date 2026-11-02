# krconnects-catalog-api
Product catalog API for KRConnects, built with Spring Boot (Java/Maven). Manages product data and serves catalog information to frontend applications.

## Endpoints

| Method | Path | Login | What it does |
|---|---|---|---|
| GET | `/products/paged?page=&pageSize=&search=&category=&sort=` | no | One page of products + total count |
| GET | `/products/categories` | no | Category list |
| GET | `/products/{id}` | no | One product (full image URL) |
| GET | `/admin/products/{id}` | **admin** | One product with its stored image **path** (for the admin edit form) |
| POST | `/admin/products` | **admin** | Create a product → `201` |
| PUT | `/admin/products/{id}` | **admin** | Update a product → `204` |
| DELETE | `/admin/products/{id}` | **admin** | Delete a product → `204` |
| GET | `/actuator/health/liveness`, `/actuator/health/readiness` | no | Health probes |

## Admin endpoints and security

`/admin/**` is protected with **Spring Security (OAuth2 resource server)**. It checks the login token from auth-api
(`Authorization: Bearer <token>`) with the same rules as auth-api and order-api: HS256 signature with the shared key,
issuer, audience and expiry. Then the token's `role` claim must be `admin`.

| Request | Result |
|---|---|
| No token, or invalid / expired token | `401` |
| Valid token, but `role` is not `admin` | `403` |
| Admin token | handled (forwarded to the Data API) |

All other endpoints stay **public and unchanged**: security only runs on `/admin/**`.

Admin product input is validated before it reaches the Data API (`400` with a `message`):
`name` and `category` required, `price` more than 0 and less than 1,000,000 (max 2 decimals),
`imageUrl` optional and a relative path like `products/my-image.webp` (no full URLs, no `..`).

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `DATA_API_URL` | `http://data-api:8080` | Where the Data API is |
| `IMAGES_BASE_URL` | *(empty)* | Base URL added to product image paths |
| `Jwt__Key` | *(none)* | Key to check login tokens; **same value as auth-api** (Kubernetes Secret `auth-api-secret`). Missing = every `/admin` request gets `401`, public endpoints still work. |
| `JWT_ISSUER` | `krconnects-auth-api` | Expected token issuer |
| `JWT_AUDIENCE` | `krconnects-customer-portal` | Expected token audience |
