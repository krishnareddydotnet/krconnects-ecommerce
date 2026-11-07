# ConstraintTemplates (policy logic)

One file per template: the **Rego** rule plus the parameters it accepts. Applying a template creates a new
Kubernetes resource type (its `kind`, e.g. `K8sRequiredLabels`) that Constraints in `../constraints/` use.

6 templates, simplified from the Gatekeeper library with comments. The policy table is in `../README.md` (section 3).
Apply templates BEFORE their constraints: `kubectl apply -f k8s/docker-desktop/gatekeeper/templates/`.
