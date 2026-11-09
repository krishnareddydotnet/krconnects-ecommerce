# KRConnects e-commerce: fresh install on an empty Docker Desktop cluster (runbook)

Use this runbook when Docker Desktop Kubernetes is **empty** (new install or full cleanup).
Follow the steps in order. Every step was tested on 6 Nov 2026 and ends with a check.

**End result:**
- 6 microservices deployed by Argo CD (basic rolling update).
- Istio with an HTTPS gateway, STRICT mTLS and zero-trust AuthorizationPolicies.
- Prometheus, Grafana, Kiali, metrics-server and Argo Rollouts.
- Every UI on https://*.localhost.

Run all commands in **PowerShell 7** from the repo root `D:\krconnects\krconnects-ecommerce`.
Everything runs on the laptop, with no Azure services: the database is **SQL Server 2025 Express on Windows**
(`k8s/docker-desktop/sql-server/README.md`) and the product images are on a **PVC** served by `image-server` (step 9a).

---

## Versions used

| Component | Helm chart | Version |
|---|---|---|
| Argo CD | argo/argo-cd | 10.11.1 |
| metrics-server | metrics-server/metrics-server | 3.14.0 |
| Istio (base, istiod, gateway) | istio/base, istio/istiod, istio/gateway | 1.30.7 |
| kube-prometheus-stack | prometheus-community/kube-prometheus-stack | 92.13.1 |
| Kiali | kiali/kiali-server | 2.33.0 |
| Argo Rollouts | argo/argo-rollouts | 2.43.8 |
| OPA Gatekeeper (optional) | gatekeeper/gatekeeper | 3.23.1 |

---

## Step 0: prerequisites

| Tool | Check |
|---|---|
| Docker Desktop, Kubernetes enabled, **kind** cluster with **6 nodes** (1 control-plane + 5 workers) | `kubectl get nodes` shows 6 `Ready` |
| Docker Desktop memory (WSL2) | 12 to 16 GB |
| PowerShell 7 | `$PSVersionTable.PSVersion` |
| kubectl, Helm, Azure CLI, Git | `kubectl version --client`, `helm version`, `az version`, `git status` |
| istioctl 1.30.7 on PATH (`C:\tools\istio-1.30.7\bin`) | `istioctl version` |
| Latest repo | `git switch main` then `git pull` |

```powershell
kubectl config use-context docker-desktop
kubectl get nodes
```

**Check:** 6 nodes `Ready`.

---

## Step 1: local SQL Server and its in-cluster name

The database runs on Windows (SQL Server 2025 Express, default instance, port 1433, database `ecommerce`,
login `ecommerce_data_api`). One-time Windows setup (install, TCP/IP on 1433, restore `dbscript.sql`, app login):
`k8s/docker-desktop/sql-server/README.md`.

Check SQL Server listens, then give it the in-cluster name `sql-server`:

```powershell
Test-NetConnection -ComputerName localhost -Port 1433
docker exec desktop-control-plane getent hosts host.docker.internal
kubectl apply -f k8s/docker-desktop/sql-server/sql-server-external.yaml
kubectl get endpointslice -l kubernetes.io/service-name=sql-server
```

**Check:** `TcpTestSucceeded : True`, and the EndpointSlice shows the same IP as `host.docker.internal`
(`192.168.65.254`; if it differs, update the IP in `sql-server-external.yaml`).

---

## Step 2: Kubernetes Secrets for the apps (never in Git)

| Secret | Key | Used by |
|---|---|---|
| `auth-api-secret` | `Jwt__Key` | auth-api, catalog-api, order-api |
| `data-api-secret` | `ConnectionStrings__DataDb` | data-api (local SQL Server through `sql-server`) |

```powershell
$JWT_KEY = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
kubectl create secret generic auth-api-secret --from-literal=Jwt__Key=$JWT_KEY

kubectl create secret generic data-api-secret --from-literal=ConnectionStrings__DataDb="Server=sql-server,1433;Database=ecommerce;User Id=ecommerce_data_api;Password=<password>;Encrypt=True;TrustServerCertificate=True"

kubectl describe secret auth-api-secret
kubectl describe secret data-api-secret
```

Replace `<password>` with the `ecommerce_data_api` password. `TrustServerCertificate=True` because local SQL Server uses a
self-signed certificate (laptop only, never production).

