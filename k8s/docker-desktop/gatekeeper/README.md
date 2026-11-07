# OPA Gatekeeper (Docker Desktop)

Policy as code for the local cluster: hands-on with OPA, Rego and admission control before using it on AKS,
where the Azure Policy add-on installs and manages Gatekeeper for you.

## 1. What it is (basics)

| Piece | What it does |
|---|---|
| Admission controller | Checkpoint in the API server, after login and RBAC, before an object is saved. Mutating = changes it, validating = allows or denies it |
| OPA | General policy engine: input (JSON) + policy (Rego) -> decision. Runs **inside** the Gatekeeper pods (no separate pod) |
| Rego | The language OPA policies are written in |
| Gatekeeper | Built on OPA: the Kubernetes **validating admission webhook**, plus audit of existing objects |
| ConstraintTemplate | The rule logic (Rego) and its parameters. Creates a new resource type (kind) |
| Constraint | Uses a template: which resources/namespaces, parameter values, `enforcementAction` |

Flow: `kubectl apply` -> API server (login, RBAC, mutating webhooks such as Istio) -> **Gatekeeper webhook**
(`gatekeeper-controller-manager`, OPA evaluates the Rego) -> allow or deny -> saved to etcd.
The `gatekeeper-audit` pod checks existing objects on a timer and writes violations into each Constraint's status.

| `enforcementAction` | Effect |
|---|---|
| `dryrun` | Allowed; reported by audit (same idea as Azure Policy **Audit**) |
| `warn` | Allowed; kubectl shows a warning |
| `deny` | Blocked with the policy message (Azure Policy **Deny**) |

Same idea on AKS: Azure Policy definition = ConstraintTemplate, assignment = Constraint, effect Audit/Deny = `dryrun`/`deny`.

### Rego in 6 ideas (enough to read the templates)

| Rego | Meaning |
|---|---|
| `package k8srequiredlabels` | Name of the policy |
| `input.review.object` | The object being applied (the pod YAML as JSON) |
| `input.parameters` | Values from the Constraint (e.g. `labels: ["team"]`) |
| `violation[{"msg": msg}] { ... }` | A rule: if **every** line inside is true, the object breaks the policy and `msg` is the error |
| `not x` | True when `x` is missing or false |
| `list[_]` | Loop over every item (e.g. every container) |

Practice without a cluster: Rego Playground, https://play.openpolicyagent.org.

## 2. Folder

