# OPA Gatekeeper (Docker Desktop)

Policy as code for the local cluster: hands-on with OPA, Rego and admission control before using it on AKS,
where the Azure Policy add-on installs and manages Gatekeeper for you.

## What it is (basics)

| Piece | What it does |
|---|---|
| Admission controller | Checkpoint in the API server, after login and RBAC, before an object is saved. Mutating = changes it, validating = allows or denies it |
| OPA | General policy engine: input (JSON) + policy (Rego) -> decision. Runs **inside** the Gatekeeper pods (no separate pod) |
| Rego | The language OPA policies are written in |
| Gatekeeper | OPA as a Kubernetes **validating admission webhook**, plus audit of existing objects |
| ConstraintTemplate | The rule logic (Rego) and its parameters. Creates a new resource type |
| Constraint | Uses a template: which resources/namespaces, parameter values, `enforcementAction` (`dryrun`, `warn`, `deny`) |

Flow: `kubectl apply` -> API server -> Gatekeeper webhook (`gatekeeper-controller-manager`, OPA evaluates the Rego)
-> allow or deny. The `gatekeeper-audit` pod checks existing objects on a timer and writes violations into each Constraint's status.

Same idea on AKS: Azure Policy definition = ConstraintTemplate, assignment = Constraint, effect Audit/Deny = `dryrun`/`deny`.

## Folder

| Path | What |
|---|---|
| `monitoring/gatekeeper-podmonitor.yaml` | Prometheus scrapes Gatekeeper metrics (port 8888) |
| `templates/` | ConstraintTemplates (Rego), added during the hands-on |
| `constraints/` | Constraints, added during the hands-on (start in `dryrun`) |

## Install (Helm)

| Helm release | Chart (version) | Namespace |
|---|---|---|
| gatekeeper | gatekeeper/gatekeeper (3.23.1) | gatekeeper-system |

Chart defaults are used (no values file).

```powershell
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm repo update
helm install gatekeeper gatekeeper/gatekeeper --namespace gatekeeper-system --create-namespace --version 3.23.1
```

## Verify

```powershell
kubectl get pods -n gatekeeper-system                           # gatekeeper-controller-manager-... and gatekeeper-audit-... Running
kubectl get validatingwebhookconfiguration                      # gatekeeper-validating-webhook-configuration
kubectl get crd | Select-String gatekeeper                      # constrainttemplates, constraints, config ...
kubectl get constrainttemplates                                 # empty until the first template is applied
```

Nothing is enforced until a ConstraintTemplate and a Constraint exist.

## Monitoring (Prometheus + Grafana)

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

No built-in UI: use kubectl, Grafana, or the Rego Playground (https://play.openpolicyagent.org) to learn Rego.

## Useful commands

```powershell
kubectl get constrainttemplates                                 # installed rules
kubectl get constraints                                         # all constraints: ENFORCEMENT-ACTION and TOTAL-VIOLATIONS
kubectl get <constraint-kind> <name> -o yaml                    # status.violations: which objects break the rule
```

## Uninstall

```powershell
kubectl delete -f k8s/docker-desktop/gatekeeper/constraints/    # once the folder holds constraints
kubectl delete -f k8s/docker-desktop/gatekeeper/templates/      # once the folder holds templates
kubectl delete -f k8s/docker-desktop/gatekeeper/monitoring/gatekeeper-podmonitor.yaml
helm uninstall gatekeeper -n gatekeeper-system
```

The Gatekeeper CRDs stay after `helm uninstall`: `kubectl get crd | Select-String gatekeeper`, then delete them if not needed.

## Interview points

- Gatekeeper is OPA running as a Kubernetes validating admission webhook; the audit pod reports existing violations.
- A ConstraintTemplate holds the Rego logic, a Constraint applies it with parameters and scope; roll out `dryrun` -> `deny`.
- The same Rego can run in CI with conftest (shift-left); on AKS the Azure Policy add-on manages Gatekeeper from Azure Policy.
