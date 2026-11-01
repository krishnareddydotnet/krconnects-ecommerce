# Canary deployment: customer-portal (Docker Desktop, Istio)

Run customer-portal v1 and v2 side by side and let Istio split user traffic between them.

```
browser -> Istio gateway -> VirtualService --+-- 90% -> customer-portal     (v1, Argo CD)
                                             +-- 10% -> customer-portal-v2  (v2, Helm release)
```

v2 is recognisable by the green promo banner ("... - v2") and version 1.10.0 in the footer.

| File | What |
|---|---|
| `customer-portal-v2-values.yaml` | Helm values for v2 (name, v2 image, shared service account) |
| `authorization-policy-v2.yaml` | Lets the Istio gateway call v2 (zero-trust baseline denies it otherwise) |
| `virtualservice-canary.yaml` | Weighted route v1/v2 (replaces the normal VirtualService while the canary runs) |

## 1. Deploy v2 next to v1 (from the repo root)

```powershell
helm upgrade --install customer-portal-v2 ./helm/ecommerce -f ./helm/ecommerce/values-customer-portal.yaml -f ./k8s/docker-desktop/canary/customer-portal-v2-values.yaml
kubectl apply -f k8s/docker-desktop/canary/authorization-policy-v2.yaml
kubectl get pods
```

## 2. Start the canary (90/10)

```powershell
kubectl apply -f k8s/docker-desktop/canary/virtualservice-canary.yaml
```

Refresh http://localhost several times: about 1 in 10 page loads shows the green v2 banner.
Kiali (`istioctl dashboard kiali`) shows the split in the service graph.

## 3. Move traffic

Change the two `weight` values in `virtualservice-canary.yaml` (always adding up to 100), commit through a PR,
then apply the file again: 90/10 -> 50/50 -> 0/100.

## 4a. Promote v2 (v2 becomes the normal version)

1. Merge the customer-portal bot PR that carries the v2 tag: Argo CD updates v1 to the v2 image.
2. Restore the normal route: `kubectl apply -f k8s/docker-desktop/istio/virtualservice.yaml`
3. Clean up (step 5).

## 4b. Roll back (v2 has a problem)

1. Set the weights to v1 `100` / v2 `0` and apply: all users are back on v1 immediately.
2. Restore the normal route: `kubectl apply -f k8s/docker-desktop/istio/virtualservice.yaml`
3. Close the v2 bot PR without merging, then clean up (step 5).

## 5. Clean up

```powershell
helm uninstall customer-portal-v2
kubectl delete -f k8s/docker-desktop/canary/authorization-policy-v2.yaml
```

Interview line: "Istio splits traffic per request with VirtualService weights, independent of replica counts.
I move traffic in steps while watching error rate and latency, and roll back by setting the canary weight to 0.
Argo Rollouts can automate the same steps with Prometheus analysis."
