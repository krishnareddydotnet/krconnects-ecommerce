# Archive: Docker Desktop (Docker Hub + Helm) service pipelines

These 7 pipelines (`<service>-ci.yml`) build each service, push the image to Docker Hub (or ACR, with the repository
variable `IMAGE_REGISTRY`) and update `helm/ecommerce/values-<service>.yaml` through a bot PR. The customer-portal bot PR
also updates both Rollouts (`k8s/docker-desktop/istio/scenarios/canary|blue-green/customer-portal/rollout.yaml`).

**Archived**: Docker Desktop now uses plain YAML (`k8s/docker-desktop/apps/`) and the pipelines in
`.github/workflows-archive-docker-raw/`. The Helm chart `helm/ecommerce` is kept for reference; to use these pipelines
again, also point the Argo CD Applications back to `path: helm/ecommerce` with `helm.valueFiles: [values-<service>.yaml]`.

## Activate this set (PowerShell 7, from the repo root)

1. Save the ACTIVE set back to its archive folder (keeps any change made in `.github/workflows/`). Run the line for
   the set that is active now (look at the file names in `.github/workflows/`):

```powershell
Copy-Item .github/workflows/docker-*-ci.yml .github/workflows-archive-docker-raw/ -Force   # docker-<service>-ci.yml active
Copy-Item .github/workflows/aks-*-ci.yml .github/workflows-archive-aks/ -Force             # aks-<service>-ci.yml active
Copy-Item .github/workflows/*-ci.yml .github/workflows-archive-docker-helm/ -Exclude terraform-ci.yml,docker-*,aks-* -Force   # <service>-ci.yml active
```

2. Remove all service pipelines from the active folder (shared workflows stay):

```powershell
Remove-Item .github/workflows/*-ci.yml -Exclude terraform-ci.yml
```

3. Activate the Docker Desktop Helm pipelines:

```powershell
Copy-Item .github/workflows-archive-docker-helm/*-ci.yml .github/workflows/
```

## Rules (all three archive folders)

| Folder | Pipelines | Registry | Bot PR updates |
|---|---|---|---|
| `.github/workflows-archive-docker-raw/` | `docker-<service>-ci.yml` (6) | Docker Hub | `k8s/docker-desktop/apps/<service>.yaml` (+ both customer-portal Rollouts) |
| `.github/workflows-archive-docker-helm/` | `<service>-ci.yml` (7) | Docker Hub (or ACR with `IMAGE_REGISTRY`) | `helm/ecommerce/values-<service>.yaml` (+ both customer-portal Rollouts) |
| `.github/workflows-archive-aks/` | `aks-<service>-ci.yml` (6) | ACR | `k8s/aks/apps/<service>.yaml` |

- GitHub only runs files directly in `.github/workflows/`, so nothing in an archive folder runs.
- Only ONE set may be active: all sets watch the same service folders, so two active sets would build every change
  twice and open two bot PRs.
- Each archive folder always keeps a copy of its set (also of the active one), so switching is copy-based.
  Before every switch, copy the active set back to its archive folder first, so no change is lost.
- Shared workflows (secret-scan, codeql, snyk-security, terraform-ci, checkouttest) stay only in `.github/workflows/`.
  `terraform-ci.yml` also ends in `-ci.yml`, so the commands exclude it.
- Then: branch -> commit -> PR -> squash merge. After the merge each activated pipeline runs once (its own workflow
  file changed) and opens a bot PR with a new image.
