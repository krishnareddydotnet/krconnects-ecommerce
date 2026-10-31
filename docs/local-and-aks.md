# Run on Docker Desktop or AKS (same code, different registry)

Every service runs in two places **without code changes**:

| Where | When | Images come from |
|---|---|---|
| **Docker Desktop Kubernetes** (your laptop) | Default, free | Docker Hub `docker.io/ckreddy3030/<service>` (or images you built locally) |
| **AKS** (Azure) | Only for Azure-specific practice | Azure Container Registry `krconnectspractice.azurecr.io/<service>` |

Azure SQL Database and Azure Blob Storage (product images) are the **same** in both places.
The `data-api-secret` connection string and `IMAGES_BASE_URL` in `values-catalog-api.yaml` do not change.

---

## 1. How the registry is chosen

**Helm.** `helm/ecommerce/values.yaml` has `image.registry` (default `docker.io/ckreddy3030`).
Each `values-<service>.yaml` has the image **name** only (`repository: data-api`) plus the registry, tag and digest
the CI last pushed. To pull from somewhere else, add one more `-f` file. **The last `-f` wins.**

| File | Image becomes |
|---|---|
| `helm/ecommerce/registries/dockerhub.yaml` | `docker.io/ckreddy3030/data-api:<tag>@<digest>` |
| `helm/ecommerce/registries/acr.yaml` | `krconnectspractice.azurecr.io/data-api:<tag>@<digest>` |
| `helm/ecommerce/registries/local.yaml` | `data-api:local` (built on your laptop, `pullPolicy: Never`) |

**Pipelines.** One GitHub repository **variable** (not a secret) chooses where CI pushes:

1. GitHub → repo **Settings** → **Secrets and variables** → **Actions** → **Variables** tab.
2. Create or edit `IMAGE_REGISTRY`: `dockerhub` (or empty/not set) or `acr`.
3. **Actions** → pick a service's workflow (e.g. *data api ci*) → **Run workflow** (branch `main`).
   Do this for each service you want rebuilt in the new registry.
4. Each run opens a bot PR that updates `registry`, `tag` and `digest` in `values-<service>.yaml`. Merge it.

The digest is the same content in both registries only if the same build was pushed to both. Images built by CI
in Docker Hub mode do **not** exist in ACR (and the other way round), so rebuild after switching.

---

## 2. Deploy on Docker Desktop

Enable Kubernetes in Docker Desktop (Settings → Kubernetes), then select it:

```bash
kubectl config use-context docker-desktop
```

### 2.1 Secrets (once)

Create them yourself, never commit the values:

| Secret | Key | Used by |
|---|---|---|
| `auth-api-secret` | `Jwt__Key` | auth-api, catalog-api, order-api |
| `data-api-secret` | `ConnectionStrings__DataDb` | data-api (Azure SQL connection string) |

```bash
kubectl create secret generic auth-api-secret --from-literal=Jwt__Key='<your-jwt-key>'
```

```bash
kubectl create secret generic data-api-secret --from-literal=ConnectionStrings__DataDb='<your-azure-sql-connection-string>'
```

### 2.2 Install the services (from the repo root, in this order)

```bash
helm upgrade --install data-api helm/ecommerce -f helm/ecommerce/values-data-api.yaml -f helm/ecommerce/registries/dockerhub.yaml
```

```bash
helm upgrade --install auth-api helm/ecommerce -f helm/ecommerce/values-auth-api.yaml -f helm/ecommerce/registries/dockerhub.yaml
```

```bash
helm upgrade --install catalog-api helm/ecommerce -f helm/ecommerce/values-catalog-api.yaml -f helm/ecommerce/registries/dockerhub.yaml
```

```bash
helm upgrade --install order-api helm/ecommerce -f helm/ecommerce/values-order-api.yaml -f helm/ecommerce/registries/dockerhub.yaml
```

```bash
helm upgrade --install notification-service helm/ecommerce -f helm/ecommerce/values-notification-service.yaml -f helm/ecommerce/registries/dockerhub.yaml
```

