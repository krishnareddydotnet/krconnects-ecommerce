# KRConnects e-commerce: Docker Desktop setup (from zero)

Use this guide to rebuild the whole local environment after a fresh Docker Desktop install.

- **Part A**: base platform and the app (no Istio). Ends when the customer portal works through port-forward.
- **Part B**: service mesh (Istio): gateway, mTLS, AuthorizationPolicies; monitoring, Argo Rollouts, OPA Gatekeeper.
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

Argo CD deploys the plain YAML files `k8s/docker-desktop/apps/<service>.yaml` from `main`, with the Docker Hub images
that CI built (the `docker-<service>-ci.yml` bot PRs update the image lines).
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
`k8s/docker-desktop/apps/auth-api.yaml`, default `admin`; sign up with that name on the customer portal first).

**Part A is done when the customer portal works through port-forward.** Only then continue with Part B.

## A7. Optional: build images locally and install with Helm (testing only, nothing pushed)

This uses the Helm chart `helm/ecommerce`, which is kept for reference (Argo CD now deploys plain YAML).

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

## A8. metrics-server (needed for the HPAs)

Every `k8s/docker-desktop/apps/<service>.yaml` has a HorizontalPodAutoscaler. It needs CPU numbers from
metrics-server, which Docker Desktop does not install. Without it `kubectl get hpa` shows `<unknown>` and nothing scales
(the apps still run).

```powershell
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo update
helm install metrics-server metrics-server/metrics-server -n kube-system --set "args={--kubelet-insecure-tls}"
kubectl top nodes                          # CPU / memory after about a minute
kubectl get hpa                            # TARGETS e.g. 2%/70% instead of <unknown>
```

`--kubelet-insecure-tls`: Docker Desktop's kubelet uses a self-signed certificate; this flag is for a local cluster
only, never for a real one.

## A9. One-time switch of an existing cluster from the Helm apps to plain YAML

Only if your cluster still runs the old Helm-based Argo CD apps. The Deployments' selector labels change
(Helm used `app.kubernetes.io/name: ecommerce`), and a selector cannot be changed in place, so the old Deployments are
deleted once. Expect about a minute of downtime. If a canary or blue-green scenario is active, go back to basic first
(`k8s/docker-desktop/istio/scenarios/README.md`).

```powershell
# 1. Remove the 6 Argo CD apps only (they have no cascade finalizer, so the running objects stay)
kubectl delete -f k8s/docker-desktop/argocd/applications.yaml
# 2. Delete the old Helm Deployments (Services and ServiceAccounts stay and are taken over in step 3)
kubectl delete deployment data-api auth-api catalog-api order-api customer-portal admin-portal
# 3. Create the apps again: now they deploy k8s/docker-desktop/apps/<service>.yaml
kubectl apply -f k8s/docker-desktop/argocd/applications.yaml
kubectl get applications -n argocd                 # all Synced / Healthy
kubectl get sa,deploy,svc,hpa,pdb,networkpolicy
```

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

The zip also contains `samples\addons` (Istio demo addons); this setup does not use them (see B6).

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

`scenarios/basic/` holds the Gateway and the VirtualServices (plain 100% routing): `localhost` -> customer-portal,
`admin.localhost` -> admin-portal. Other scenarios
(canary, blue-green, A/B testing) live next to it; only one scenario is applied at a time.

