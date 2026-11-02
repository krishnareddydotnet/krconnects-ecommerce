# KRConnects e-commerce: Docker Desktop setup (from zero)

Use this guide to rebuild the whole local environment after a fresh Docker Desktop install.

- **Part A**: base platform and the app (no Istio). Ends when the customer portal works through port-forward.
- **Part B**: service mesh (Istio): gateway, mTLS, AuthorizationPolicies.
- **Part C**: troubleshooting (real issues we hit).

Azure SQL (data) and Azure Blob Storage (product images) stay in Azure; only the cluster is local.
Run all commands in PowerShell from the repo root `D:\krconnects\krconnects-ecommerce` unless stated.

---

# Part A: base platform and app (no Istio)

## A1. Prerequisites

| Tool | Check |
|---|---|
| Docker Desktop (Kubernetes enabled, **kind** cluster, **4 nodes**: 1 control-plane + 3 workers) | `kubectl get nodes` shows 4 nodes `Ready` |
| Docker Desktop memory (WSL2) | 12 to 16 GB |
| kubectl | `kubectl version --client` |
| Helm | `helm version` |
| Azure CLI | `az version` |
| Git (repo cloned) | `git status` |

```powershell
kubectl config use-context docker-desktop
kubectl get nodes
```

## A2. Allow the laptop in the Azure SQL firewall

Pods on Docker Desktop reach Azure SQL through your laptop's public IP.

```powershell
(Invoke-RestMethod https://api.ipify.org)                # your current public IP
az login
az sql server firewall-rule create --resource-group rg-ecommerce-sql --server krconnects --name laptop-home --start-ip-address <your-ip> --end-ip-address <your-ip>
az sql server firewall-rule list --resource-group rg-ecommerce-sql --server krconnects -o table
```

Home IPs change (e.g. after a router restart). Update the same rule:

```powershell
az sql server firewall-rule update --resource-group rg-ecommerce-sql --server krconnects --name laptop-home --start-ip-address <new-ip> --end-ip-address <new-ip>
```

Portal alternative: SQL servers > krconnects > Security > Networking > **Add your client IPv4 address** > Save.

## A3. Kubernetes Secrets (never stored in Git)

| Secret | Key | Used by |
|---|---|---|
| `auth-api-secret` | `Jwt__Key` | auth-api, catalog-api, order-api (sign / check login tokens) |
| `data-api-secret` | `ConnectionStrings__DataDb` | data-api (Azure SQL) |

```powershell
# 1. JWT key: a new random 64-character key, never shown on screen
$JWT_KEY = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
kubectl create secret generic auth-api-secret --from-literal=Jwt__Key=$JWT_KEY

# 2. Azure SQL connection string: copy it from Azure portal > SQL database "ecommerce" >
#    Connection strings > ADO.NET, and put your real password in it
kubectl create secret generic data-api-secret --from-literal=ConnectionStrings__DataDb="<connection-string>"

# Check (shows key names and sizes, not values)
kubectl describe secret auth-api-secret
kubectl describe secret data-api-secret
```

A new JWT key only means old login sessions become invalid; users log in again.

## A4. Install Argo CD (Helm)

```powershell
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm install argocd argo/argo-cd --namespace argocd --create-namespace
kubectl get pods -n argocd -w            # wait until all are Running, then Ctrl+C
```

To install a specific version add `--version <chart-version>` (see `helm search repo argo/argo-cd --versions`).

Admin password:

```powershell
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | ForEach-Object { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
```

Open the UI (keep this window open):

