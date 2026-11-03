# Docker Hub service pipelines (currently ACTIVE)

The 7 Docker Hub pipelines (`<service>-ci.yml`) are **currently active** in `.github/workflows/`.
They push each image to Docker Hub (or ACR, with the repository variable `IMAGE_REGISTRY`) and update
`helm/ecommerce/values-<service>.yaml` through a bot PR (used on Docker Desktop with Helm). The customer-portal
bot PR also updates the canary Rollout image (`k8s/docker-desktop/istio/scenarios/canary/customer-portal/rollout.yaml`).

This folder holds them only while the AKS pipelines are active. Only one set may be active, because both watch
the same service folders. The AKS pipelines are archived in `.github/workflows-archive/aks/`;
its README shows how to switch.
