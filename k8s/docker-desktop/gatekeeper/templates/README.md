# ConstraintTemplates (policy logic)

One file per template: the **Rego** rule plus the parameters it accepts. Applying a template creates a new
Kubernetes resource type (its `kind`, e.g. `K8sRequiredLabels`) that Constraints in `../constraints/` use.

Empty for now: templates are added here one by one during the hands-on.
Apply templates BEFORE their constraints: `kubectl apply -f k8s/docker-desktop/gatekeeper/templates/`.
