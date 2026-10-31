# KRConnects e-commerce: project overview

A microservices e-commerce application: a React website, three backend APIs, an Azure SQL database
and Azure Blob Storage for product images.

Repository: https://github.com/krishnareddydotnet/krconnects-ecommerce

---

## 1. Microservices

| Service | Tech | Port | What it does |
|---|---|---|---|
| `customer-portal` | React + nginx | 8080 | The website UI; nginx forwards API calls to the backends |
| `auth-api` | .NET 10 (ASP.NET Core Web API) | 8080 | Signup/login, issues JWT tokens (uses `auth-api-secret`) |
| `catalog-api` | Java 25, Spring Boot | 8081 | Product list/details; builds image URLs from Blob Storage |
| `data-api` | .NET 10 (ASP.NET Core Web API, EF Core) | 8080 | Database CRUD against Azure SQL (uses `data-api-secret`) |

All services:
- run as containers in Kubernetes (Docker Desktop locally, AKS in Azure),
- are internal only (`ClusterIP`); users reach the site through the Istio ingress gateway,
- expose health endpoints for Kubernetes probes (`/health/live`, `/health/ready`; catalog-api uses Spring Boot Actuator).

---

## 2. Data and storage (Azure)

| Resource | Type | Used by | What it stores |
|---|---|---|---|
| Azure SQL Database `ecommerce` | Azure SQL (DTU **Basic** tier) | `data-api` only | Tables `Users` and `Products` |
| Azure Blob Storage, container `products` | Storage account (Standard LRS, Hot) | Browser (via URLs from `catalog-api`) | Product images (e.g. `products/wireless-mouse.webp`) |

- Only **data-api** talks to the database. auth-api and catalog-api get data by calling data-api.
- The database stores only the **image path**; catalog-api adds the base URL from the `IMAGES_BASE_URL` setting.
  Later, with Azure Front Door, only this setting changes.
- The Azure SQL firewall must allow the cluster's **outbound public IP**.

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
   |
   '-- product images loaded by the browser directly from Azure Blob Storage
```

---

## 4. Secrets

| Kubernetes Secret | Key | Used by | Purpose |
|---|---|---|---|
| `auth-api-secret` | `Jwt__Key` | auth-api | Signs login tokens (JWT) |
| `data-api-secret` | `ConnectionStrings__DataDb` | data-api | Azure SQL connection string |

Secrets are never stored in Git. They are created directly in the cluster
(planned: Azure Key Vault with Workload Identity and the Secrets Store CSI driver).

---

## 5. Build and deployment (short)

| Area | Tool |
|---|---|
| CI/CD | GitHub Actions (one pipeline per service) |
| Container registry | Docker Hub (Azure Container Registry for AKS practice) |
| Packaging | One shared Helm chart (`helm/ecommerce`) + one values file per service |
| GitOps | Argo CD |
| Service mesh / ingress | Istio |
| Infrastructure as Code | Terraform (`infra/terraform`) |
