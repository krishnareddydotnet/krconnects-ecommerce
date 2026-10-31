# Docker Desktop cluster configuration

Configuration for the local Docker Desktop Kubernetes cluster that is NOT part of the Helm chart:
Istio traffic and security rules, and the Argo CD Applications.
Secrets are NOT here: create them with kubectl (see docs/local-and-aks.md).

| Folder | What |
|---|---|
| `istio/peer-authentication.yaml` | STRICT mTLS for the `default` namespace |
| `istio/gateway.yaml` | Istio ingress gateway on port 80 |
| `istio/virtualservice.yaml` | Routes all traffic to customer-portal |
| `istio/authorization-policies/` | Who may call each service (zero trust) |
| `argocd/applications.yaml` | The 6 Argo CD Applications |

## Who may call whom

| Service | Allowed callers |
|---|---|
| customer-portal | Istio ingress gateway |
| auth-api | customer-portal, admin-portal |
| catalog-api | customer-portal, admin-portal |
| order-api | customer-portal, admin-portal |
| data-api | auth-api, catalog-api, order-api |
| admin-portal | no policy yet (reached with kubectl port-forward only) |

notification-service is not deployed on Docker Desktop (it needs Azure Service Bus).

## Apply (from the repo root)

```powershell
kubectl apply -f k8s/docker-desktop/istio/peer-authentication.yaml
kubectl apply -f k8s/docker-desktop/istio/gateway.yaml
kubectl apply -f k8s/docker-desktop/istio/virtualservice.yaml
kubectl apply -f k8s/docker-desktop/istio/authorization-policies/
kubectl apply -f k8s/docker-desktop/argocd/applications.yaml
```

Adding a new service: add its service account to the AuthorizationPolicy of every service it calls,
and add an AuthorizationPolicy for the new service listing who may call it.

AKS uses different names (managed Istio): gateway label `istio: aks-istio-ingressgateway-external`
and the gateway service account in `aks-istio-ingress`. Keep AKS files in a separate folder.
