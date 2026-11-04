# Archive: Docker Desktop (Docker Hub + Helm) service pipelines

These 7 pipelines (`<service>-ci.yml`) build each service, push the image to Docker Hub (or ACR, with the repository
variable `IMAGE_REGISTRY`) and update `helm/ecommerce/values-<service>.yaml` through a bot PR. The customer-portal bot PR
also updates both Rollouts (`k8s/docker-desktop/istio/scenarios/canary|blue-green/customer-portal/rollout.yaml`).

GitHub only runs files directly in `.github/workflows/`, so nothing in this folder runs.
Same rules as in `.github/workflows-archive-aks/README.md` (only `*-ci.yml` archived, one set active, copy back first).

## Switch AKS -> Docker Desktop (PowerShell 7, from the repo root)

1. Save the active AKS pipelines (keeps any change made in `.github/workflows/`):

```powershell
Copy-Item .github/workflows/aks-*-ci.yml .github/workflows-archive-aks/ -Force
```

2. Remove them from the active folder:

```powershell
Remove-Item .github/workflows/aks-*-ci.yml
```

3. Activate the Docker Desktop pipelines:

```powershell
Copy-Item .github/workflows-archive-dockerdesktop/*-ci.yml .github/workflows/
```

Then branch -> commit -> PR -> squash merge. After the merge each pipeline runs once (its own workflow file changed)
and opens a bot PR with the new image.
