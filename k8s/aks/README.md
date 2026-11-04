# AKS cluster configuration

Plain Kubernetes YAML for the AKS cluster (no Helm), so every object and field is visible and easy to explain.
Kept separate from `k8s/docker-desktop/` (local laptop): nothing is shared or reused between the two folders.

## Folder structure

```
k8s/aks/
├── apps/          one file per microservice (all its objects in one place)        [present]
│   ├── data-api.yaml
│   ├── auth-api.yaml
│   ├── catalog-api.yaml
│   ├── order-api.yaml
│   ├── customer-portal.yaml
│   └── admin-portal.yaml
├── key-vault/     SecretProviderClass objects (Key Vault CSI driver + Workload Identity)  [present]
│   ├── data-api-kv.yaml   Key Vault "data-db-connection" -> Secret data-api-secret / ConnectionStrings__DataDb
│   └── jwt-key-kv.yaml    Key Vault "jwt-key"            -> Secret auth-api-secret / Jwt__Key
├── istio/         managed Istio (asm-1-30): gateway, VirtualService, mTLS, AuthorizationPolicies   [later]
└── argocd/        Argo CD Applications (if deployed with GitOps)                                    [later]
```

## Rules for `apps/<service>.yaml`

- One file per service, containing all of that service's objects, separated by `---`
  (ServiceAccount, Deployment, Service, HorizontalPodAutoscaler, PodDisruptionBudget, NetworkPolicy).
- Short comments on every important line, so the file can be read top to bottom.
- The `image:` line is updated by CI (tag + digest). Never edit it by hand.
  Until a pipeline has run it is `krconnectspractice.azurecr.io/<service>:placeholder`, which cannot be pulled.
- notification-service is not on AKS yet (so order-api has no `SERVICEBUS_NAMESPACE`: the OrderPlaced event is only logged).

## Pipelines (GitHub Actions)

- **Currently archived** in `.github/workflows-archive-aks/` (the Docker Desktop pipelines are active; only one set may be active,
  because both watch the same service folders). To switch, see `.github/workflows-archive-aks/README.md`.
- One AKS pipeline per microservice (`aks-<service>-ci.yml`): build, test, push the image to ACR (`krconnectspractice.azurecr.io`),
  then update the image (tag + digest) in `k8s/aks/apps/<service>.yaml` through a bot PR.
- A pipeline runs only when its own service folder changes (path filter).
- The Docker Hub service pipelines (`.github/workflows/<service>-ci.yml`) are active for now (Docker Desktop hands-on).
- `secret-scan.yml` (required gitleaks check), `codeql.yml`, `terraform-ci.yml`, `snyk-security.yml`
  and `checkouttest.yml` stay in `.github/workflows/`.
- Before the first deployment, run each AKS pipeline once so every file has a real image.

## Platform

- Secrets come from Azure Key Vault (`kv-krconnects-practice`) through the CSI driver and Workload Identity;
  no secret values in Git and no manually created Kubernetes Secrets.
- Azure SQL (data) and Azure Blob Storage (product images) are shared backing services and do not change.

## Security baseline (every workload)

| Setting | Why |
|---|---|
| `runAsNonRoot: true` + `runAsUser: <uid>` | The container never runs as root (UID 0) |
| `allowPrivilegeEscalation: false` | A process cannot gain more privileges than it started with |
| `readOnlyRootFilesystem: true` + writable `/tmp` (emptyDir) only | Nobody can change files inside the container |
| `capabilities: drop: ["ALL"]` | Removes all extra Linux privileges |
| `seccompProfile: RuntimeDefault` | Limits risky Linux system calls |
| `automountServiceAccountToken: false` | No Kubernetes API token inside the pod unless it needs one |
| Image by digest (`@sha256:...`) | Runs exactly the image that was scanned and signed; a tag can be moved |
| Secrets from Key Vault (Workload Identity + CSI) | No secret values in Git or in YAML |
| Resource requests and limits | One pod cannot starve the others; needed for scheduling and HPA |

These settings meet the Kubernetes Pod Security Admission `restricted` level.
Network rules: a NetworkPolicy per service lives in its `apps/<service>.yaml`; Istio mTLS and AuthorizationPolicies will live in `istio/`.

## Who may call whom (NetworkPolicy, incoming traffic only)

| Service | Allowed to connect (on its app port) |
|---|---|
| customer-portal (8080) | pods in namespace `aks-istio-ingress` (managed Istio ingress gateway) |
| admin-portal (8080) | pods in namespace `aks-istio-ingress` |
| auth-api (8080), catalog-api (8081), order-api (8082) | customer-portal, admin-portal |
| data-api (8080) | auth-api, catalog-api, order-api |

