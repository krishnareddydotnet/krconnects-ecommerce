# krconnects-data-api

Data API for the KRConnects e-commerce lab, built with **.NET 10 (C#)** and **Entity Framework Core**.
It is the **only** service that talks to SQL Server. Other services (auth-api, catalog-api, order-api) call this API.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health/live` | Liveness (app running) |
| GET | `/health/ready` | Readiness (database reachable) |
| GET | `/users` | List users (no keys) |
| GET | `/users/{id}` | Get one user |
| POST | `/users` | Create user (signup) - returns `userKey` **once** |
| PUT | `/users/{id}` | Update username |
| DELETE | `/users/{id}` | Delete user |
| POST | `/users/verify` | Check username + userKey (login) |
| GET | `/products` | List all products (`?search=desk` filters by name or category) |
| GET | `/products/{id}` | Get one product |
| POST | `/products` | Create product |
| PUT | `/products/{id}` | Update product |
| DELETE | `/products/{id}` | Delete product |
| POST | `/orders` | Create order + items in one transaction (called by order-api) - `201`, or `409` if the order number exists |
| GET | `/orders/user/{userId}` | Orders of one user, newest first, with items |
| GET | `/orders/{id}` | One order with items |
| GET | `/orders?page=1&pageSize=20` | One page of **all** orders, newest first, with items and total count (admin list, via order-api) |
| PATCH | `/orders/{id}/status` | Change the status: `Placed`, `Shipped`, `Delivered` or `Cancelled` (admin, via order-api) |

## Configuration

The connection string is read from the environment variable **`ConnectionStrings__DataDb`**.
It is never stored in this repo.

Example value (Kubernetes, SQL Server StatefulSet):

```
Server=sqlserver,1433;Database=KRConnectsEcommerce;User Id=sa;Password=<password>;Encrypt=True;TrustServerCertificate=True;
```

On startup the app:
1. Creates the `KRConnectsEcommerce` database (with `Users` and `Products` tables) if it doesn't exist.
2. Creates the `Products` table if it is missing (for databases created before products were added).
3. Creates the `Orders` and `OrderItems` tables if they are missing (same reason as 2).
4. Adds any missing demo products.

## Port

Listens on **8080**, runs as a **non-root** user.