```bash
helm upgrade --install customer-portal helm/ecommerce -f helm/ecommerce/values-customer-portal.yaml -f helm/ecommerce/registries/dockerhub.yaml
```

```bash
helm upgrade --install admin-portal helm/ecommerce -f helm/ecommerce/values-admin-portal.yaml -f helm/ecommerce/registries/dockerhub.yaml
```

Check:

```bash
kubectl get pods
```

**Locally built images instead of Docker Hub:** build in the service folder, e.g. `docker build -t data-api:local .`,
and use `-f helm/ecommerce/registries/local.yaml` as the last file. This only works if your Kubernetes can see
Docker Desktop's images; if pods show `ErrImageNeverPull`, use `dockerhub.yaml`.

**Azure-only features on Docker Desktop (expected, nothing to fix):**

- No Workload Identity, so **order-api** cannot send the `OrderPlaced` event. Orders still work; the log says
  `OrderPlaced event not sent for ...`.
- **notification-service** starts, but its `/health/ready` stays `503` (it needs Service Bus), so the pod shows
  `0/1 READY`. Nothing else depends on it. You can skip installing it locally.
- No Key Vault is needed: the two secrets above are plain Kubernetes Secrets.

### 2.3 Open the websites

```bash
kubectl port-forward svc/customer-portal 8080:8080
```

Then open http://localhost:8080. In a second terminal:

```bash
kubectl port-forward svc/admin-portal 8090:8080
```

Then open http://localhost:8090.

---

## 3. Deploy on AKS

1. Set `IMAGE_REGISTRY` to `acr` and run the workflows (section 1), merge the bot PRs.
2. Give AKS pull rights on the registry once (placeholders):

   ```bash
   az aks update --resource-group <aks-resource-group> --name <aks-cluster-name> --attach-acr krconnectspractice
   ```

3. Same secrets and `helm upgrade --install` lines as in section 2, but with `-f helm/ecommerce/registries/acr.yaml`
   as the last file, e.g.:

   ```bash
   helm upgrade --install data-api helm/ecommerce -f helm/ecommerce/values-data-api.yaml -f helm/ecommerce/registries/acr.yaml
   ```

For order-api and notification-service on AKS, also set the Service Bus namespace and Workload Identity client IDs
(see `docs/service-bus-setup.md`).

---

## 4. Azure SQL firewall

Azure SQL only accepts connections from allowed public IPs:

| Running on | Allow this IP |
|---|---|
| Docker Desktop | Your laptop's **public** IP (it changes on other networks, update the rule then) |
| AKS | The cluster's **outbound** public IP |

Azure portal → SQL server → **Networking** → **Firewall rules** → add the IP. If data-api's `/health/ready`
fails, check this first.

---

## 5. One-time Azure setup for `acr` mode

CI logs in to Azure with **OIDC**: no password or client secret is stored in GitHub.

1. **Identity:** create a user-assigned managed identity `id-github-acr-push` (any resource group).
2. **Role:** give it **AcrPush** on the registry `krconnectspractice` **only** (scope = the registry, not the
   resource group or subscription).
3. **Federated credential** on that identity:
   - Issuer: `https://token.actions.githubusercontent.com`
   - Subject: `repo:krishnareddydotnet/krconnects-ecommerce:ref:refs/heads/main`
   - Audience: `api://AzureADTokenExchange`

   Only workflow runs on `main` can log in. A run on another branch fails at *azure login*.
4. **GitHub secrets** (Settings → Secrets and variables → Actions → Secrets):

   | Secret | Value |
   |---|---|
   | `AZURE_ACR_PUSH_CLIENT_ID` | Client ID of `id-github-acr-push` |
   | `AZURE_TENANT_ID` | Your tenant ID |
   | `AZURE_SUBSCRIPTION_ID` | Your subscription ID |

5. **Actions allow-list:** Settings → Actions → General → *Allow specified actions* → add `azure/login@*`.

Docker Hub mode keeps using the secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.