Outgoing traffic (egress) is not restricted yet. That is a later step: it must still allow DNS, Azure SQL (1433) and istiod.

## Writable folders (readOnlyRootFilesystem)

Checked with `docker run --read-only` (non-root UID, all capabilities dropped):

| Service | Writable mount | Why |
|---|---|---|
| catalog-api | `/tmp` | Tomcat fails to start without it ("Unable to create tempDir") |
| customer-portal, admin-portal | `/tmp` | nginx-unprivileged writes its pid file and proxy temp files there |
| data-api, auth-api | `/tmp` | .NET starts without it, but `/tmp` is its normal temp folder |
| order-api | none | Node.js does not write files |

Pods that use Key Vault also mount the CSI volume read-only at `/mnt/secrets-store`.

## Deploy manually (kubectl)

Prerequisites (once): the Azure steps below, `kubectl config use-context <your-aks-context>`, and each AKS pipeline run
once and its bot PR merged, so no file still says `:placeholder`.

Apply in this order (from the repo root). Key Vault first, because the pods mount the SecretProviderClass;
data-api before the services that call it.

```bash
kubectl apply -f k8s/aks/key-vault/
```

```bash
kubectl apply -f k8s/aks/apps/data-api.yaml
```

```bash
kubectl apply -f k8s/aks/apps/auth-api.yaml
```

```bash
kubectl apply -f k8s/aks/apps/catalog-api.yaml
```

```bash
kubectl apply -f k8s/aks/apps/order-api.yaml
```

```bash
kubectl apply -f k8s/aks/apps/customer-portal.yaml
```

```bash
kubectl apply -f k8s/aks/apps/admin-portal.yaml
```

### Check

All objects of all services:

```bash
kubectl get sa,deploy,svc,hpa,pdb,networkpolicy
```

The Key Vault objects and the Secrets the CSI driver created (they appear once a pod mounts the volume):

```bash
kubectl get secretproviderclass
```

```bash
kubectl get secret data-api-secret auth-api-secret
```

One service in detail (events show image pull, probe and mount errors):

```bash
kubectl describe deploy data-api
```

```bash
kubectl get pods -l app.kubernetes.io/name=data-api
```

```bash
kubectl logs deploy/data-api
```

## One-time manual Azure steps

Placeholders only; no secret values belong in this repo.

### For the pipelines (push to ACR with OIDC)

1. Create a user-assigned managed identity `id-github-acr-push`.
2. Give it the role **AcrPush** on the registry `krconnectspractice` only (scope = the registry).
3. Add a federated credential to it:
   - Issuer: `https://token.actions.githubusercontent.com`
   - Subject: `repo:krishnareddydotnet/krconnects-ecommerce:ref:refs/heads/main`
   - Audience: `api://AzureADTokenExchange`
   (only runs on `main` can log in; a run from another branch fails at *azure login*)
4. GitHub repo secrets: `AZURE_ACR_PUSH_CLIENT_ID` = client ID of `id-github-acr-push`, plus `AZURE_TENANT_ID` and
   `AZURE_SUBSCRIPTION_ID`.
5. `azure/login@*` is already in the Actions allow-list (Settings → Actions → General).
6. AKS must be allowed to pull from the registry (AcrPull for the kubelet identity):

   ```bash
   az aks update --resource-group <aks-resource-group> --name <aks-cluster-name> --attach-acr krconnectspractice
   ```

### For the apps (Key Vault through Workload Identity)

The cluster needs the OIDC issuer, Workload Identity and the Key Vault secrets provider add-on enabled.
The managed identity used by the apps (client ID `b49007d2-b04a-453e-938a-4980fc2e66c4`) needs read access to the
secrets in `kv-krconnects-practice` (for example the role **Key Vault Secrets User**), and **one federated credential
per ServiceAccount** that reads Key Vault:

| ServiceAccount | Subject |
|---|---|
| data-api | `system:serviceaccount:default:data-api` |
| auth-api | `system:serviceaccount:default:auth-api` |
| catalog-api | `system:serviceaccount:default:catalog-api` |
| order-api | `system:serviceaccount:default:order-api` |

Issuer = the cluster's OIDC issuer URL, audience = `api://AzureADTokenExchange`. Example (placeholders):

```bash
az identity federated-credential create --name fc-data-api --identity-name <app-identity-name> --resource-group <identity-resource-group> --issuer <aks-oidc-issuer-url> --subject system:serviceaccount:default:data-api --audience api://AzureADTokenExchange
```

Repeat with `fc-auth-api`, `fc-catalog-api` and `fc-order-api` (and their subjects).
The Key Vault secrets `jwt-key` and `data-db-connection` must exist (values set by you in Key Vault, never in Git).

Azure SQL firewall: allow the AKS **outbound** public IP.