Open **https://localhost** (customer portal) and **https://admin.localhost** (admin portal), no port-forward needed.
The Gateway serves HTTPS only (port 80 redirects), so create the certificate and the TLS secret first:
`docs/docker-desktop-https.md`, steps 1-4.

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
| admin-portal | Istio ingress gateway (https://admin.localhost); port-forward still works |
| everything else | denied by the `allow-nothing` baseline (e.g. notification-service) |

Re-test: https://localhost (browse, log in, place an order) and https://admin.localhost (admin portal).

Adding a new service: add its service account to the policy of every service it calls, and add a policy for
the new service listing who may call it.

## B6. Monitoring: Prometheus, Grafana and Kiali

Installed with Helm (versions pinned), values files in `k8s/docker-desktop/monitoring/`:

| Helm release | Chart (version) | Namespace | What |
|---|---|---|---|
| kube-prometheus-stack | prometheus-community/kube-prometheus-stack (92.13.1) | monitoring | Prometheus, Grafana, Alertmanager, node-exporter, kube-state-metrics |
| kiali-server | kiali/kiali-server (2.33.0) | istio-system | Kiali service graph, reads metrics from kube-prometheus-stack |

```
Envoy sidecars --(PodMonitor envoy-stats-monitor)--+
istiod --------(ServiceMonitor istio-component-monitor)--> Prometheus --> Grafana dashboards
                                                                  \--> Kiali graph
```

1. Helm repositories:

```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add kiali https://kiali.org/helm-charts
helm repo update
```

2. Grafana admin login as a secret BEFORE the install (the values file points to it; no password in Git).
   Choose your own password:

```powershell
kubectl create namespace monitoring
kubectl create secret generic grafana-admin -n monitoring --from-literal=admin-user=admin --from-literal=admin-password=ChooseAStrongPassword
```

3. kube-prometheus-stack:

```powershell
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring --version 92.13.1 -f k8s/docker-desktop/monitoring/kube-prometheus-stack-values.yaml
kubectl get pods -n monitoring           # wait until all are Running
```

Values: Grafana login from `grafana-admin`; Prometheus keeps 7 days on a 10Gi PVC; and
`serviceMonitorSelectorNilUsesHelmValues: false` / `podMonitorSelectorNilUsesHelmValues: false` make Prometheus
use monitors from every namespace (needed for the Istio monitors in `istio-system`).

4. Tell Prometheus to scrape Istio (a PodMonitor for every Envoy sidecar, a ServiceMonitor for istiod):

```powershell
kubectl apply -f k8s/docker-desktop/monitoring/istio-monitors.yaml
kubectl get podmonitor,servicemonitor -n istio-system   # envoy-stats-monitor, istio-component-monitor
```

Check in Prometheus (https://prometheus.localhost): query `istio_requests_total` returns data after some traffic.

5. Kiali:

```powershell
helm install kiali-server kiali/kiali-server -n istio-system --version 2.33.0 -f k8s/docker-desktop/monitoring/kiali-values.yaml
kubectl get pods -n istio-system         # kiali-... Running
```

Values: anonymous login (laptop only) and the Prometheus URL of kube-prometheus-stack.
Kiali serves under `/kiali` (https://kiali.localhost redirects there).

Do NOT use `samples\addons\prometheus.yaml` / `kiali.yaml` (Istio's demo addons) together with this setup:
they would install a second Prometheus in `istio-system`.

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


## B7. Argo Rollouts (canary and blue-green deployments)

Argo Rollouts adds the `Rollout` object: a Deployment with release strategies (canary steps with Istio
weights, blue-green with active/preview Services, pauses, promote/abort). Needed for
`k8s/docker-desktop/istio/scenarios/canary/` and `blue-green/`.

| Helm release | Chart (version) | App version | Namespace |
|---|---|---|---|
| argo-rollouts | argo/argo-rollouts (2.43.8) | v1.10.1 | argo-rollouts |

The `argo` Helm repository was added in A4 (Argo CD).

```powershell
helm repo update
helm search repo argo/argo-rollouts                 # latest chart version (2.43.8 was used here)
helm install argo-rollouts argo/argo-rollouts -n argo-rollouts --create-namespace --version 2.43.8
kubectl get pods -n argo-rollouts                   # 2 x argo-rollouts-... Running (chart default: 2 replicas)
kubectl get crd | Select-String argoproj.io         # rollouts, analysistemplates, analysisruns, experiments ...
```

- The controller watches `Rollout` objects: it creates the ReplicaSets, points the stable/canary Services
  at the right pods and changes the VirtualService weights step by step.
- The CRDs are the new object types (`Rollout`, `AnalysisTemplate`, ...) that Kubernetes now accepts.

Promote / abort a running rollout:

- Argo CD UI (no extra tool): open the Application, click the Rollout resource -> &#8942; -> Promote or Abort.
- Optional CLI plugin `kubectl argo rollouts` (separate download from the Argo Rollouts GitHub releases):
  `kubectl argo rollouts get rollout <name> --watch`, `... promote <name>`, `... abort <name>`.

Remove: `helm uninstall argo-rollouts -n argo-rollouts` (delete the Rollouts first; the CRDs stay and are
removed with `kubectl delete crd rollouts.argoproj.io analysistemplates.argoproj.io analysisruns.argoproj.io experiments.argoproj.io clusteranalysistemplates.argoproj.io`).

---

## B8. OPA Gatekeeper (policy as code)

Gatekeeper runs OPA as a validating admission webhook: every create/update is checked against your
Rego policies (ConstraintTemplates + Constraints) and allowed or denied. Hands-on before AKS, where the
Azure Policy add-on installs Gatekeeper for you.

| Helm release | Chart (version) | Namespace |
|---|---|---|
| gatekeeper | gatekeeper/gatekeeper (3.23.1) | gatekeeper-system |

```powershell
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm repo update
helm install gatekeeper gatekeeper/gatekeeper --namespace gatekeeper-system --create-namespace --version 3.23.1
kubectl get pods -n gatekeeper-system                # gatekeeper-controller-manager-... and gatekeeper-audit-... Running
kubectl apply -f k8s/docker-desktop/gatekeeper/monitoring/gatekeeper-podmonitor.yaml   # metrics in Prometheus/Grafana (needs B6)
```

Nothing is enforced until a ConstraintTemplate and a Constraint are applied. Basics, policies, monitoring,
uninstall: `k8s/docker-desktop/gatekeeper/README.md`.

---

# Part C: troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Pod `ErrImagePull` | The `image:` line in `k8s/docker-desktop/apps/<service>.yaml` points to a tag/digest that is not on Docker Hub | Re-run the service's `docker-<service>-ci.yml` pipeline and merge its bot PR |
| Argo CD sync error `field is immutable` on a Deployment (spec.selector) | Old Helm Deployment still there | A9: delete the old Deployments once |
| customer-portal / admin-portal `CrashLoopBackOff`, nginx log `host not found in upstream "order-api"` | nginx checks all `proxy_pass` hosts at startup; a backend Service is missing | Deploy the missing service (order-api), then `kubectl delete pod <portal-pod>` |
| data-api restarts, log `Client with IP address 'x.x.x.x' is not allowed` | Azure SQL firewall | Add / update the laptop IP rule (A2), then `kubectl rollout restart deployment data-api` |
| UI says "not allowed" / API returns 403 `RBAC: access denied` | Istio AuthorizationPolicy does not list the caller | Add the caller's service account to the target's policy (B5) |
| order-api `1/2`, readiness 503 | It cannot reach data-api (policy) | data-api policy must allow `sa/order-api` |
| Argo CD changes back a manual edit | Self-heal: Git is the source of truth | Change Git (PR), not the cluster |
| Pods `1/1` after enabling Istio | Pods were created before injection | `kubectl rollout restart deployment -n default` |

Useful commands:

```powershell
kubectl describe pod <pod> | Select-String -Pattern "Image:|Failed|Error|Unhealthy"
kubectl logs <pod> -c <service> --previous         # log of the crashed app container (container name = service name)
kubectl get deployment -o wide                      # which image each service runs
kubectl get applications -n argocd
```
