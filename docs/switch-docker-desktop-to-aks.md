# Switch hands-on practice between Docker Desktop and AKS

Use this guide to move the KRConnects e-commerce practice from the **Docker Desktop** kind cluster to the **AKS** practice
cluster, and back again. Both clusters use the same Azure SQL database and Blob Storage, so the data doesn't change.

**Which pipeline set is active?** Look at the file names in `.github/workflows/`:

| Files in `.github/workflows/` | Active target | Images go to | Bot PR updates |
|---|---|---|---|
| `docker-<service>-ci.yml` | Docker Desktop | Docker Hub `docker.io/ckreddy3030/<service>` | `k8s/docker-desktop/apps/<service>.yaml` |
| `aks-<service>-ci.yml` | AKS | ACR `krconnectspractice.azurecr.io/<service>` | `k8s/aks/apps/<service>.yaml` |

Only one set may be active at a time, because both sets watch the same service folders.
The shared workflows (secret-scan, codeql, snyk-security, terraform-ci, checkouttest) always stay in `.github/workflows/`.

Run all commands in **PowerShell 7** from the repo root `D:\krconnects\krconnects-ecommerce`.

---

## Part 1: Docker Desktop -> AKS

### Step 1: start the AKS cluster

The cluster is stopped between sessions to save cost. Starting it takes a few minutes.

```powershell
az aks start --resource-group rg-krconnects-practice-cin-001 --name aks-krconnects-practice-cin-001
az aks get-credentials --resource-group rg-krconnects-practice-cin-001 --name aks-krconnects-practice-cin-001 --overwrite-existing
kubectl config current-context
kubectl get nodes
```

**Check:**
- The context is `aks-krconnects-practice-cin-001`.
- 4 nodes are `Ready` (3 in `agentpool`, 1 in `userpool`).

The Docker Desktop cluster isn't touched; it's just no longer the current context.

### Step 2: check the platform add-ons

```powershell
kubectl get pods -n aks-istio-system
kubectl get pods -n aks-istio-ingress
kubectl get svc -n aks-istio-ingress
kubectl get pods -n kube-system | Select-String -Pattern "secrets-store|azure-wi|azure-policy|ama-"
kubectl get pods -n gatekeeper-system
```

| Add-on | Expect |
|---|---|
| Managed Istio (asm-1-30) | `istiod-asm-1-30-...` pods `Running` in `aks-istio-system` |
| Istio external ingress gateway | `aks-istio-ingressgateway-external-...` pods `Running`, and the Service has a public EXTERNAL-IP |
| Key Vault CSI driver | `aks-secrets-store-csi-driver-...` and `aks-secrets-store-provider-azure-...` (one per node) |
| Workload Identity | `azure-wi-webhook-controller-manager-...` (2 pods) |
| Azure Policy | `azure-policy-...` and `azure-policy-webhook-...` in `kube-system`, Gatekeeper pods in `gatekeeper-system` |
| Monitoring | `ama-logs-...` and `ama-metrics-...` (Container Insights and Managed Prometheus) |

### Step 3: check the Azure SQL firewall allows the AKS outbound IP

Pods on AKS reach Azure SQL through the cluster's outbound public IP.

```powershell
az aks show --resource-group rg-krconnects-practice-cin-001 --name aks-krconnects-practice-cin-001 --query "networkProfile.loadBalancerProfile.effectiveOutboundIPs[0].id" -o tsv
az network public-ip show --ids <id-from-the-command-above> --query ipAddress -o tsv
az sql server firewall-rule list --resource-group rg-ecommerce-sql --server krconnects -o table
```

**Check:** the outbound IP matches the `aks-krconnects-practice-outbound` rule (`52.140.91.144` at the time of writing).

### Step 4: switch the active pipelines to AKS

```powershell
git switch main
git pull
git switch -c ci/switch-to-aks-pipelines

Copy-Item .github/workflows/docker-*-ci.yml .github/workflows-archive-docker-raw/ -Force
Remove-Item .github/workflows/*-ci.yml -Exclude terraform-ci.yml
Copy-Item .github/workflows-archive-aks/aks-*-ci.yml .github/workflows/

git status
```

