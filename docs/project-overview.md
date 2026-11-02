# KRConnects e-commerce: project overview

A microservices e-commerce application: a React shop website, an Angular admin website, four backend APIs, a background worker, an Azure SQL database
and Azure Blob Storage for product images.

Repository: https://github.com/krishnareddydotnet/krconnects-ecommerce

---

## 1. Microservices

| Service | Tech | Port | What it does |
|---|---|---|---|
| `customer-portal` | React + nginx | 8080 | The website UI; nginx forwards API calls to the backends |
| `admin-portal` | Angular + nginx | 8080 | Admin website: manage products and orders (admins only); nginx forwards API calls to the backends |
| `auth-api` | .NET 10 (ASP.NET Core Web API) | 8080 | Signup/login, issues JWT tokens with a `role` claim (`admin`/`customer`) (uses `auth-api-secret`) |
| `catalog-api` | Java 25, Spring Boot | 8081 | Product list/details; builds image URLs from Blob Storage; admin product create/update/delete |
| `data-api` | .NET 10 (ASP.NET Core Web API, EF Core) | 8080 | Database CRUD against Azure SQL (uses `data-api-secret`) |
| `order-api` | Node.js 22, Express | 8082 | Places orders (prices checked on the server) and lists a user's orders; admin order list and status changes; checks the JWT with `auth-api-secret` |
| `notification-service` | Node.js 22 (background worker) | 8083 (health only) | Reads `OrderPlaced` events from Azure Service Bus and sends order confirmations |

All services:
- run as containers in Kubernetes (Docker Desktop locally, AKS in Azure),
- are internal only (`ClusterIP`); users reach the site through the Istio ingress gateway,
- expose health endpoints for Kubernetes probes (`/health/live`, `/health/ready`; catalog-api uses Spring Boot Actuator).

---

## 2. Data and storage (Azure)

| Resource | Type | Used by | What it stores |
|---|---|---|---|
| Azure SQL Database `ecommerce` | Azure SQL (DTU **Basic** tier) | `data-api` only | Tables `Users`, `Products`, `Orders` and `OrderItems` |
| Azure Service Bus, topic `orders` | Service Bus namespace (Standard tier) | order-api (send), notification-service (receive) | `OrderPlaced` events (setup: `docs/service-bus-setup.md`) |
| Azure Blob Storage, container `products` | Storage account (Standard LRS, Hot) | Browser (via URLs from `catalog-api`) | Product images (e.g. `products/wireless-mouse.webp`) |

- Only **data-api** talks to the database. auth-api, catalog-api and order-api get data by calling data-api.
- The database stores only the **image path**; catalog-api adds the base URL from the `IMAGES_BASE_URL` setting.
  Later, with Azure Front Door, only this setting changes.
- The Azure SQL firewall must allow the cluster's **outbound public IP** (on Docker Desktop: your laptop's public IP).

---

## 3. How the services connect

```
Browser
   |
   v
Istio ingress gateway (public IP)
   |
   v
customer-portal (React + nginx)
   |-- /api/          -> auth-api:8080     --> data-api:8080 --> Azure SQL
   |-- /catalog-api/  -> catalog-api:8081  --> data-api:8080 --> Azure SQL
   |-- /order-api/    -> order-api:8082    --> data-api:8080 --> Azure SQL
   |                       '--> Service Bus topic "orders" --> notification-service
   |
   '-- product images loaded by the browser directly from Azure Blob Storage
```

The **admin portal** (separate host, e.g. `admin.<domain>`, ideally restricted by IP or private network) uses the same
three routes through its own nginx: `/api/` (login), `/catalog-api/admin/products` and `/order-api/admin/orders`.
It never calls data-api directly.

### Admin endpoints

Admin rights come from the `role` claim in the login token (auth-api setting `Admin__Usernames`).
They are checked in the **backend services**, not only hidden in the UI:

| Service | Endpoint | Purpose |
|---|---|---|
| catalog-api | `GET /admin/products/{id}` | One product with its image path (edit form) |
| catalog-api | `POST /admin/products`, `PUT /admin/products/{id}`, `DELETE /admin/products/{id}` | Manage products |
| order-api | `GET /admin/orders?page=&pageSize=` | All orders, newest first |
| order-api | `PATCH /admin/orders/{id}/status` | Change status: `Placed`, `Shipped`, `Delivered`, `Cancelled` |

No token or invalid token → `401`; valid token but not admin → `403`.

---

## 4. Secrets

| Kubernetes Secret | Key | Used by | Purpose |
|---|---|---|---|
| `auth-api-secret` | `Jwt__Key` | auth-api, order-api, catalog-api | auth-api signs login tokens (JWT); order-api and catalog-api check them |
| `data-api-secret` | `ConnectionStrings__DataDb` | data-api | Azure SQL connection string |

Azure Service Bus needs **no** Kubernetes Secret: order-api and notification-service log in with
Microsoft Entra Workload Identity (one managed identity each).

Secrets are never stored in Git. They are created directly in the cluster
(planned: Azure Key Vault with Workload Identity and the Secrets Store CSI driver).

---

## 5. Build and deployment (short)

| Area | Tool |
|---|---|
| CI/CD | GitHub Actions (one pipeline per service) |
| Container registry | Docker Hub by default, or Azure Container Registry for AKS practice: chosen by the GitHub variable `IMAGE_REGISTRY` (CI) and `helm/ecommerce/registries/*.yaml` (Helm) |
| Packaging | One shared Helm chart (`helm/ecommerce`) + one values file per service |
| GitOps | Argo CD |
| Service mesh / ingress | Istio |
| Infrastructure as Code | Terraform (`infra/terraform`) |

How to run on Docker Desktop or AKS and switch the registry: `docs/local-and-aks.md`.
