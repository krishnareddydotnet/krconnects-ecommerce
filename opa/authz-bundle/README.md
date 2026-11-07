# OPA policy bundle example (API authorization)

**Learning example.** Shows what an OPA policy bundle is, what is inside it, and how a pipeline builds it and
publishes it to a real (private) Azure storage account. Not wired into any service yet; nothing in the cluster uses it.

Different from Gatekeeper (`k8s/docker-desktop/gatekeeper/`):

| | Gatekeeper | This bundle (standalone OPA) |
|---|---|---|
| Checks | Kubernetes objects (pods, services) at admission | API requests (user, path, method) at runtime |
| Policies arrive as | ConstraintTemplate + Constraint YAML (`kubectl apply`) | A `.tar.gz` bundle that OPA downloads |
| Rego lives in | The template YAML | Plain `.rego` files |

## 1. What a bundle is

A **bundle** is a `.tar.gz` of Rego policies, optional data (`data.json`) and a `.manifest` (revision + roots).
CI builds it, uploads it to a storage account or an OCI registry (ACR), and every OPA instance (e.g. a sidecar next to
an API) downloads it on a timer and uses it for allow/deny decisions, without a restart.

Decision = **input** (the request, JSON) + **rules** (`.rego`) + optional **data** (`data.json`) -> OPA -> allow / deny.

## 2. Folder

```
opa/authz-bundle/
├── bundle/                                   source of the bundle (what you write and commit)
│   ├── .manifest                             roots (packages this bundle owns); revision is added by opa build
│   └── krconnects/authz/                     folder path = package path = data path
│       ├── policy.rego                       the rules (Rego v1 syntax)
│       ├── policy_test.rego                  5 unit tests (not shipped in the tar.gz)
│       └── data.json                         read in Rego as data.krconnects.authz.admin_paths / public_paths
└── inputs/                                   4 sample API requests (the "input" OPA receives at runtime)
```

## 3. Rules in policy.rego

| Rule | Allows |
|---|---|
| default | Nothing: `default allow := false` (deny unless a rule allows) |
| 1 | `GET` on public paths (`/products`, `/health/live`, `/health/ready`) for anyone |
| 2 | Admin paths (`/admin/orders`, `/admin/products`) only for `user.role == "admin"` |
| 3 | `GET /orders/<id>` only when `<id>` is the caller's own user id (business rule Istio AuthorizationPolicy cannot express) |

| Sample input | `allow` |
|---|---|
| `inputs/admin-opens-admin-orders.json` | true |
| `inputs/customer-opens-admin-orders.json` | false |
| `inputs/customer-reads-own-orders.json` | true |
| `inputs/customer-reads-other-orders.json` | false |

## 4. Try it on your laptop