**Check:** `Jwt__Key: 64 bytes` and `ConnectionStrings__DataDb` is present.

---

## Step 3: Argo CD

Installed with the values file from the start: `server.insecure: true`, because TLS ends at the Istio gateway.

```powershell
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm install argocd argo/argo-cd --namespace argocd --create-namespace --version 10.11.1 -f k8s/docker-desktop/argocd/argocd-values.yaml
kubectl get pods -n argocd -w
```

Wait until all pods are `Running`, then press Ctrl+C.

Get the initial admin password:

```powershell
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | ForEach-Object { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
```

Until the gateway exists (step 8), open the UI with a port-forward on port **80**. Argo CD serves plain HTTP in insecure mode.

```powershell
kubectl port-forward svc/argocd-server -n argocd 8080:80
```

**Check:** http://localhost:8080 opens, and you can log in as `admin`.

Do NOT label the `argocd` namespace for Istio injection: Argo CD runs outside the mesh.

---

## Step 4: deploy the apps (GitOps)

```powershell
kubectl apply -f k8s/docker-desktop/argocd/applications.yaml
kubectl get applications -n argocd
kubectl get pods
```

- This creates 6 Argo CD apps. Each one deploys its plain YAML from `k8s/docker-desktop/apps/` on `main`.
- customer-portal starts in the **basic** scenario: a Deployment with rolling updates.

Test in a new PowerShell window:

```powershell
kubectl port-forward svc/customer-portal 3000:8080
```

**Check:**
- All 6 apps are `Synced / Healthy`.
- The 6 pods are `Running 1/1`.
- At http://localhost:3000 you can log in, see products and images, and place an order.

---

## Step 5: metrics-server (needed for the HPAs)

```powershell
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo update
helm install metrics-server metrics-server/metrics-server -n kube-system --version 3.14.0 --set "args={--kubelet-insecure-tls}"
```

Wait about a minute, then check:

```powershell
kubectl top nodes
kubectl get hpa
```

**Check:** the HPA `TARGETS` show `2%/70%` style values, not `<unknown>`.

`--kubelet-insecure-tls` is for a local cluster only: Docker Desktop's kubelet uses a self-signed certificate.

---

## Step 6: Istio 1.30.7

```powershell
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update
helm install istio-base istio/base -n istio-system --create-namespace --version 1.30.7
helm install istiod istio/istiod -n istio-system --version 1.30.7 --wait
kubectl create namespace istio-ingress
helm install istio-ingress istio/gateway -n istio-ingress --version 1.30.7 --wait
```

```powershell
kubectl get pods -n istio-system
kubectl get pods -n istio-ingress
kubectl get svc -n istio-ingress
```

**Check:**
- `istiod` and `istio-ingress` pods are `Running`.
- The `istio-ingress` Service is a `LoadBalancer` with ports `80` and `443`. The EXTERNAL-IP is the kind network IP (e.g. `172.18.0.10`), and https://localhost still reaches it.

The release name `istio-ingress` gives the label `istio: ingress` and the service account `istio-ingress`, which the Gateway and AuthorizationPolicies expect.

---

## Step 7: sidecar injection

```powershell
kubectl label namespace default istio-injection=enabled
kubectl rollout restart deployment -n default
kubectl get pods
```

**Check:** every app pod is `2/2` (app + istio-proxy).

---

## Step 8: HTTPS certificate, TLS secret and gateway

### 8a. Certificate files: reuse them if they exist

```powershell
Test-Path D:\krconnects\localhost.crt, D:\krconnects\localhost.key
```

- `True` `True`: the certificate already exists and is trusted in Windows. Skip to **8b**.
- `False`: create it once (valid 2 years), in the **same** PowerShell 7 window:

```powershell
$cert = New-SelfSignedCertificate -Subject "CN=localhost" -DnsName "localhost","admin.localhost","argocd.localhost","grafana.localhost","prometheus.localhost","kiali.localhost" -CertStoreLocation "Cert:\CurrentUser\My" -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(2) -FriendlyName "krconnects-localhost"

Export-Certificate -Cert $cert -FilePath D:\krconnects\localhost.cer | Out-Null
Import-Certificate -FilePath D:\krconnects\localhost.cer -CertStoreLocation Cert:\CurrentUser\Root

$pfx = $cert.Export("Pfx", "temp-pass")
$exportable = [System.Security.Cryptography.X509Certificates.X509CertificateLoader]::LoadPkcs12($pfx, "temp-pass", [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
$cert.ExportCertificatePem() | Set-Content D:\krconnects\localhost.crt
$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($exportable)
$rsa.ExportPkcs8PrivateKeyPem() | Set-Content D:\krconnects\localhost.key
```

