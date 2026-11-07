# Constraints (where and how a template is enforced)

One file per constraint: which template (`kind`), which resources and namespaces it matches, its parameters,
and `enforcementAction` (`dryrun` = report only, `warn` = warning to the user, `deny` = block).

6 constraints, all `dryrun` and namespace `gk-test` only (start every new one in `dryrun`). The policy table is in `../README.md` (section 3).
Apply after the templates: `kubectl apply -f k8s/docker-desktop/gatekeeper/constraints/`.
