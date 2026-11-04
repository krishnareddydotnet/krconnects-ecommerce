# Archive: AKS (ACR) service pipelines

These 6 pipelines (`aks-<service>-ci.yml`) build each service, push the image to Azure Container Registry
(`krconnectspractice.azurecr.io`) and update the image (tag + digest) in `k8s/aks/apps/<service>.yaml` through a bot PR.
notification-service has no AKS pipeline yet.

GitHub only runs files directly in `.github/workflows/`, so nothing in this folder runs.

## Rules

- Only the per-service pipelines (`*-ci.yml`) are archived. Shared workflows (secret-scan, codeql, snyk-security,
  terraform-ci, checkouttest) stay only in `.github/workflows/`. `terraform-ci.yml` also ends in `-ci.yml`,
  so the commands below use `-Exclude terraform-ci.yml`.
- Only one set may be active: both sets watch the same service folders, so two active sets would build every change
  twice and open two bot PRs.
- Before every switch, copy the active set back to its archive folder first, so no change is lost.

## Switch Docker Desktop -> AKS (PowerShell 7, from the repo root)

1. Save the active Docker Desktop pipelines (keeps any change made in `.github/workflows/`):

```powershell
Copy-Item .github/workflows/*-ci.yml .github/workflows-archive-dockerdesktop/ -Exclude terraform-ci.yml -Force
```

2. Remove them from the active folder:

```powershell
Remove-Item .github/workflows/*-ci.yml -Exclude terraform-ci.yml
```

3. Activate the AKS pipelines:

```powershell
Copy-Item .github/workflows-archive-aks/aks-*-ci.yml .github/workflows/
```

Then branch -> commit -> PR -> squash merge. After the merge each AKS pipeline runs once (its own workflow file changed)
and opens a bot PR with the new image.

To switch back, see `.github/workflows-archive-dockerdesktop/README.md`.
