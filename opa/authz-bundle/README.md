# OPA policy bundle example (API authorization)

**Learning example only.** Shows what an OPA policy bundle is, what is inside it, and how a pipeline builds and
publishes it. Not wired into any service; nothing in the cluster uses it.

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

**Manual only** (Actions -> opa bundle -> Run workflow); never runs on push or pull request.

| Job | Steps |
|---|---|
| test | install OPA 1.22.2 -> `opa fmt --list --fail` -> `opa test` |
| build | `opa build` (revision = commit SHA, tests ignored) -> list the tar.gz contents -> save it as artifact `authz-bundle` (download from the run page) |
| upload | only if you tick **upload_to_storage**: OIDC login -> `az storage blob upload --auth-mode login` to `stkrconnectspolicy/bundles/authz/bundle.tar.gz` |

The storage account is a **dummy** (`stkrconnectspolicy` does not exist): leave **upload_to_storage** unticked.
To make it real you would need: the storage account and a private container `bundles`, a managed identity with
**Storage Blob Data Contributor** on that container, a federated credential for this repo, and the repo secret
`AZURE_POLICY_PUBLISH_CLIENT_ID`.

## 6. How OPA would download it (real life, not deployed here)

Each OPA instance gets a small config file that says where the bundle is and how often to check (simplified, dummy values;
see the OPA docs on bundles and service authentication for the exact Azure Blob settings):

```yaml
services:
  policy-storage:
    url: https://stkrconnectspolicy.blob.core.windows.net
    credentials:
      azure_managed_identity: {}          # OPA logs in with the pod's managed identity (no keys)
bundles:
  authz:
    service: policy-storage
    resource: bundles/authz/bundle.tar.gz
    polling:
      min_delay_seconds: 60               # check for a new revision every 60-120 s
      max_delay_seconds: 120
```

The app (or Envoy/Istio as an external authorizer) then asks OPA for every request:
input `{"method": "GET", "path": "/admin/orders", "user": {...}}` -> OPA answers `allow: true/false`.

## 7. Interview points

- A bundle is a versioned tar.gz of Rego policies, optional JSON data and a manifest (optionally signed); OPA pulls it from blob storage or an OCI registry and hot-reloads it.
- Pipeline: PR -> `opa fmt` + `opa test` -> merge -> `opa build` (revision = commit) -> sign -> upload with OIDC -> OPA instances pick it up.
- Istio AuthorizationPolicy covers service identity and simple path/JWT rules; OPA bundles are for fine-grained business authorization.
- Gatekeeper does not use bundles: its policies are ConstraintTemplate/Constraint CRDs.
