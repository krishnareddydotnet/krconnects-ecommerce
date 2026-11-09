# Switching deployment scenarios (customer-portal)

customer-portal can run in exactly ONE of three ways at a time. Each way is owned by one Argo CD Application:

| Scenario | Argo CD app | Defined in | Workload | Shop route (`krconnects-virtualservice`) goes to | Release style |
|---|---|---|---|---|---|
| basic (rolling update) | `customer-portal` (plain YAML `k8s/docker-desktop/apps/customer-portal.yaml`) | `k8s/docker-desktop/argocd/applications.yaml` | Deployment | `customer-portal` | Kubernetes rolling update: new pods replace old ones gradually |
| canary | `customer-portal-canary` | `k8s/docker-desktop/argocd/canary-customer-portal.yaml` | Rollout (`canary`) | `customer-portal-stable` / `customer-portal-canary` with weights | 10% -> 25% -> 50% -> 75% -> 100%, Resume at each pause |
| blue-green | `customer-portal-bluegreen` | `k8s/docker-desktop/argocd/bluegreen-customer-portal.yaml` | Rollout (`blueGreen`) | `customer-portal-active` | new version at full size on `customer-portal-preview`, Promote-Full switches 100% at once |

Why only one at a time: all three create the ServiceAccount `customer-portal` (the backends only accept
`cluster.local/ns/default/sa/customer-portal`) and the shop route. Two owners would fight over them, and the basic
Deployment would run next to a Rollout.

The customer-portal pipeline's bot PR (`docker-customer-portal-ci.yml`) updates all three (`k8s/docker-desktop/apps/customer-portal.yaml`,
canary `rollout.yaml`, blue-green `rollout.yaml`); only the scenario whose Argo CD app exists is deployed.

Expect about 30-60 seconds of downtime on https://localhost during a switch: the old owner's objects are deleted
before the new owner creates its own.

## Rule: delete an Argo CD app WITH its resources

These Applications have no `resources-finalizer`, so a plain `kubectl delete application` removes only the
Application and LEAVES its Deployment/Rollout, Services and VirtualService running (orphaned).
Delete them together in one of two ways:

- Argo CD UI: open the app -> DELETE -> type the name -> Propagation Policy **Foreground** -> OK.
- PowerShell: add the finalizer, then delete (replace `<app>`):

```powershell
kubectl patch application <app> -n argocd --type merge -p '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}'
kubectl delete application <app> -n argocd
```

The finalizer tells Argo CD: before the Application disappears, delete every resource it created.

## Which scenario is active now?

```powershell
kubectl get application -n argocd                     # customer-portal / customer-portal-canary / customer-portal-bluegreen
kubectl get deployment customer-portal                # exists = basic
kubectl get rollout customer-portal -o jsonpath="{.spec.strategy}"   # canary or blueGreen
kubectl get virtualservice krconnects-virtualservice -o jsonpath="{.spec.http[-1:].route[*].destination.host}"
kubectl get svc -l app.kubernetes.io/instance=customer-portal        # Services of the scenario
```

## basic -> canary

```powershell
kubectl patch application customer-portal -n argocd --type merge -p '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}'
kubectl delete application customer-portal -n argocd
kubectl get deployment customer-portal                # NotFound
kubectl apply -f k8s/docker-desktop/argocd/canary-customer-portal.yaml
```

Removed: Deployment, Service, ServiceAccount, HPA, PDB and NetworkPolicy `customer-portal` (basic app). Created: Rollout (canary), Services
`customer-portal-stable` and `customer-portal-canary`, ServiceAccount, VirtualService with weights 100/0.

## basic -> blue-green

```powershell
kubectl patch application customer-portal -n argocd --type merge -p '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}'
kubectl delete application customer-portal -n argocd
kubectl get deployment customer-portal                # NotFound
kubectl apply -f k8s/docker-desktop/argocd/bluegreen-customer-portal.yaml
```

Created: Rollout (blueGreen), Services `customer-portal-active` and `customer-portal-preview`, ServiceAccount,
VirtualService to `customer-portal-active`.

## canary -> blue-green

```powershell
kubectl patch application customer-portal-canary -n argocd --type merge -p '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}'
kubectl delete application customer-portal-canary -n argocd
kubectl get rollout customer-portal                   # NotFound
kubectl apply -f k8s/docker-desktop/argocd/bluegreen-customer-portal.yaml
```

## blue-green -> canary

```powershell
kubectl patch application customer-portal-bluegreen -n argocd --type merge -p '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}'
kubectl delete application customer-portal-bluegreen -n argocd
kubectl get rollout customer-portal                   # NotFound
kubectl apply -f k8s/docker-desktop/argocd/canary-customer-portal.yaml
```

## canary or blue-green -> basic (rolling update, plain YAML)

```powershell
# 1. remove the Rollout scenario (use customer-portal-bluegreen if that one is active)
kubectl patch application customer-portal-canary -n argocd --type merge -p '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}'
kubectl delete application customer-portal-canary -n argocd
kubectl get rollout customer-portal                   # NotFound

# 2. basic shop route (customer-portal Service) and the basic app
kubectl apply -f k8s/docker-desktop/istio/scenarios/basic/virtualservice.yaml
kubectl apply -f k8s/docker-desktop/argocd/applications.yaml   # recreates the app customer-portal (the other 5 apps are unchanged)
kubectl get deployment customer-portal
```

The deleted scenario app also removed `krconnects-virtualservice`, so the basic route must be applied again.

## After every switch: check

```powershell
kubectl get application -n argocd                                   # only ONE customer-portal* app
kubectl get pods -l app.kubernetes.io/instance=customer-portal -o custom-columns="POD:.metadata.name,IMAGE:.spec.containers[0].image"
kubectl get virtualservice krconnects-virtualservice -o jsonpath="{.spec.http[-1:].route[*].destination.host}"
kubectl get svc | Select-String customer-portal                     # no leftover Services of another scenario
```

Then https://localhost: browse, log in, add to cart (proves the backends accept the ServiceAccount).

Leftovers from an earlier plain `kubectl delete application` (without the finalizer) can be removed by hand,
e.g. canary Services left after switching to blue-green:

```powershell
kubectl delete svc customer-portal-stable customer-portal-canary
```

## The three strategies in one line each

- Rolling update (basic): new pods replace old pods a few at a time; no traffic control, rollback is another rollout.
- Canary: a small share of real traffic goes to the new version (Istio weights), increased step by step; abort sends
  everything back to stable.
- Blue-green: the new version runs at full size next to the old one; testers use the preview Service, then one
  switch moves 100% of users; the old version stays up briefly for an instant rollback.

Interview line: "Rolling update is our default. For risky releases we use Argo Rollouts: canary with Istio weights
for APIs, and blue-green for frontends, so users never get mixed versions. Each service has one Rollout manifest,
the pipeline's bot PR pins the new digest, merging is the approval, and Argo CD plus Rollouts do the release."

In real projects a service has ONE manifest per environment with one strategy; this repo keeps three only to
practise all of them.