Option A, no install: Rego Playground (https://play.openpolicyagent.org). Paste `policy.rego`, one file from `inputs/`
as **Input**, and as **Data** the content of `data.json` wrapped in its folder path:

```json
{ "krconnects": { "authz": { "admin_paths": ["/admin/orders", "/admin/products"],
                             "public_paths": ["/products", "/health/live", "/health/ready"] } } }
```

Option B, `opa` CLI (https://www.openpolicyagent.org/docs/#running-opa), from `opa/authz-bundle/`:

```powershell
opa test bundle/ -v                                                                            # 5 tests PASS
opa eval -d bundle/ -i inputs/admin-opens-admin-orders.json "data.krconnects.authz.allow"      # true
opa eval -d bundle/ -i inputs/customer-reads-other-orders.json "data.krconnects.authz.reason"  # "denied: ..."
opa build -b bundle/ --ignore "*_test.rego" --revision v1.0.0 -o authz-bundle.tar.gz           # the bundle file
tar -tzvf authz-bundle.tar.gz                                                                  # what is inside
```

## 5. Pipeline: `.github/workflows/opa-bundle.yml`

**Manual only** (Actions -> opa bundle -> Run workflow, branch **main**); never runs on push or pull request.

| Job | Steps |
|---|---|
| test | install OPA 1.22.2 -> `opa fmt --list --fail` -> `opa test` |
| build | `opa build` (revision = commit SHA, tests ignored) -> list the tar.gz contents -> save it as artifact `authz-bundle` (download from the run page) |
| upload | only if you tick **upload_to_storage**: OIDC login -> allow the runner's IP in the storage firewall -> `az storage blob upload --auth-mode login` to `stkrconnectspolicy001/bundles/authz/bundle.tar.gz` -> show the blob -> **always** remove the runner's IP |

Why the firewall steps: the storage firewall allows only listed IPs (your laptop), and GitHub-hosted runners get a new
public IP every run. Production avoids this with a self-hosted runner inside the Azure VNet and a private endpoint.

## 6. Azure setup (done once, practice environment)

| Resource | Name / setting |
|---|---|
| Storage account | `stkrconnectspolicy001` in `rg-krconnects-practice-cin-001` (Central India, Standard LRS) |
| Security | HTTPS only, TLS 1.2, no public blob access, **shared keys disabled** (Entra ID only), firewall default **Deny** + laptop IP |
| Container | `bundles` (private) |
| Pipeline identity | user-assigned managed identity `id-github-opa-bundle-publish`, federated credential for this repo on `main` (OIDC, no secret) |
| Roles of that identity | **Storage Blob Data Contributor** on the `bundles` container (upload); **Storage Account Contributor** on the account (add/remove the runner IP; production: a custom role with only that permission) |
| GitHub secret | `AZURE_POLICY_PUBLISH_CLIENT_ID` = the identity's client ID (`AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` already exist) |

Commands used (PowerShell, from any folder):

```powershell
az storage account create --name stkrconnectspolicy001 --resource-group rg-krconnects-practice-cin-001 --location centralindia --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 --allow-blob-public-access false --allow-shared-key-access false --default-action Deny --tags environment=practice project=krconnects owner=krishna
Invoke-RestMethod https://api.ipify.org                                   # your laptop's public IP
az storage account network-rule add --resource-group rg-krconnects-practice-cin-001 --account-name stkrconnectspolicy001 --ip-address <your-ip>
az storage container-rm create --resource-group rg-krconnects-practice-cin-001 --storage-account stkrconnectspolicy001 --name bundles --public-access off
az identity create --name id-github-opa-bundle-publish --resource-group rg-krconnects-practice-cin-001 --location centralindia
az identity federated-credential create --name fc-github-krconnects-ecommerce-main --identity-name id-github-opa-bundle-publish --resource-group rg-krconnects-practice-cin-001 --issuer https://token.actions.githubusercontent.com --subject "repo:krishnareddydotnet@146734987/krconnects-ecommerce@1435447827:ref:refs/heads/main" --audiences api://AzureADTokenExchange
az identity show --name id-github-opa-bundle-publish --resource-group rg-krconnects-practice-cin-001 --query "{clientId:clientId, principalId:principalId}" --output table
az role assignment create --assignee-object-id <principalId> --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope /subscriptions/<subscriptionId>/resourceGroups/rg-krconnects-practice-cin-001/providers/Microsoft.Storage/storageAccounts/stkrconnectspolicy001/blobServices/default/containers/bundles
az role assignment create --assignee-object-id <principalId> --assignee-principal-type ServicePrincipal --role "Storage Account Contributor" --scope /subscriptions/<subscriptionId>/resourceGroups/rg-krconnects-practice-cin-001/providers/Microsoft.Storage/storageAccounts/stkrconnectspolicy001
```

If your laptop's public IP changes, add the new one (and remove the old one) with `az storage account network-rule add/remove`.

Check the uploaded bundle from your laptop (your own account needs a data role, e.g. **Storage Blob Data Reader** on the container,
because shared keys are disabled):

```powershell
az storage blob list --account-name stkrconnectspolicy001 --container-name bundles --auth-mode login --query "[].{name:name, size:properties.contentLength, lastModified:properties.lastModified}" --output table
```

Cost: a Standard LRS account with one small file costs close to nothing. Clean up: `az storage account delete --name stkrconnectspolicy001 --resource-group rg-krconnects-practice-cin-001`
and `az identity delete --name id-github-opa-bundle-publish --resource-group rg-krconnects-practice-cin-001`.

## 6.1 How OPA downloads it (next step: OPA in Docker Desktop)

Each OPA instance gets a small config file that says where the bundle is and how often to check (simplified;
see the OPA docs on bundles and service authentication for the exact Azure Blob settings). On Docker Desktop
there is no managed identity, so OPA will use a short-lived read-only SAS token from a Kubernetes Secret; on AKS, Workload Identity.

```yaml
services:
  policy-storage:
    url: https://stkrconnectspolicy001.blob.core.windows.net
bundles:
  authz:
    service: policy-storage
    resource: bundles/authz/bundle.tar.gz   # + read-only SAS token (Docker Desktop) or managed identity (AKS)
    polling:
      min_delay_seconds: 60                 # check for a new revision every 60-120 s
      max_delay_seconds: 120
```

The app (or Envoy/Istio as an external authorizer) then asks OPA for every request:
input `{"method": "GET", "path": "/admin/orders", "user": {...}}` -> OPA answers `allow: true/false`.

## 7. Interview points

- A bundle is a versioned tar.gz of Rego policies, optional JSON data and a manifest (optionally signed); OPA pulls it from blob storage or an OCI registry and hot-reloads it.
- Pipeline: PR -> `opa fmt` + `opa test` -> merge -> `opa build` (revision = commit) -> sign -> upload with OIDC -> OPA instances pick it up.
- Istio AuthorizationPolicy covers service identity and simple path/JWT rules; OPA bundles are for fine-grained business authorization.
- Gatekeeper does not use bundles: its policies are ConstraintTemplate/Constraint CRDs.
