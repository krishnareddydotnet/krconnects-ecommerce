# Istio on AKS (managed add-on asm-1-30)

Plain YAML for the AKS-managed Istio. Gateway pods: namespace `aks-istio-ingress`, label
`istio: aks-istio-ingressgateway-external`, Service `aks-istio-ingressgateway-external` (public LoadBalancer IP).

| File | What it does |
|---|---|
| `gateway.yaml` | Opens HTTP port 80 on the external gateway (HTTPS comes from Azure Front Door) |
| `virtualservice.yaml` | Sends every request to `customer-portal:8080`; its nginx forwards `/api/`, `/catalog-api/`, `/order-api/` |

admin-portal is not public on purpose. Open it with `kubectl port-forward service/admin-portal 8081:8080` -> http://localhost:8081.

Later in this folder: sidecar injection (`istio.io/rev=asm-1-30` on the namespace), STRICT mTLS, AuthorizationPolicies.

## Apply

```bash
kubectl apply -f k8s/aks/istio/
```

## Verify

```bash
kubectl get gateway,virtualservice
```

```bash
kubectl get service aks-istio-ingressgateway-external --namespace aks-istio-ingress
```

Open `http://<EXTERNAL-IP>` in the browser (the shop should load and log in should work).

## Clean up

```bash
kubectl delete -f k8s/aks/istio/
```