Windows shows a security warning for "localhost". It's your own certificate, so click **Yes**.
The private key stays outside the repo; never commit `localhost.key`. Details: `docs/docker-desktop-https.md`.

### 8b. TLS secret (in the gateway pod's namespace)

```powershell
kubectl create secret tls krconnects-localhost-tls -n istio-ingress --cert=D:\krconnects\localhost.crt --key=D:\krconnects\localhost.key
kubectl get secret krconnects-localhost-tls -n istio-ingress
```

### 8c. Gateway, shop and admin routes, Argo CD route

```powershell
kubectl apply -f k8s/docker-desktop/istio/scenarios/basic/
kubectl apply -f k8s/docker-desktop/argocd/argocd-virtualservice.yaml
kubectl get gateway,virtualservice -A
```

**Check:**
- https://localhost, https://admin.localhost and https://argocd.localhost open with a padlock.
- http:// redirects to https://.
- You can now stop the port-forwards from steps 3 and 4.

---

## Step 9: mTLS and AuthorizationPolicies (zero trust)

Apply mTLS first, because the policies use the identities that mTLS provides.

```powershell
kubectl apply -f k8s/docker-desktop/istio/common/authentication/
kubectl apply -f k8s/docker-desktop/istio/common/authorization-policies/
kubectl get peerauthentication,authorizationpolicy
```

| Service | Allowed callers |
|---|---|
| customer-portal | Istio ingress gateway |
| admin-portal | Istio ingress gateway |
| auth-api, catalog-api, order-api | customer-portal, admin-portal |
| data-api | auth-api, catalog-api, order-api |
| everything else | denied (`allow-nothing` baseline) |

**Check:** on https://localhost you can browse, log in and place an order, and https://admin.localhost opens. No `RBAC: access denied`.

---

## Step 9a: product images (PVC + image-server)

The 500 images are on a PVC (kind `standard` StorageClass) and a small nginx pod serves them at `https://localhost/images/...`.
catalog-api already has `IMAGES_BASE_URL: "/images/"`, and the basic VirtualService already has the `/images/` route.

```powershell
kubectl apply -f k8s/docker-desktop/images/image-server.yaml
kubectl apply -f k8s/docker-desktop/istio/common/authorization-policies/image-server.yaml
kubectl get pvc product-images
kubectl get pods -l app.kubernetes.io/name=image-server
```