What each line does:
1. `Copy-Item ... -Force` saves the active Docker pipelines back to their archive, keeping any changes made while they were active.
2. `Remove-Item` removes all service pipelines from the active folder (`terraform-ci.yml` stays; the other shared workflows don't end in `-ci.yml`).
3. The last `Copy-Item` activates the 6 AKS pipelines.

**Check:** `git status` shows 6 `docker-*-ci.yml` deleted and 6 `aks-*-ci.yml` added.

```powershell
git add .github
git commit -m "ci: switch active service pipelines from Docker Hub to AKS (ACR)"
git push -u origin ci/switch-to-aks-pipelines
```

Open the PR, squash merge, then:

```powershell
git switch main
git pull
git branch -D ci/switch-to-aks-pipelines
```

This merge only changes `.github/`, so no service pipeline runs on its own.

### Step 5: build the latest images into ACR

AKS still runs the last images that were pushed to ACR. To bring every service up to date:

1. GitHub > **Actions** > pick `aks-<service>-ci` > **Run workflow** (branch `main`). Do this for all 6 services.
2. Each run builds, tests, scans and signs the image, pushes it to ACR, and opens a **bot PR** that updates the image
   (tag + digest) in `k8s/aks/apps/<service>.yaml`.
3. Merge each bot PR.

The pipelines log in to Azure with GitHub OIDC (app registration `id-github-acr-push`, AcrPush role). They need the repo
secrets `AZURE_ACR_PUSH_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`.

### Step 6: deploy to AKS

There's no Argo CD on AKS yet, so apply the manifests yourself after the bot PRs are merged:

```powershell
git switch main
git pull
kubectl apply -f k8s/aks/apps/
kubectl get pods -o wide
```

**Check:** all pods are `Running`, and each Deployment rolls to the new image.

Pods show `1/1` (no Istio sidecar) until the `default` namespace is labeled for managed Istio injection
(`istio.io/rev=asm-1-30`).

### Step 7: open the shop through the Istio gateway

```powershell
kubectl get svc aks-istio-ingressgateway-external -n aks-istio-ingress
```

Open `http://<EXTERNAL-IP>` and check:
- The banner and the footer version match the latest release.
- Products load. This proves Key Vault, Workload Identity and the SQL firewall are working.

It's plain HTTP on a raw IP until Front Door (HTTPS and a hostname) is added.

### Step 8: end of session, stop AKS

```powershell
az aks stop --resource-group rg-krconnects-practice-cin-001 --name aks-krconnects-practice-cin-001
```

Stopping AKS doesn't stop every charge: Front Door (if created) bills monthly, and ACR, Key Vault, Managed Grafana and
Log Analytics keep their own small costs. Delete Front Door after practice unless you want to keep it.

---

## Part 2: AKS -> Docker Desktop

### Step 1: switch kubectl back to the laptop

```powershell
kubectl config use-context docker-desktop
kubectl get nodes
kubectl get pods
```

If pods are stuck in `Unknown` or `Init` after a Docker Desktop restart, see "Troubleshooting" below.

### Step 2: switch the active pipelines back to Docker Hub

```powershell
git switch main
git pull
git switch -c ci/switch-to-docker-pipelines

Copy-Item .github/workflows/aks-*-ci.yml .github/workflows-archive-aks/ -Force
Remove-Item .github/workflows/*-ci.yml -Exclude terraform-ci.yml
Copy-Item .github/workflows-archive-docker-raw/docker-*-ci.yml .github/workflows/

git status
git add .github
git commit -m "ci: switch active service pipelines from AKS (ACR) to Docker Hub"
git push -u origin ci/switch-to-docker-pipelines
```

Open the PR, squash merge, then `git switch main`, `git pull` and `git branch -D ci/switch-to-docker-pipelines`.

### Step 3: bring Docker Desktop up to date

Images built while AKS was active went to ACR only, so Docker Desktop doesn't have them.
Run each `docker-<service>-ci` workflow once (**Run workflow**) and merge the bot PRs. Argo CD on Docker Desktop then
syncs the new images on its own (click **REFRESH** to make it instant).

### Step 4: stop AKS if it is still running

```powershell
az aks stop --resource-group rg-krconnects-practice-cin-001 --name aks-krconnects-practice-cin-001
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| AKS shows an old banner or version | The AKS pipelines haven't run since the last change | Part 1, step 5 (run each pipeline, merge the bot PRs), then step 6 |
| AKS pod `ImagePullBackOff` | The image in `k8s/aks/apps/<service>.yaml` isn't in ACR | Run that service's `aks-<service>-ci` pipeline and merge its bot PR |
| AKS pod stuck in `ContainerCreating`, event `MountVolume.SetUp failed ... secrets-store` | Key Vault or Workload Identity: missing secret, role or federated credential | Check `kubectl describe pod <pod>` events; check the managed identity has **Key Vault Secrets User** and a federated credential for the pod's ServiceAccount |
| data-api log `Client with IP address 'x.x.x.x' is not allowed` | The AKS outbound IP changed | Part 1, step 3: update the `aks-krconnects-practice-outbound` firewall rule |
| A pipeline fails at `azure/login` | OIDC: the federated credential subject or repo secrets are wrong | Check the app registration `id-github-acr-push` and the 3 `AZURE_*` repo secrets |
| A change triggers two pipelines | Both sets are in `.github/workflows/` | Keep only one set (Part 1 step 4 or Part 2 step 2) |
| Docker Desktop pods `Unknown` / `Init:1/2`, sidecar log `lookup istiod.istio-system.svc ... i/o timeout` | After a Docker restart, the kind nodes got new IPs but kindnet and kube-proxy kept the old ones | `kubectl delete pod -n kube-system -l app=kindnet`, `kubectl delete pod -n kube-system -l k8s-app=kube-proxy`, then `kubectl rollout restart deployment -n default` |
