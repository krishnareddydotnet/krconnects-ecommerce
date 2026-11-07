# Constraints (where and how a template is enforced)

One file per constraint: which template (`kind`), which resources and namespaces it matches, its parameters,
and `enforcementAction` (`dryrun` = report only, `warn` = warning to the user, `deny` = block).

Empty for now: constraints are added here one by one during the hands-on (start every new one in `dryrun`).
Apply after the templates: `kubectl apply -f k8s/docker-desktop/gatekeeper/constraints/`.