Copy the images from the backup (run inside the folder: `kubectl cp` on Windows can't take `D:` paths):

```powershell
cd D:\krconnects\product-images-backup
kubectl cp . default/<image-server-pod-name>:/usr/share/nginx/html/products -c image-server
cd D:\krconnects\krconnects-ecommerce
kubectl exec deploy/image-server -c image-server -- sh -c "ls /usr/share/nginx/html/products | wc -l"
```

**Check:** PVC `Bound`, pod `2/2 Running`, count `500`, and https://localhost shows product pictures.
Details and troubleshooting: `k8s/docker-desktop/images/README.md`.

---

## Step 10: monitoring (Prometheus, Grafana, Kiali)

```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add kiali https://kiali.org/helm-charts
helm repo update

kubectl create namespace monitoring
kubectl create secret generic grafana-admin -n monitoring --from-literal=admin-user=admin --from-literal=admin-password=<your-password>

helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring --version 92.13.1 -f k8s/docker-desktop/monitoring/kube-prometheus-stack-values.yaml
kubectl get pods -n monitoring
```

Wait until all `monitoring` pods are `Running`, then continue:

```powershell
kubectl apply -f k8s/docker-desktop/monitoring/istio-monitors.yaml
helm install kiali-server kiali/kiali-server -n istio-system --version 2.33.0 -f k8s/docker-desktop/monitoring/kiali-values.yaml
kubectl apply -f k8s/docker-desktop/istio/monitoring/
kubectl get pods -n istio-system
```

**Check:**
- https://prometheus.localhost, https://grafana.localhost and https://kiali.localhost open.
- In Prometheus, `istio_requests_total` returns data after some shop traffic.

The Grafana password comes from the `grafana-admin` secret, which is created **before** the install. Grafana has no PVC, so a pod restart re-creates the admin user from that secret.

---

## Step 11: Argo Rollouts

```powershell
helm repo update
helm install argo-rollouts argo/argo-rollouts -n argo-rollouts --create-namespace --version 2.43.8
kubectl get pods -n argo-rollouts
```

**Check:** 2 `argo-rollouts-...` pods are `Running`.

It's installed and ready. customer-portal stays on basic. To switch to canary or blue-green, follow `k8s/docker-desktop/istio/scenarios/README.md`.

---

## Step 12: set the Argo CD admin password

1. Go to https://argocd.localhost > **User Info** > **UPDATE PASSWORD**.
2. Enter the current password (from step 3), then your own password twice, and save.
3. Delete the initial secret, because it still holds the old password:

```powershell
kubectl delete secret argocd-initial-admin-secret -n argocd
```

---

## Step 13 (optional): OPA Gatekeeper

```powershell
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm repo update
helm install gatekeeper gatekeeper/gatekeeper --namespace gatekeeper-system --create-namespace --version 3.23.1
kubectl apply -f k8s/docker-desktop/gatekeeper/monitoring/gatekeeper-podmonitor.yaml
kubectl get pods -n gatekeeper-system
```

**Check:** `gatekeeper-controller-manager-...` and `gatekeeper-audit-...` pods are `Running`.
Policies (templates and constraints) and their steps: `k8s/docker-desktop/gatekeeper/README.md`.

---

## Final check: all UI links

| URL | App | Login |
|---|---|---|
| https://localhost | customer-portal (shop) | your app users |
| https://admin.localhost | admin-portal | `admin` app user |
| https://argocd.localhost | Argo CD | `admin` / your password |
| https://grafana.localhost | Grafana | `admin` / your password (from the `grafana-admin` secret) |
| https://prometheus.localhost | Prometheus | no login |
| https://kiali.localhost | Kiali | anonymous |

```powershell
kubectl get applications -n argocd      # 6 apps Synced / Healthy
kubectl get pods                        # 6 pods 2/2 Running
kubectl get hpa                         # TARGETS show percentages
```

notification-service is not deployed (it needs Azure Service Bus; it's on the backlog).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| data-api not ready, log `A network-related ... error` or `Login failed for user 'ecommerce_data_api'` | SQL Server not reachable on 1433, or wrong password in the secret | Step 1 checks; `k8s/docker-desktop/sql-server/README.md` (network test); recreate the secret (step 2) |
| Shop shows letter placeholders instead of pictures | Images not on the PVC, or catalog-api not synced | Step 9a; `k8s/docker-desktop/images/README.md` |
| Pod `ErrImagePull` | The image tag/digest in `k8s/docker-desktop/apps/<service>.yaml` is not on Docker Hub | Re-run the service's CI pipeline and merge its bot PR |
| Portal `CrashLoopBackOff`, nginx `host not found in upstream` | A backend Service is missing | Deploy the missing service, then `kubectl delete pod <portal-pod>` |
| Pods `1/1` after step 7 | Pods were created before the namespace label | `kubectl rollout restart deployment -n default` |
| `RBAC: access denied` / 403 | An AuthorizationPolicy doesn't list the caller | Add the caller's service account to the target's policy (step 9) |
| Argo CD `ERR_TOO_MANY_REDIRECTS` on https://argocd.localhost | Argo CD not in insecure mode | Check `kubectl get configmap argocd-cmd-params-cm -n argocd -o jsonpath="{.data.server\.insecure}"` is `true` (step 3 values file) |
| Browser says "Not secure" | Certificate not trusted, or cached | Step 8a; close all Chrome/Edge windows and reopen |
| Grafana login fails after changing the secret | The pod still has the old admin user | `kubectl exec -n monitoring deploy/kube-prometheus-stack-grafana -c grafana -- grafana cli admin reset-admin-password <your-password>` |
| Argo CD reverts a manual change | Self-heal: Git is the source of truth | Change Git (PR), not the cluster |

Useful commands:

```powershell
kubectl describe pod <pod> | Select-String -Pattern "Image:|Failed|Error|Unhealthy"
kubectl logs <pod> -c <service> --previous
kubectl get deployment -o wide
kubectl get applications -n argocd
```
