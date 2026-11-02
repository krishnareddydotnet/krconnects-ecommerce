# Archived: AKS (ACR) service pipelines

These 6 workflows build each service, push the image to Azure Container Registry (`krconnectspractice.azurecr.io`)
and update the image line in `k8s/aks/apps/<service>.yaml` through a bot PR.

They are **archived while the Docker Hub pipelines are active** (hands-on on Docker Desktop).
Only one set may be active, because both watch the same service folders: two active pipelines would build and push
every change twice and open two bot PRs. GitHub only runs workflows in `.github/workflows/`, so nothing here runs.

## Switch back to AKS

Reverse the moves (from the repo root), commit and merge:

```bash
for s in data-api auth-api catalog-api order-api customer-portal admin-portal notification-service; do git mv .github/workflows/$s-ci.yml .github/workflows-archive/dockerhub/; done
```

```bash
for s in data-api auth-api catalog-api order-api customer-portal admin-portal; do git mv .github/workflows-archive/aks/aks-$s-ci.yml .github/workflows/; done
```

After the merge each AKS pipeline runs once (its own workflow file changed) and opens a bot PR with a new image.
