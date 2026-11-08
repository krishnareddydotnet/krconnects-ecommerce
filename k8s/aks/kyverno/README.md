# Kyverno on AKS: only signed images may run

The AKS pipelines (`aks-<service>-ci.yml`) sign every image with **Cosign keyless**.
Kyverno checks that signature **when a pod is created**, so an image that wasn't built and signed by our pipelines can't run.

| File | What it does |
|---|---|
| `kyverno-values.yaml` | Helm values: Workload Identity for the admission controller (to read signatures from ACR) |
| `verify-image-signatures.yaml` | ClusterPolicy: images from `krconnectspractice.azurecr.io` in namespace `default` must carry a Cosign signature from `aks-<service>-ci.yml` on `main` |

**Why Kyverno, not AKS Image Integrity?** Image Integrity (Ratify + Azure Policy) is preview, supports only Notation signatures
(not Cosign) and can only Audit. Kyverno verifies Cosign keyless signatures and can Enforce.
Gatekeeper (Azure Policy add-on) stays for pod-spec rules; Kyverno only does image verification here. Kyverno is free (open source).

Run all commands in **PowerShell 7** from the repo root.

---

## Step 1: managed identity for Kyverno (once)

Kyverno must read signatures from our **private** ACR. It uses its own managed identity with **AcrPull**
(the kubelet's AcrPull doesn't cover the Kyverno pod).

```powershell
az identity create --resource-group rg-krconnects-practice-cin-001 --name id-kyverno-acr-pull --location centralindia
az identity show --resource-group rg-krconnects-practice-cin-001 --name id-kyverno-acr-pull --query "{clientId:clientId, principalId:principalId}" -o table
az acr show --name krconnectspractice --query id -o tsv
```

Give the identity AcrPull on the ACR (use the `principalId` and the ACR id printed above):

```powershell
az role assignment create --assignee-object-id <principalId> --assignee-principal-type ServicePrincipal --role AcrPull --scope <acr-id>
```

## Step 2: federated credential (trust the Kyverno service account)

This lets the Kubernetes service account `kyverno/kyverno-admission-controller` sign in as the managed identity.

```powershell
az aks show --resource-group rg-krconnects-practice-cin-001 --name aks-krconnects-practice-cin-001 --query "oidcIssuerProfile.issuerUrl" -o tsv
az identity federated-credential create --name fc-kyverno-admission-controller --identity-name id-kyverno-acr-pull --resource-group rg-krconnects-practice-cin-001 --issuer <issuer-url-from-above> --subject system:serviceaccount:kyverno:kyverno-admission-controller --audiences api://AzureADTokenExchange
```

Then put the identity's **clientId** into `kyverno-values.yaml` (replace `<client-id-of-id-kyverno-acr-pull>`) and commit it.

## Step 3: install Kyverno

```powershell
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update
helm install kyverno kyverno/kyverno --namespace kyverno --create-namespace --version 3.9.2 -f k8s/aks/kyverno/kyverno-values.yaml
kubectl get pods -n kyverno
```

**Check:** all `kyverno-...` pods are `Running`. The admission controller has the Azure variables:

```powershell
kubectl describe pod -n kyverno -l app.kubernetes.io/component=admission-controller | Select-String -Pattern "AZURE_CLIENT_ID|AZURE_FEDERATED_TOKEN_FILE"
```

## Step 4: apply the policy in Audit mode

```powershell
kubectl apply -f k8s/aks/kyverno/verify-image-signatures.yaml
kubectl get clusterpolicy verify-image-signatures
```

**Check:** `READY` is `True`.

Signatures are checked when pods are **created**, so restart the apps to test them:

```powershell
kubectl rollout restart deployment -n default
kubectl get pods
kubectl get policyreport -n default
```

**Check:** every app pod gets a report with `PASS` for `verify-cosign-keyless`. A `FAIL` with an authentication error
means the identity or federated credential is wrong (steps 1 and 2).

## Step 5: prove it with an unsigned image

Copy a public image into our ACR **without signing it**:

```powershell
az acr import --name krconnectspractice --source docker.io/library/nginx:1.27 --image test/nginx-unsigned:1.27
az acr repository show --name krconnectspractice --image test/nginx-unsigned:1.27 --query digest -o tsv
```

Switch the policy to block: in `verify-image-signatures.yaml` change `failureAction: Audit` to `failureAction: Enforce`, then:

```powershell
kubectl apply -f k8s/aks/kyverno/verify-image-signatures.yaml
kubectl run unsigned-test --image=krconnectspractice.azurecr.io/test/nginx-unsigned@<digest-from-above> --restart=Never
```

**Expect:** an error like `admission webhook "...kyverno..." denied the request`, naming the policy
`verify-image-signatures` / rule `verify-cosign-keyless`, with a reason such as `no signatures found`.
The real apps keep running, because their images are signed by our pipelines.

Clean up the test image:

```powershell
az acr repository delete --name krconnectspractice --image test/nginx-unsigned:1.27 --yes
```

---

## Interview points

- CI signs with Cosign keyless (GitHub OIDC → Fulcio certificate naming the workflow → Rekor log); the cluster verifies at
  admission with Kyverno. Only images built by our pipeline on `main` can run.
- Roll out in **Audit** first (PolicyReports show what *would* fail), fix, then **Enforce**.
- Kyverno reads ACR with **Workload Identity** (managed identity + federated credential), no registry passwords.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Report `FAIL` ... `UNAUTHORIZED` / `failed to get token` | Kyverno can't log in to ACR | Check the clientId in `kyverno-values.yaml`, the AcrPull role, and the federated credential subject `system:serviceaccount:kyverno:kyverno-admission-controller`; then `helm upgrade` and restart Kyverno |
| Report `FAIL` ... `subject` mismatch | The image was signed by another workflow or branch | Rebuild with the `aks-<service>-ci.yml` pipeline on `main` |
| Pods create slowly or time out | Signature lookups (ACR, Rekor) are slow | `webhookTimeoutSeconds: 30` is set; check the Kyverno pod logs |
| Need to undo quickly | Policy blocks something important | `kubectl delete clusterpolicy verify-image-signatures` (Audit mode never blocks) |