```powershell
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Browse to **https://localhost:8080** (accept the certificate warning), user `admin`.

Do NOT label the `argocd` namespace for Istio injection: Argo CD runs outside the mesh.

## A5. Deploy the apps with Argo CD (GitOps)

```powershell
kubectl apply -f k8s/docker-desktop/argocd/applications.yaml
kubectl get applications -n argocd        # all Synced / Healthy
kubectl get pods                          # 6 pods Running (1/1 without Istio)
```

Argo CD deploys `helm/ecommerce` from `main` with the Docker Hub images that CI built.
notification-service is not deployed locally (it needs Azure Service Bus).

## A6. Check: open the sites with port-forward

Customer portal (new PowerShell window):

```powershell
kubectl port-forward svc/customer-portal 3000:8080
```

Open **http://localhost:3000**: sign up / log in, see products and images, place an order.

Admin portal (another window):

```powershell
kubectl port-forward svc/admin-portal 8085:8080
```

Open **http://localhost:8085** and log in with an admin user (username listed in `Admin__Usernames` in
`helm/ecommerce/values-auth-api.yaml`, default `admin`; sign up with that name on the customer portal first).

**Part A is done when the customer portal works through port-forward.** Only then continue with Part B.

## A7. Optional: build images locally and install with Helm (testing only, nothing pushed)

Use this to test local code changes without CI. Do not mix with Argo CD on the same cluster:
if Argo CD manages a service, it will undo manual Helm changes (self-heal).

1) Build the images with tag `v1.0.0`:

```powershell
docker build -t customer-portal:v1.0.0 ./customer-portal
docker build -t admin-portal:v1.0.0 ./admin-portal
docker build -t auth-api:v1.0.0 ./auth-api
docker build -t catalog-api:v1.0.0 ./catalog-api
docker build -t data-api:v1.0.0 ./data-api
docker build -t order-api:v1.0.0 ./order-api
docker build -t notification-service:v1.0.0 ./notification-service
docker images
```

2) Local override file (ignored by Git). `.gitignore` contains:

```text
# Local-only Helm overrides for laptop testing (never committed)
helm/ecommerce/*.local.yaml
```

Create `helm/ecommerce/v1.0.0.local.yaml`:

```yaml
image:
  registry: ""          # no registry = use the image built on this laptop
  tag: "v1.0.0"
  digest: ""            # clear the Docker Hub digest from the repo values
  pullPolicy: Never     # never download, use the local image only
```

Helm merges values files in order and the last `-f` wins, so this one file works for every service
(each service still gets its own name, env and probes from its own values file).

3) Check that no tracked file changed:

```powershell
git status                                # must show: nothing to commit
```

4) Install in dependency order:

```powershell
helm upgrade --install data-api ./helm/ecommerce -f ./helm/ecommerce/values-data-api.yaml -f ./helm/ecommerce/v1.0.0.local.yaml
helm upgrade --install auth-api ./helm/ecommerce -f ./helm/ecommerce/values-auth-api.yaml -f ./helm/ecommerce/v1.0.0.local.yaml
helm upgrade --install catalog-api ./helm/ecommerce -f ./helm/ecommerce/values-catalog-api.yaml -f ./helm/ecommerce/v1.0.0.local.yaml
helm upgrade --install order-api ./helm/ecommerce -f ./helm/ecommerce/values-order-api.yaml -f ./helm/ecommerce/v1.0.0.local.yaml
helm upgrade --install customer-portal ./helm/ecommerce -f ./helm/ecommerce/values-customer-portal.yaml -f ./helm/ecommerce/v1.0.0.local.yaml
helm upgrade --install admin-portal ./helm/ecommerce -f ./helm/ecommerce/values-admin-portal.yaml -f ./helm/ecommerce/v1.0.0.local.yaml
```

Preview the final image line without installing:

```powershell
helm template data-api ./helm/ecommerce -f ./helm/ecommerce/values-data-api.yaml -f ./helm/ecommerce/v1.0.0.local.yaml | Select-String "image:"
```

If pods show **ErrImageNeverPull**, the kind nodes cannot see Docker Desktop's local images.
Load them into the cluster nodes first (e.g. `kind load docker-image data-api:v1.0.0 --name <cluster-name>`),
or use the Argo CD path with Docker Hub images instead.

---

# Part B: service mesh (Istio 1.30.7)

## B1. istioctl (same version as the control plane)

1. Download `istio-1.30.7-win.zip` from **https://github.com/istio/istio/releases/tag/1.30.7** (Assets).
2. Extract it, e.g. to `C:\tools\istio-1.30.7`.
3. Add `C:\tools\istio-1.30.7\bin` to PATH (Edit the system environment variables > Environment Variables > Path > New).
4. Reopen PowerShell and check:

```powershell
istioctl version
```

The zip also contains `samples\addons` (Prometheus, Kiali, Grafana, Jaeger YAML) used in B6.

## B2. Install Istio with Helm

```powershell
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update

# 1. CRDs (Istio resource types)
helm install istio-base istio/base -n istio-system --create-namespace --version 1.30.7

# 2. Control plane (istiod: config, certificates for mTLS)
helm install istiod istio/istiod -n istio-system --version 1.30.7 --wait

# 3. Ingress gateway (Envoy pods + LoadBalancer service).
#    Release name "istio-ingress" gives the label istio: ingress and service account istio-ingress,
#    which gateway.yaml and the customer-portal AuthorizationPolicy expect.
kubectl create namespace istio-ingress
helm install istio-ingress istio/gateway -n istio-ingress --version 1.30.7 --wait

kubectl get pods -n istio-system
kubectl get pods -n istio-ingress
kubectl get svc -n istio-ingress          # LoadBalancer on localhost (Docker Desktop)
istioctl version
```

## B3. Sidecar injection

```powershell
kubectl label namespace default istio-injection=enabled
kubectl rollout restart deployment -n default
kubectl get pods                          # each pod now 2/2 (app + istio-proxy)
```

Only NEW pods get the Envoy sidecar, which is why the deployments are restarted.
Istio 1.30 runs the sidecar as a native sidecar (an init container that keeps running).

## B4. Gateway and VirtualService

```powershell
kubectl apply -f k8s/docker-desktop/istio/scenarios/basic/
```

`scenarios/basic/` holds the Gateway and VirtualService (plain 100% routing). Other scenarios
(canary, blue-green, A/B testing) live next to it; only one scenario is applied at a time.

Open **http://localhost** (no port-forward needed): customer portal through the Istio gateway.

| Resource | Question it answers |
|---|---|
| Gateway | Which port/hosts does the ingress gateway accept? |
| VirtualService | Where does the traffic go? (customer-portal) |
| DestinationRule | How is traffic handled at the destination? (subsets, circuit breaker). Not used yet; added in the canary / circuit breaker learning topics |

## B5. mTLS and AuthorizationPolicies (zero trust)

Apply mTLS first: AuthorizationPolicies rely on the identities that mTLS provides.

```powershell
kubectl apply -f k8s/docker-desktop/istio/common/authentication/
kubectl apply -f k8s/docker-desktop/istio/common/authorization-policies/
kubectl get peerauthentication,authorizationpolicy
```

Who may call whom:

| Service | Allowed callers |
|---|---|
| customer-portal | Istio ingress gateway |
| auth-api | customer-portal, admin-portal |
| catalog-api | customer-portal, admin-portal |
| order-api | customer-portal, admin-portal |
| data-api | auth-api, catalog-api, order-api |
| admin-portal | Istio ingress gateway (for a future admin host); port-forward still works |
| everything else | denied by the `allow-nothing` baseline (e.g. notification-service) |

Re-test: http://localhost (browse, log in, place an order) and the admin portal through port-forward.

Adding a new service: add its service account to the policy of every service it calls, and add a policy for
the new service listing who may call it.

## B6. Optional: Kiali and Prometheus

```powershell
kubectl apply -f C:\tools\istio-1.30.7\samples\addons\prometheus.yaml
kubectl apply -f C:\tools\istio-1.30.7\samples\addons\kiali.yaml
istioctl dashboard kiali
```

Kiali shows the live service graph, traffic and mTLS locks.

### B6.1 Open Prometheus, Grafana and Kiali through the gateway (no port-forward)

Prometheus and Grafana here are the kube-prometheus-stack in the `monitoring` namespace; Kiali is in `istio-system`.
One VirtualService per tool, all on the existing `krconnects-gateway` (port 80, `hosts: "*"`, so the Gateway
needs no change):

```powershell
kubectl apply -f k8s/docker-desktop/istio/monitoring/
kubectl get virtualservice -A
```

| URL | Goes to (Service : port) |
|---|---|
| https://prometheus.localhost | `kube-prometheus-stack-prometheus.monitoring` : 9090 |
| https://grafana.localhost | `kube-prometheus-stack-grafana.monitoring` : 80 |
| https://kiali.localhost | `kiali.istio-system` : 20001 |

How it works: Chrome/Edge resolve `*.localhost` to 127.0.0.1, so every URL reaches the same gateway on port 80.
The browser sends the name in the `Host` header and Istio picks the VirtualService with that exact host;
an exact host wins over the shop's `"*"`, so https://localhost still opens customer-portal.

Grafana login: user and password are in the `grafana-admin` secret:

```powershell
kubectl get secret grafana-admin -n monitoring -o jsonpath="{.data.admin-user}" | ForEach-Object { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
kubectl get secret grafana-admin -n monitoring -o jsonpath="{.data.admin-password}" | ForEach-Object { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
```

If a page does not load, check the Service name and port: `kubectl get svc -n monitoring` / `-n istio-system`.
Production: these tools go on an internal gateway (private IP), never the public one; Prometheus has no login.

### B6.2 HTTPS for all UIs and Argo CD through the gateway

All URLs above, the shop and Argo CD (https://argocd.localhost) run over HTTPS with a self-signed
certificate created with PowerShell 7; `http://` redirects to `https://`.
Full steps (certificate, TLS secret, Gateway on 443, Argo CD insecure mode): **docs/docker-desktop-https.md**.

---

# Part C: troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Pod `ErrImagePull`, image shown as `data-api:<tag>` (pulled from `docker.io/library`) | `registry: ""` in the values file | Values must have `registry: "docker.io/ckreddy3030"`; re-run the service's pipeline |
| customer-portal / admin-portal `CrashLoopBackOff`, nginx log `host not found in upstream "order-api"` | nginx checks all `proxy_pass` hosts at startup; a backend Service is missing | Deploy the missing service (order-api), then `kubectl delete pod <portal-pod>` |
| data-api restarts, log `Client with IP address 'x.x.x.x' is not allowed` | Azure SQL firewall | Add / update the laptop IP rule (A2), then `kubectl rollout restart deployment data-api` |
| UI says "not allowed" / API returns 403 `RBAC: access denied` | Istio AuthorizationPolicy does not list the caller | Add the caller's service account to the target's policy (B5) |
| order-api `1/2`, readiness 503 | It cannot reach data-api (policy) | data-api policy must allow `sa/order-api` |
| Argo CD changes back a manual edit | Self-heal: Git is the source of truth | Change Git (PR), not the cluster |
| Pods `1/1` after enabling Istio | Pods were created before injection | `kubectl rollout restart deployment -n default` |

Useful commands:

```powershell
kubectl describe pod <pod> | Select-String -Pattern "Image:|Failed|Error|Unhealthy"
kubectl logs <pod> -c ecommerce --previous          # log of the crashed app container
kubectl get deployment -o wide                      # which image each service runs
kubectl get applications -n argocd
```
