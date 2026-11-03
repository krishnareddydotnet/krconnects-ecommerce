# Docker Desktop cluster configuration

Configuration for the local Docker Desktop Kubernetes cluster that is NOT part of the Helm chart:
Istio traffic and security rules, and the Argo CD Applications.
Secrets are NOT here: create them with kubectl (see docs/local-and-aks.md).

| Folder | What |
|---|---|
| `istio/common/authentication/peer-authentication.yaml` | STRICT mTLS for the `default` namespace (always applied) |
| `istio/common/authorization-policies/` | Who may call each service, zero trust (always applied) |
| `istio/monitoring/` | Prometheus, Grafana and Kiali through the gateway: https://prometheus.localhost, https://grafana.localhost, https://kiali.localhost (always applied) |
| `istio/scenarios/basic/` | Gateway (HTTPS 443 + redirect 80) + VirtualServices: https://localhost -> customer-portal, https://admin.localhost -> admin-portal |
| `istio/scenarios/canary/customer-portal/` | Canary for customer-portal: Rollout + stable/canary Services + weighted VirtualService, deployed by Argo CD app `customer-portal-canary`; the pipeline's bot PR updates its Rollout image (needs Argo Rollouts, setup guide B7; steps in `scenarios/canary/README.md`) |
| `istio/scenarios/blue-green/customer-portal/` | Blue-green for customer-portal: Rollout (blueGreen) + active/preview Services + VirtualService to active (Argo CD app `argocd/bluegreen-customer-portal.yaml`; the pipeline's bot PR updates its Rollout image; steps in `scenarios/blue-green/README.md`) |
| `istio/scenarios/ab-testing/` | A/B testing hands-on (to be added) |
| `monitoring/kube-prometheus-stack-values.yaml` | Helm values: Prometheus (7d, 10Gi), Grafana (login from secret `grafana-admin`) |
| `monitoring/istio-monitors.yaml` | PodMonitor (every Envoy sidecar) + ServiceMonitor (istiod): how Prometheus scrapes Istio |
| `monitoring/kiali-values.yaml` | Helm values: Kiali (anonymous, reads kube-prometheus-stack) |
| `argocd/applications.yaml` | The 6 Argo CD Applications (Helm) |
| `argocd/canary-customer-portal.yaml` | Argo CD Application `customer-portal-canary` (GitOps canary, plain YAML): apply only for the canary scenario, never together with the Helm app `customer-portal` (steps in `istio/scenarios/canary/README.md`) |
| `argocd/argocd-values.yaml` | Helm values: argocd-server insecure mode (TLS done by the gateway) |
| `argocd/argocd-virtualservice.yaml` | https://argocd.localhost through the gateway |

HTTPS for all URLs (self-signed certificate, PowerShell only, secret `krconnects-localhost-tls` in
`istio-ingress`): `docs/docker-desktop-https.md`.

## How the Istio folder works

- `common/` is shared by every scenario and always stays applied (mTLS and AuthorizationPolicies).
- `monitoring/` also always stays applied: one VirtualService per tool, all on the same Gateway and port 80.
  Istio picks the app by the Host header (exact host beats the shop's `"*"`). Chrome/Edge resolve
  `*.localhost` to 127.0.0.1, so no hosts-file change is needed. On a real cluster these tools belong on an
  internal gateway, never the public one (Prometheus has no login).
- `scenarios/` holds the labs. `basic/` (Gateway, shop route, admin route) always stays applied;
  a scenario replaces only what it changes. Same object names are used on purpose, so applying a
  scenario replaces the basic object (e.g. the canary's `krconnects-virtualservice` replaces the basic
  shop route), and re-applying `basic/` restores it. Only ONE scenario at a time.

```powershell
kubectl apply -f k8s/docker-desktop/istio/scenarios/canary/customer-portal/   # start a scenario
kubectl apply -f k8s/docker-desktop/istio/scenarios/basic/                    # back to basic routing
```

If Argo CD manages an object a scenario replaces (e.g. the customer-portal Deployment for the canary),
remove that Argo CD Application first, otherwise self-heal puts it back. Each scenario README lists
the exact steps there and back.

## Who may call whom

| Service | Allowed callers |
|---|---|
| customer-portal | Istio ingress gateway |
| auth-api | customer-portal, admin-portal |
| catalog-api | customer-portal, admin-portal |
| order-api | customer-portal, admin-portal |
| data-api | auth-api, catalog-api, order-api |
| admin-portal | Istio ingress gateway (https://admin.localhost); port-forward still works |
| everything else | denied by the `allow-nothing` baseline (e.g. notification-service) |

notification-service is not deployed on Docker Desktop (it needs Azure Service Bus).
Full rebuild guide: `docs/docker-desktop-setup.md`.

## Apply (from the repo root)

```powershell
kubectl apply -f k8s/docker-desktop/istio/common/authentication/
kubectl apply -f k8s/docker-desktop/istio/common/authorization-policies/
kubectl apply -f k8s/docker-desktop/istio/scenarios/basic/
kubectl apply -f k8s/docker-desktop/istio/monitoring/
kubectl apply -f k8s/docker-desktop/argocd/argocd-virtualservice.yaml
kubectl apply -f k8s/docker-desktop/argocd/applications.yaml
```

Adding a new service: add its service account to the AuthorizationPolicy of every service it calls,
and add an AuthorizationPolicy for the new service listing who may call it.

AKS uses different names (managed Istio): gateway label `istio: aks-istio-ingressgateway-external`
and the gateway service account in `aks-istio-ingress`. Keep AKS files in a separate folder.
