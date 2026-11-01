# AKS cluster configuration

Plain Kubernetes YAML for the AKS cluster (no Helm), so every object and field is visible and easy to explain.
Kept separate from `k8s/docker-desktop/` (local laptop): nothing is shared or reused between the two folders.

## Folder structure

```
k8s/aks/
├── apps/          one file per microservice (all its objects in one place)
│   ├── data-api.yaml
│   ├── auth-api.yaml
│   ├── catalog-api.yaml
│   ├── order-api.yaml
│   ├── customer-portal.yaml
│   └── admin-portal.yaml
├── istio/         managed Istio (asm-1-30): gateway, VirtualService, mTLS, AuthorizationPolicies
├── key-vault/     SecretProviderClass objects (Key Vault CSI driver + Workload Identity)
└── argocd/        Argo CD Applications (if deployed with GitOps)
```

## Rules for `apps/<service>.yaml`

- One file per service, containing all of that service's objects, separated by `---`
  (ServiceAccount, Deployment, Service; later HPA, PodDisruptionBudget, NetworkPolicy).
- Short comments on every important line, so the file can be read top to bottom.
- The `image:` line is updated by CI (tag + digest). Never edit it by hand.

## Pipelines (GitHub Actions)

- One AKS pipeline per microservice: build, test, push the image to ACR (`krconnectspractice.azurecr.io`),
  then update the image (tag + digest) in `k8s/aks/apps/<service>.yaml` through a bot PR.
- A pipeline runs only when its own service folder changes (path filter).
- The earlier Docker Hub service pipelines are archived in `.github/workflows-archive/dockerhub/` (not run).
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
Network rules (Istio mTLS, AuthorizationPolicies, NetworkPolicy) live in `istio/`.
