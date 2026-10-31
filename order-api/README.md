# krconnects-order-api

Order API for the KRConnects e-commerce lab, built with **Node.js 22 + Express** (plain JavaScript).
It places orders for logged-in users and lists their orders.

- **No database of its own:** orders are saved through the **Data API** (the only service that talks to SQL).
- **Never trusts prices from the browser:** the browser sends only `productId` + `quantity`;
  the name and current price of each product come from the Data API (`GET /products/{id}`).
- **Login:** checks the JWT created by **auth-api** (same key, issuer, audience and expiry rules).

## Endpoints

| Method | Path | Login | What it does |
|---|---|---|---|
| GET | `/` | no | Service info |
| GET | `/health/live` | no | Liveness (app running) |
| GET | `/health/ready` | no | Readiness (Data API reachable) |
| POST | `/orders` | yes | Place an order. Body: `{ "items": [ { "productId": 1, "quantity": 2 } ] }` → `201` + saved order |
| GET | `/orders/my` | yes | My orders, newest first |
| GET | `/orders/{id}` | yes | One of my orders (`404` if it doesn't exist **or belongs to someone else**) |

Login = header `Authorization: Bearer <token>` (the token from auth-api's `/auth/login`).
Missing or invalid token → `401`.

### Order rules

| Rule | Value |
|---|---|
| Lines per order | 1 to 20 (each product once) |
| Quantity per line | whole number 1 to 10 |
| Unknown product | `400` |
| Delivery | free above ₹999, otherwise ₹49 (same rule as the customer portal cart) |
| Order number | `KRC-<YYYYMMDD>-<6 random letters/digits>`, e.g. `KRC-20261031-7QX2PA` |
| Status | `Placed` |

Bad input returns `400` with a `message` that explains the problem.

After an order is saved, `publishOrderPlaced(order)` (in `src/events/orderEvents.js`) logs `OrderPlaced <orderNumber>`.
Sending this event to Azure Service Bus comes in the notification-service step.

## Configuration

Environment variables only (nothing secret is stored in this repo):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8082` | Port to listen on |
| `DATA_API_URL` | `http://data-api:8080` | Where the Data API is (Kubernetes Service name) |
| `Jwt__Key` | *(none)* | Secret used to check login tokens. **Must be the same value auth-api uses.** In Kubernetes it comes from the `auth-api-secret` Secret. If it is missing, the app keeps running but every order request gets `401`. |
| `JWT_ISSUER` | `krconnects-auth-api` | Expected token issuer |
| `JWT_AUDIENCE` | `krconnects-customer-portal` | Expected token audience |

## Run locally

Needs Node.js 22 and a running Data API (and auth-api to get a token).

```bash
cd order-api
npm ci
export DATA_API_URL=http://localhost:5000      # wherever your data-api runs
export Jwt__Key=<the same key you gave auth-api>
npm start
```

Then, with a token from auth-api:

```bash
curl -X POST http://localhost:8082/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":2}]}'
```

## Test

Uses Node's built-in test runner + supertest. The Data API is mocked, so no other service is needed.

```bash
npm test
```

## Docker

```bash
docker build -t krconnects-order-api .
docker run -p 8082:8082 -e DATA_API_URL=http://host.docker.internal:5000 -e Jwt__Key=<key> krconnects-order-api
```

## Port

Listens on **8082**, runs as the **non-root** `node` user.
