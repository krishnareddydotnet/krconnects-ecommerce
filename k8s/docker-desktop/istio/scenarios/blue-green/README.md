# blue-green

Blue-green deployments with Argo Rollouts. One folder per service:

| Folder | Service |
|---|---|
| `customer-portal/` | customer-portal (React UI, nginx) |

Prerequisite: Argo Rollouts controller installed (`docs/docker-desktop-setup.md`, step B7).

## customer-portal

### How it works

| | Blue (current) | Green (new) |
|---|---|---|
| Pods | full size (2) | full size (2), started next to blue |
| Service | `customer-portal-active` (users, through the gateway) | `customer-portal-preview` (testers, port-forward) |

A new image starts GREEN at full size. Users stay on blue until you promote; then the active Service switches
to green in one step (100%, no percentages, so no SPA mixed-file problem). Blue keeps running for
`scaleDownDelaySeconds` (60s) for an instant rollback, then scales down.
Rollouts switches versions by changing the Services' hidden `rollouts-pod-template-hash` selector;
the VirtualService always points at `customer-portal-active` and never changes.

| File | Objects |
|---|---|
| `customer-portal/rollout.yaml` | ServiceAccount, Rollout (`strategy.blueGreen`), Services `customer-portal-active` and `customer-portal-preview` |
| `customer-portal/virtualservice.yaml` | VirtualService `krconnects-virtualservice` -> `customer-portal-active` |
| `../../../argocd/bluegreen-customer-portal.yaml` | Argo CD app `customer-portal-bluegreen` |

### Start the scenario (from the canary scenario)

Only one owner of customer-portal at a time: delete the canary app (cascade removes its Rollout, Services,
ServiceAccount and VirtualService), then create the blue-green app straight away (the shop is down in between):

```powershell
kubectl delete application customer-portal-canary -n argocd
kubectl apply -f k8s/docker-desktop/argocd/bluegreen-customer-portal.yaml
kubectl get rollout customer-portal
kubectl get pods -l app.kubernetes.io/instance=customer-portal
```

The first sync has no older version: the image becomes blue (active) directly. Test https://localhost.

### Release a new version

The customer-portal pipeline's bot PR updates the CANARY Rollout only. For blue-green, change the `image:` line
in `customer-portal/rollout.yaml` (tag@digest from the bot PR), commit through a PR, merge, then REFRESH
`customer-portal-bluegreen` in Argo CD.

1. Green starts at full size; the app shows Suspended (waiting for promote). Users still see blue.
2. Test green only:

```powershell
kubectl port-forward service/customer-portal-preview 8080:8080      # http://127.0.0.1:8080 = green
kubectl get svc customer-portal-active  -o jsonpath="{.spec.selector}"   # hash of blue
kubectl get svc customer-portal-preview -o jsonpath="{.spec.selector}"   # hash of green
```

3. Promote: Argo CD UI -> Rollout `customer-portal` -> three dots -> Promote-Full (or `kubectl patch rollout
   customer-portal --subresource status --type merge -p '{"status":{"promoteFull":true}}'`).
   The active Service switches to green; https://localhost shows the new version on the next refresh.
4. Blue scales down after 60s.

Rollback:

- Before promote: Abort (three dots -> Abort): green is removed, users never saw it.
- After promote: in GitOps, `git revert` the image commit and merge; the old image becomes green and you promote it.
  Within the 60s window the old pods are still running, so the switch back is immediate.

### Back to the canary scenario

```powershell
kubectl delete application customer-portal-bluegreen -n argocd
kubectl apply -f k8s/docker-desktop/argocd/canary-customer-portal.yaml
```
