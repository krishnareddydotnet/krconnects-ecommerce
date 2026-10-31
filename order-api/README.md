# krconnects-order-api

Order API for the KRConnects e-commerce lab, built with **Node.js 22 + Express** (plain JavaScript).
It places orders for logged-in users and lists their orders.

- **No database of its own:** orders are saved through the **Data API** (the only service that talks to SQL).
- **Publishes an `OrderPlaced` event** to Azure Service Bus, so other services (notification-service) can react.
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

### Admin endpoints (role `admin` only)

| Method | Path | What it does |
|---|---|---|
| GET | `/admin/orders?page=1&pageSize=20` | All orders, newest first, with total count (`pageSize` 1–100) |
| PATCH | `/admin/orders/{id}/status` | Change the status. Body: `{ "status": "Shipped" }`, one of `Placed`, `Shipped`, `Delivered`, `Cancelled` |

The login token's `role` claim (set by auth-api from `Admin__Usernames`) must be `admin`:
no token or invalid token → `401`, logged in but not admin → `403`. A token without a `role` claim counts as `customer`.
The check is done here in the backend (`requireAdmin` in `src/middleware/auth.js`), not only in the admin portal.

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

### OrderPlaced event (Azure Service Bus)

After an order is saved, `publishOrderPlaced(order)` (in `src/events/orderEvents.js`) sends a message to the
Service Bus **topic** `orders`. **notification-service** reads it from its subscription and sends the order confirmation.

```json
{
  "eventType": "OrderPlaced",
  "orderId": 42,
  "orderNumber": "KRC-20261031-7QX2PA",
  "userId": 1,
  "username": "krishna",
  "total": 2597,
  "itemCount": 3,
  "createdAt": "2026-10-31T10:00:00Z"
}
```

| Message property | Value | Why |
|---|---|---|
| `messageId` | the order number | Service Bus duplicate detection drops a second copy of the same order |
| `subject` | `OrderPlaced` | Lets subscribers filter by event type |
| `contentType` | `application/json` | Tells receivers how to read the body |

- **Login:** Microsoft Entra ID with `DefaultAzureCredential` (Workload Identity in AKS). **No connection strings or keys.**
  The order-api identity needs the role **Azure Service Bus Data Sender** on the topic (see `docs/service-bus-setup.md`).
- **Never fails the order:** the order is already saved. If sending fails, the log says
  `OrderPlaced event not sent for <orderNumber>: <reason>` and the customer still gets `201`.
  (Production systems use the *transactional outbox* pattern to guarantee delivery; we accept this simpler approach for now.)
- **Not set up?** Without `SERVICEBUS_NAMESPACE` the event is only logged (`OrderPlaced <orderNumber>`), so local runs and tests work.
- On shutdown (`SIGTERM`) the Service Bus connection is closed cleanly.

## Configuration

Environment variables only (nothing secret is stored in this repo):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8082` | Port to listen on |
| `DATA_API_URL` | `http://data-api:8080` | Where the Data API is (Kubernetes Service name) |
| `Jwt__Key` | *(none)* | Secret used to check login tokens. **Must be the same value auth-api uses.** In Kubernetes it comes from the `auth-api-secret` Secret. If it is missing, the app keeps running but every order request gets `401`. |
| `JWT_ISSUER` | `krconnects-auth-api` | Expected token issuer |
| `JWT_AUDIENCE` | `krconnects-customer-portal` | Expected token audience |
| `SERVICEBUS_NAMESPACE` | *(none)* | Service Bus namespace, fully qualified: `<name>.servicebus.windows.net`. Not set = events are only logged. |
| `SERVICEBUS_TOPIC` | `orders` | Topic the OrderPlaced event is sent to |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_FEDERATED_TOKEN_FILE` | *(set by AKS)* | Injected by Workload Identity; read by `DefaultAzureCredential`. Not secrets, and you don't set them yourself in AKS. |

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
