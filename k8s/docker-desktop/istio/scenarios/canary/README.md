# canary

Canary deployments with Argo Rollouts + Istio weights. One folder per service:

| Folder | Service | Steps |
|---|---|---|
| `customer-portal/` | customer-portal (React UI, nginx) | 10% -> 25% -> 50% -> 75% -> 100%, manual promote at each step |

Prerequisite: Argo Rollouts controller installed (`docs/docker-desktop-setup.md`, step B7).

## customer-portal

### Files

| File | Objects |
|---|---|
| `customer-portal/rollout.yaml` | ServiceAccount `customer-portal`, Rollout `customer-portal`, Services `customer-portal-stable` and `customer-portal-canary` |
| `customer-portal/virtualservice.yaml` | VirtualService `krconnects-virtualservice` (route `primary`: stable 100 / canary 0) |

What must stay the same as the Helm version, or other things break:

- ServiceAccount name `customer-portal`: auth-api, catalog-api and order-api only accept calls from
  `cluster.local/ns/default/sa/customer-portal`.
- Pod label `app.kubernetes.io/instance: customer-portal`: the customer-portal AuthorizationPolicy selects it.
- VirtualService name `krconnects-virtualservice`: same name as `../basic/virtualservice.yaml`, so applying the
  canary file REPLACES the basic shop route (Gateway and admin route stay).

How it works: the Rollout replaces the Deployment. Changing its image starts a canary: Rollouts starts pods of the
new version, points `customer-portal-canary` at them (and `customer-portal-stable` at the old ones; each Service
gets a hidden `rollouts-pod-template-hash` selector), and changes the VirtualService weights step by step.
Git keeps 100/0; the weights change only in the cluster during a release.

### Start the scenario

1. Remove the Helm-managed customer-portal (Argo CD would put the Deployment back):
   Argo CD UI -> customer-portal -> DELETE (propagation Foreground), or

```powershell
kubectl delete application customer-portal -n argocd
kubectl get deployment customer-portal          # NotFound
```

   This also deletes the ServiceAccount `customer-portal`, so do step 2 straight away.

2. Apply the canary files (recreates the ServiceAccount):

```powershell
kubectl apply -f k8s/docker-desktop/istio/scenarios/canary/customer-portal/
kubectl get rollout customer-portal
kubectl get pods -l app.kubernetes.io/instance=customer-portal   # only the Rollout pods
kubectl get sa customer-portal
```

3. Test https://localhost (browse, log in, add to cart: proves the backends still accept the ServiceAccount).

The first apply does not run a canary (no older version): the image goes straight to 100% as stable.

VS Code may underline Rollout fields in red: the editor does not know the Rollout CRD. Check with the cluster:
`kubectl apply -f k8s/docker-desktop/istio/scenarios/canary/customer-portal/ --dry-run=server`.

### Run a canary

Change the `image:` line in `rollout.yaml` to the new version (tag@digest from the pipeline's bot PR), then:

```powershell
kubectl apply -f k8s/docker-desktop/istio/scenarios/canary/customer-portal/rollout.yaml
```

Watch (no plugin needed):

```powershell
kubectl get rollout customer-portal                                                           # status, step
kubectl get rollout customer-portal -o jsonpath="{.status.currentStepIndex}"                  # step 0..7
kubectl get virtualservice krconnects-virtualservice -o jsonpath="{.spec.http[0].route[*].weight}"   # e.g. 90 10
kubectl get pods -l app.kubernetes.io/instance=customer-portal
```

Kiali (https://kiali.localhost, Traffic Graph, namespace default) shows the split live.

The Rollout is applied with kubectl, not by Argo CD, so it does not appear in the Argo CD UI.
Promote / abort with kubectl (these set fields in the Rollout's status, exactly what the
`kubectl argo rollouts` plugin does):

```powershell
# next step (leave the current pause)
kubectl patch rollout customer-portal --subresource status --type merge -p '{"status":{"pauseConditions":null}}'

# skip all remaining steps: new version 100% now
kubectl patch rollout customer-portal --subresource status --type merge -p '{"status":{"promoteFull":true}}'

# abort: all traffic back to the stable version (status Degraded)
kubectl patch rollout customer-portal --subresource status --type merge -p '{"status":{"abort":true}}'
```

After an abort, Git still has the new image: set `rollout.yaml` back to the stable image and apply
(in GitOps: git revert of the image commit).

### Back to basic routing (end of the scenario)

```powershell
kubectl delete -f k8s/docker-desktop/istio/scenarios/canary/customer-portal/rollout.yaml
kubectl apply  -f k8s/docker-desktop/istio/scenarios/basic/virtualservice.yaml
kubectl apply  -f k8s/docker-desktop/argocd/applications.yaml      # recreates the customer-portal Argo CD app
```

Argo CD then recreates the Helm Deployment, Service and ServiceAccount `customer-portal`.
Do not re-apply `applications.yaml` WHILE the canary scenario is active: it brings the Helm Deployment back
next to the Rollout.

Apply only one scenario at a time.
