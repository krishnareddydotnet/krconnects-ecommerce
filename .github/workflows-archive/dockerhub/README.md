# Archived: Docker Hub service pipelines

These 7 workflows built each service and pushed the image to Docker Hub (or ACR, with the variable `IMAGE_REGISTRY`),
then updated `helm/ecommerce/values-<service>.yaml` through a bot PR.

They are **archived, not deleted**: GitHub only runs workflows in `.github/workflows/`, so nothing here runs.
They are kept as learning material and to go back to Docker Hub + Helm (Docker Desktop) later:
move a file back to `.github/workflows/` to run it again.

The active pipelines are now `.github/workflows/aks-<service>-ci.yml`: they push to ACR
(`krconnectspractice.azurecr.io`) and update `k8s/aks/apps/<service>.yaml` (see `k8s/aks/README.md`).
notification-service has no AKS pipeline yet.
