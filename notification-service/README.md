# krconnects-notification-service

Notification service for the KRConnects e-commerce lab, built with **Node.js 22** (plain JavaScript).
It is a **background worker**: it reads `OrderPlaced` messages from **Azure Service Bus** and sends the customer an
order confirmation.

For now "send" = a clear log line:

```
Order confirmation for krishna: order KRC-20261031-7QX2PA, total ₹2597.00, 3 item(s)
```

A real e-mail (e.g. Azure Communication Services) can be added later in `src/notifier.js`.

```
order-api --(OrderPlaced)--> Service Bus topic "orders"
                                  '--> subscription "notification-service" --> notification-service --> confirmation
```

A **topic** (not a queue) is used, so more services can subscribe later without changing order-api.

## Endpoints

Port **8083** is only for the Kubernetes probes; this service has no public API.

| Method | Path | What it does |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health/live` | Liveness (process is up) |
| GET | `/health/ready` | Readiness: the receiver is running and had no Service Bus error in the last 60 seconds. `503` if `SERVICEBUS_NAMESPACE` is not set. |

## The message

Sent by order-api (`order-api/src/events/orderEvents.js`):

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

Message properties: `messageId` = order number, `subject` = `OrderPlaced`, `contentType` = `application/json`.
No personal data beyond the username, no prices per item.

## How each message is handled

The receiver uses **peekLock**: a message is only *locked* while we work on it, and removed when we *complete* it.
(`receiveAndDelete` would remove it before the confirmation is sent, so a crash would lose it.)

| Situation | What we do | Why |
|---|---|---|
| Valid, confirmation sent | **complete** | Done: remove it from the subscription |
| Invalid (wrong `eventType`, no `orderNumber`, not JSON) | **dead-letter**, reason `InvalidMessage` | Retrying would fail the same way every time; a person can look at it in the dead-letter queue |
| Same `orderNumber` seen before | **complete**, no second confirmation | Service Bus delivers "at least once", so duplicates can happen |
| Temporary error (e.g. e-mail service down) | **abandon** (not completed) | Service Bus delivers it again |
| Still failing after 5 deliveries | moved to the **dead-letter queue** by Service Bus | The subscription's *max delivery count* is 5 |

**Idempotency:** the last 1000 processed order numbers are kept in memory. In production this would be a database or
cache (e.g. Redis), because memory is lost on restart and not shared between pods.

**Concurrency:** up to `MAX_CONCURRENT_CALLS` (default 5) messages are handled at the same time per pod.

**Shutdown:** on `SIGTERM` the worker stops receiving, closes the receiver and the client, then exits (at most
10 seconds; messages not completed are simply delivered again).

How to look at dead-lettered messages: see `docs/service-bus-setup.md`.

## Configuration

Environment variables only. **No connection strings or keys**: login uses Microsoft Entra ID with
`DefaultAzureCredential` (Workload Identity in AKS).

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8083` | Port for the health endpoints |
| `SERVICEBUS_NAMESPACE` | *(none)* | Fully qualified namespace: `<name>.servicebus.windows.net`. Not set = nothing is received and `/health/ready` returns `503`. |
| `SERVICEBUS_TOPIC` | `orders` | Topic to read from |
| `SERVICEBUS_SUBSCRIPTION` | `notification-service` | Subscription to read from |
| `MAX_CONCURRENT_CALLS` | `5` | Messages handled at the same time per pod |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_FEDERATED_TOKEN_FILE` | *(set by AKS)* | Injected by Workload Identity; read by `DefaultAzureCredential`. Not secrets. |

The notification-service identity needs the role **Azure Service Bus Data Receiver** on the subscription
(see `docs/service-bus-setup.md`).

## Autoscaling with KEDA

`deploy/keda-scaledobject.yaml` (not applied automatically) scales the Deployment from **1 to 5 pods** based on the
number of messages waiting in the subscription (target: about 5 per pod).

A normal Kubernetes HPA scales on CPU or memory. A worker waiting for messages uses almost no CPU even when thousands
of messages are waiting, so CPU can't tell us that we are behind. **KEDA scales on the number of waiting messages**,
which is exactly the backlog we care about.

## Run locally

Needs Node.js 22. Without Azure, the service starts and the health endpoints work (`/health/ready` = `503`):

```bash
cd notification-service
npm ci
npm start
```

With a real Service Bus, log in with the Azure CLI first (`DefaultAzureCredential` uses your `az login`; your user
needs the *Azure Service Bus Data Receiver* role):

```bash
az login
SERVICEBUS_NAMESPACE=<your-namespace>.servicebus.windows.net npm start
```

## Test

Uses Node's built-in test runner + supertest. No Service Bus needed: tests use fake messages and a fake receiver.

```bash
npm test
```

## Docker

```bash
docker build -t krconnects-notification-service .
docker run -p 8083:8083 krconnects-notification-service
```

## Port

Listens on **8083** (health only), runs as the **non-root** `node` user.
