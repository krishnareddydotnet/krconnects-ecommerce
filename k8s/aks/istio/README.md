# Istio on AKS (managed add-on asm-1-30)

Plain YAML for the AKS-managed Istio. Gateway pods: namespace `aks-istio-ingress`, label
`istio: aks-istio-ingressgateway-external`, Service `aks-istio-ingressgateway-external` (public LoadBalancer IP).

| File | What it does |
|---|---|
| `gateway.yaml` | Opens HTTP port 80 on the external gateway (HTTPS comes from Azure Front Door) |
| `virtualservice.yaml` | Sends every request to `customer-portal:8080`; its nginx forwards `/api/`, `/catalog-api/`, `/order-api/` |
| `authentication/peer-authentication.yaml` | STRICT mTLS for the `default` namespace (without it Istio is PERMISSIVE: plain text is also accepted) |
| `authorization-policies/allow-nothing.yaml` | Zero-trust baseline: deny every request in `default` unless a policy below allows it |
| `authorization-policies/<service>.yaml` | Allow-list per service, by caller service account (identity proven by mTLS) |

### Who may call whom (AuthorizationPolicies)

| Service | Allowed callers |
|---|---|
| customer-portal | ingress gateway `cluster.local/ns/aks-istio-ingress/sa/aks-istio-ingressgateway-external` |
| admin-portal | ingress gateway (no public route yet; `kubectl port-forward` bypasses the sidecar, so it still works) |
| auth-api, catalog-api, order-api | customer-portal, admin-portal |
| data-api | auth-api, catalog-api, order-api |

Differences from Docker Desktop (`k8s/docker-desktop/istio/common/`):

| | Docker Desktop | AKS |
|---|---|---|
| Gateway identity | `cluster.local/ns/istio-ingress/sa/istio-ingress` | `cluster.local/ns/aks-istio-ingress/sa/aks-istio-ingressgateway-external` |
| Pod label used by `selector` | `app.kubernetes.io/instance` | `app.kubernetes.io/name` |
| Sidecar injection label | `istio-injection=enabled` | `istio.io/rev=asm-1-30` |

admin-portal is not public on purpose. Open it with `kubectl port-forward service/admin-portal 8081:8080` -> http://localhost:8081.

Sidecar injection: the `default` namespace has the label `istio.io/rev=asm-1-30` (set once with
`kubectl label namespace default istio.io/rev=asm-1-30`, then `kubectl rollout restart deployment -n default`).
Every app pod shows `2/2` (app + istio-proxy).

## Apply

Check the gateway's service account name first (the two portal policies allow it by name):

```bash
kubectl get pods -n aks-istio-ingress -o jsonpath="{.items[0].spec.serviceAccountName}"
```

It should print `aks-istio-ingressgateway-external`. Then apply (mTLS before the policies, because the policies use
the identities that mTLS provides):

```bash
kubectl apply -f k8s/aks/istio/
kubectl apply -f k8s/aks/istio/authentication/
kubectl apply -f k8s/aks/istio/authorization-policies/
```

## Verify

```bash
kubectl get gateway,virtualservice,peerauthentication,authorizationpolicy
```

```bash
kubectl get service aks-istio-ingressgateway-external --namespace aks-istio-ingress
```

Open `http://<EXTERNAL-IP>` in the browser: the shop loads, log in works, and an order can be placed.
A `403` or `RBAC: access denied` means a caller is missing from a policy.

## Clean up

```bash
kubectl delete -f k8s/aks/istio/authorization-policies/
kubectl delete -f k8s/aks/istio/authentication/
kubectl delete -f k8s/aks/istio/
```
