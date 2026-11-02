# Docker Desktop cluster configuration

Configuration for the local Docker Desktop Kubernetes cluster that is NOT part of the Helm chart:
Istio traffic and security rules, and the Argo CD Applications.
Secrets are NOT here: create them with kubectl (see docs/local-and-aks.md).

| Folder | What |
|---|---|
| `istio/common/authentication/peer-authentication.yaml` | STRICT mTLS for the `default` namespace (always applied) |
| `istio/common/authorization-policies/` | Who may call each service, zero trust (always applied) |
| `istio/monitoring/` | Prometheus, Grafana and Kiali through the gateway: https://prometheus.localhost, https://grafana.localhost, https://kiali.localhost (always applied) |
| `istio/scenarios/basic/` | Gateway (HTTPS 443 + redirect 80) + VirtualService: all traffic to customer-portal |
| `istio/scenarios/canary/` | Canary hands-on (to be added) |
| `istio/scenarios/blue-green/` | Blue-green hands-on (to be added) |
| `istio/scenarios/ab-testing/` | A/B testing hands-on (to be added) |
| `argocd/applications.yaml` | The 6 Argo CD Applications |
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
- `scenarios/` holds self-contained labs. Only ONE scenario is active at a time:
  delete the current one, then apply the next. Scenarios use the same object names
  (e.g. `krconnects-gateway`), so nothing is left over.

```powershell
kubectl delete -f k8s/docker-desktop/istio/scenarios/basic/
kubectl apply  -f k8s/docker-desktop/istio/scenarios/canary/
```

If Argo CD manages an object a scenario replaces (e.g. the order-api Deployment for canary),
pause or remove that Argo CD Application first, otherwise self-heal puts it back.

## Who may call whom

| Service | Allowed callers |
|---|---|
| customer-portal | Istio ingress gateway |
| auth-api | customer-portal, admin-portal |
| catalog-api | customer-portal, admin-portal |
| order-api | customer-portal, admin-portal |
| data-api | auth-api, catalog-api, order-api |
| admin-portal | Istio ingress gateway (for a future admin host); port-forward still works |
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
