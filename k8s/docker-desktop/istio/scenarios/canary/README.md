# canary

Canary deployments with Argo Rollouts + Istio weights. One folder per service:

| Folder | Service | Steps |
|---|---|---|
| `customer-portal/` | customer-portal (React UI, nginx) | 10% -> 25% -> 50% -> 75% -> 100%, manual promote at each step |

Prerequisite: Argo Rollouts controller installed (`docs/docker-desktop-setup.md`, step B7).

## customer-portal

### GitOps flow

```
merge code to main (customer-portal/**)
  -> customer-portal pipeline builds, scans, signs and pushes the image
  -> bot PR updates helm/ecommerce/values-customer-portal.yaml AND customer-portal/rollout.yaml (new tag@digest)
  -> merge the bot PR
  -> Argo CD (app customer-portal-canary) syncs the new image into the Rollout
  -> Argo Rollouts starts the canary by itself: 10% -> pause
  -> promote / abort in the Argo CD UI: app customer-portal-canary -> Rollout resource -> three dots (⋮)
     -> Promote (next step) / Promote-Full (100% now) / Abort (back to stable)
```

No manual `kubectl apply` and no copying of tag@digest: Git is the only source of the image.
The Argo CD app is defined in `k8s/docker-desktop/argocd/canary-customer-portal.yaml`.

Why `ignoreDifferences` + `RespectIgnoreDifferences=true` in that app: Argo Rollouts changes the VirtualService
weights in the cluster during a release, while Git keeps 100/0. `ignoreDifferences` stops Argo CD from reporting
that as OutOfSync, and `RespectIgnoreDifferences` stops a sync (self-heal) from writing 100/0 back mid-canary.

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

### Start the scenario (with Argo CD)

1. Remove the Helm-managed customer-portal (Argo CD would put the Deployment back, and both apps own
   `sa/customer-portal`): Argo CD UI -> customer-portal -> DELETE (propagation Foreground), or

```powershell
kubectl delete application customer-portal -n argocd
kubectl get deployment customer-portal          # NotFound
```

   This also deletes the ServiceAccount `customer-portal`, so do step 2 straight away.

2. Create the Argo CD app for the canary (it applies the canary files and recreates the ServiceAccount).
   This replaces the old manual `kubectl apply -f .../canary/customer-portal/`:

```powershell
kubectl apply -f k8s/docker-desktop/argocd/canary-customer-portal.yaml
kubectl get application customer-portal-canary -n argocd     # Synced, Healthy
kubectl get rollout customer-portal
kubectl get pods -l app.kubernetes.io/instance=customer-portal   # only the Rollout pods
kubectl get sa customer-portal
```

3. Test https://localhost (browse, log in, add to cart: proves the backends still accept the ServiceAccount).

The first apply does not run a canary (no older version): the image goes straight to 100% as stable.

VS Code may underline Rollout fields in red: the editor does not know the Rollout CRD. Check with the cluster:
`kubectl apply -f k8s/docker-desktop/istio/scenarios/canary/customer-portal/ --dry-run=server`.

### Run a canary

Normally: merge the pipeline's bot PR (see GitOps flow). Argo CD syncs the new image and the canary starts.
Argo CD polls Git about every 3 minutes; click REFRESH on the app to sync at once.

Watch (no plugin needed):

```powershell
kubectl get rollout customer-portal                                                           # status, step
kubectl get rollout customer-portal -o jsonpath="{.status.currentStepIndex}"                  # step 0..7
kubectl get virtualservice krconnects-virtualservice -o jsonpath="{.spec.http[0].route[*].weight}"   # e.g. 90 10
kubectl get pods -l app.kubernetes.io/instance=customer-portal
```

Kiali (https://kiali.localhost, Traffic Graph, namespace default) shows the split live.

Promote / abort in the Argo CD UI (app customer-portal-canary -> Rollout resource -> ⋮ -> Promote / Promote-Full / Abort).

Without the Argo CD UI, promote / abort with kubectl (these set fields in the Rollout's status, exactly what the
`kubectl argo rollouts` plugin and the Argo CD buttons do):

```powershell
# next step (leave the current pause)
kubectl patch rollout customer-portal --subresource status --type merge -p '{"status":{"pauseConditions":null}}'

# skip all remaining steps: new version 100% now
kubectl patch rollout customer-portal --subresource status --type merge -p '{"status":{"promoteFull":true}}'

# abort: all traffic back to the stable version (status Degraded)
kubectl patch rollout customer-portal --subresource status --type merge -p '{"status":{"abort":true}}'
```

After an abort, Git still has the new image (Argo CD shows the Rollout Degraded). Roll Git back with a
`git revert` of the bot PR's commit (PR to main); Argo CD syncs the stable image and the Rollout is healthy again.
Never fix it with `kubectl apply`: self-heal would put Git's image back.

### Back to basic routing (end of the scenario)

Delete the canary app WITH its resources (cascade: Rollout, Services, ServiceAccount, VirtualService), then
restore the basic shop route and the Helm app:

```powershell
kubectl delete application customer-portal-canary -n argocd --cascade=foreground
kubectl apply  -f k8s/docker-desktop/istio/scenarios/basic/virtualservice.yaml
kubectl apply  -f k8s/docker-desktop/argocd/applications.yaml      # recreates the customer-portal Helm app
```

(Argo CD UI: customer-portal-canary -> DELETE, propagation Foreground, does the same as the first command.)
Argo CD then recreates the Helm Deployment, Service and ServiceAccount `customer-portal`.
Do not re-apply `applications.yaml` WHILE the canary app exists: the Helm Deployment would run next to the Rollout.

Apply only one scenario at a time.

## Backlog

- AnalysisTemplate: Prometheus success-rate check (istio_requests_total) so Rollouts promotes or aborts automatically instead of a manual Resume at each pause.