| Path | What |
|---|---|
| `templates/` | 6 ConstraintTemplates (Rego), simplified from the Gatekeeper library (https://github.com/open-policy-agent/gatekeeper-library) |
| `constraints/` | 6 Constraints: `dryrun`, namespace `gk-test` only |
| `tests/` | 1 good pod (passes all 6) + 6 bad pods (each breaks exactly one policy) |
| `monitoring/gatekeeper-podmonitor.yaml` | Prometheus scrapes Gatekeeper metrics (port 8888) |

## 3. Policies

| # | Policy (problem it stops) | Template (kind) | Constraint | Parameters | Test pod |
|---|---|---|---|---|---|
| 1 | Required label `team` (no owner) | `k8srequiredlabels.yaml` (K8sRequiredLabels) | `pods-must-have-team-label` | `labels: ["team"]` | `bad-1-no-team-label.yaml` |
| 2 | Allowed registries (unscanned/unsigned images) | `k8sallowedrepos.yaml` (K8sAllowedRepos) | `images-from-allowed-repos` | `docker.io/ckreddy3030/`, `docker.io/istio/` | `bad-2-not-allowed-repo.yaml` |
| 3 | No privileged containers (root on the node) | `k8sprivilegedcontainer.yaml` (K8sPSPPrivilegedContainer) | `no-privileged-containers` | none | `bad-3-privileged.yaml` |
| 4 | Run as non-root (UID 0) | `k8srunasnonroot.yaml` (K8sRunAsNonRoot) | `containers-must-run-as-non-root` | `exemptContainers: ["istio-init"]` | `bad-4-runs-as-root.yaml` |
| 5 | CPU and memory requests (unfair scheduling, broken HPA) | `k8srequiredresources.yaml` (K8sRequiredResources) | `containers-must-have-requests` | `requests: ["cpu", "memory"]` | `bad-5-no-requests.yaml` |
| 6 | No `:latest` or missing tag (unknown version) | `k8sdisallowedtags.yaml` (K8sDisallowedTags) | `no-latest-image-tag` | `tags: ["latest"]` | `bad-6-latest-tag.yaml` |

Why `docker.io/istio/` and `istio-init`: in an Istio-injected namespace (like `default`) Istio's mutating webhook adds
the `istio-proxy` and `istio-init` containers **before** Gatekeeper checks the pod, so Gatekeeper sees them too.
`gk-test` is not injected, so they do not appear there.

On AKS the same policies are Azure built-ins (see the `krconnects-policy` repo), with ACR (`krconnectspractice.azurecr.io/`) as the allowed registry.

## 4. Install Gatekeeper (Helm)

| Helm release | Chart (version) | Namespace |
|---|---|---|
| gatekeeper | gatekeeper/gatekeeper (3.23.1) | gatekeeper-system |

Chart defaults are used (no values file). Run from the repo root in PowerShell.

1. Make sure kubectl points at Docker Desktop (not AKS):

```powershell
kubectl config current-context                      # must be docker-desktop
kubectl config use-context docker-desktop           # only if it shows another cluster
```

2. Install:

```powershell
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm repo update
helm install gatekeeper gatekeeper/gatekeeper --namespace gatekeeper-system --create-namespace --version 3.23.1
```

3. Verify:

```powershell
helm list -n gatekeeper-system                                  # gatekeeper, STATUS deployed
kubectl get pods -n gatekeeper-system                           # gatekeeper-controller-manager-... (webhook) and gatekeeper-audit-... Running
kubectl get validatingwebhookconfiguration                      # gatekeeper-validating-webhook-configuration
kubectl get crd | Select-String gatekeeper                      # constrainttemplates, constraints, config ...
kubectl get constrainttemplates                                 # empty until the first template is applied
```

Nothing is enforced until a ConstraintTemplate and a Constraint exist.

## 5. Hands-on: test the 6 policies

### 5.1 Apply

```powershell
kubectl create namespace gk-test
kubectl apply -f k8s/docker-desktop/gatekeeper/templates/
kubectl get constrainttemplates                                 # 6 templates; wait ~10 s so Gatekeeper creates the new kinds
kubectl apply -f k8s/docker-desktop/gatekeeper/constraints/
kubectl get constraints                                         # 6 constraints, ENFORCEMENT-ACTION dryrun
```

If applying a constraint says `no matches for kind "K8s..."`, the template was not ready yet: wait a few seconds and apply again.

### 5.2 dryrun: everything is allowed, audit reports it

```powershell
kubectl apply -f k8s/docker-desktop/gatekeeper/tests/           # all 7 pods are created
```

Wait about 1 minute (audit runs every 60 s by default), then:

```powershell
kubectl get constraints                                         # TOTAL-VIOLATIONS: 1 per constraint (2 for requests: cpu + memory)
kubectl get k8srequiredlabels pods-must-have-team-label -o yaml # status.violations: which pod, which message
```

### 5.3 deny: bad pods are blocked

Change `enforcementAction: dryrun` to `deny` in the 6 constraint files (do not commit this change), then:

```powershell
kubectl delete -f k8s/docker-desktop/gatekeeper/tests/
kubectl apply -f k8s/docker-desktop/gatekeeper/constraints/
kubectl apply -f k8s/docker-desktop/gatekeeper/tests/
```

Expected: `pod/good-pod created`, and each bad pod fails with
`admission webhook "validation.gatekeeper.sh" denied the request: [<constraint>] <message>`, for example
`[pods-must-have-team-label] missing required label: team`.

Pods created by a Deployment are checked the same way: the Deployment is accepted, but its ReplicaSet cannot create
the pods; the denial shows in `kubectl describe replicaset <name>`.

### 5.4 Clean up

```powershell
kubectl delete namespace gk-test
git checkout -- k8s/docker-desktop/gatekeeper/constraints/      # back to dryrun
```

Keep the templates and constraints (they only match `gk-test`), or remove them:

```powershell
kubectl delete -f k8s/docker-desktop/gatekeeper/constraints/
kubectl delete -f k8s/docker-desktop/gatekeeper/templates/
```

### 5.5 Next step: the real apps (dryrun only)

Add `default` to `match.namespaces` of a constraint (keep `dryrun`) and check its violations: existing pods are never
removed, but with `deny` every NEW pod (new release, restart, HPA scale-up) would be blocked. Fix the manifests first
(e.g. add `team: krconnects` to `k8s/docker-desktop/apps/*.yaml`), then switch to `deny`.

## 6. Monitoring (Prometheus + Grafana)

Needs kube-prometheus-stack (setup guide B6).

```powershell
kubectl apply -f k8s/docker-desktop/gatekeeper/monitoring/gatekeeper-podmonitor.yaml
```

In https://grafana.localhost -> Explore -> Prometheus, for example `sum(gatekeeper_violations) by (enforcement_action)`.

| Metric | Shows |
|---|---|
| `gatekeeper_violations` | Violations found by audit, per enforcement action |
| `gatekeeper_validation_request_count` | Admission requests checked (allowed / denied) |
| `gatekeeper_validation_request_duration_seconds` | Time the policy check takes (webhook latency) |
| `gatekeeper_constraints`, `gatekeeper_constraint_templates` | How many policies are installed |
| `gatekeeper_audit_last_run_time` | When audit last ran |

No built-in UI: use kubectl, Grafana, or the Rego Playground.

## 7. Useful commands

```powershell
kubectl get constrainttemplates                                 # installed rules
kubectl get constraints                                         # all constraints: ENFORCEMENT-ACTION and TOTAL-VIOLATIONS
kubectl get <constraint-kind> <name> -o yaml                    # status.violations: which objects break the rule
kubectl logs -n gatekeeper-system deploy/gatekeeper-controller-manager   # webhook logs
```

## 8. Uninstall Gatekeeper

```powershell
kubectl delete -f k8s/docker-desktop/gatekeeper/constraints/
kubectl delete -f k8s/docker-desktop/gatekeeper/templates/
kubectl delete -f k8s/docker-desktop/gatekeeper/monitoring/gatekeeper-podmonitor.yaml
helm uninstall gatekeeper -n gatekeeper-system
```

The Gatekeeper CRDs stay after `helm uninstall`: `kubectl get crd | Select-String gatekeeper`, then delete them if not needed.

## 9. Interview points

- OPA is the policy engine; Gatekeeper is built on it as a Kubernetes validating admission webhook, and its audit pod reports existing violations.
- A ConstraintTemplate holds the Rego logic, a Constraint applies it with parameters and scope; roll out `dryrun` -> `deny`, test namespace first.
- Templates come from the Gatekeeper library (custom Rego only for company rules); the same policies on AKS are Azure Policy built-ins, managed in Terraform.
- Kyverno is the YAML-based alternative (also mutate, generate and Cosign `verifyImages`).
