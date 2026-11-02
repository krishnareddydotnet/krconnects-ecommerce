# HTTPS for localhost on Docker Desktop (self-signed certificate, PowerShell only)

All UIs are served over HTTPS by the Istio ingress gateway, with one self-signed certificate
created with built-in PowerShell 7 (no third-party tools).

| URL | App |
|---|---|
| https://localhost | customer-portal (shop) |
| https://prometheus.localhost | Prometheus |
| https://grafana.localhost | Grafana |
| https://kiali.localhost | Kiali |
| https://argocd.localhost | Argo CD |

`http://...` URLs redirect to `https://` automatically.

## How it works

```
Browser --HTTPS--> istio-ingress gateway (decrypts TLS with our certificate)
        --HTTP + mTLS (sidecars)--> app / tool, chosen by the Host header (VirtualService)
```

- Chrome/Edge resolve `*.localhost` to 127.0.0.1, so every URL reaches the same gateway (ports 80/443).
- The certificate is trusted only for the current Windows user (`Cert:\CurrentUser\Root`).
- The certificate lists every name explicitly: browsers often reject a `*.localhost` wildcard.
  A new tool URL means a new certificate with that name added.
- The private key stays outside the repo (`D:\krconnects`). Never commit `localhost.key`.

## Prerequisites

- PowerShell 7 (`$PSVersionTable.PSVersion`). Windows PowerShell 5.1 cannot export PEM files.
- Istio ingress gateway Service exposes 443: `kubectl get svc -n istio-ingress` shows `443:.../TCP`.

## Step 1: create the certificate (Windows certificate store)

```powershell
$cert = New-SelfSignedCertificate -Subject "CN=localhost" -DnsName "localhost","argocd.localhost","grafana.localhost","prometheus.localhost","kiali.localhost" -CertStoreLocation "Cert:\CurrentUser\My" -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(2) -FriendlyName "krconnects-localhost"
$cert | Format-List Subject, DnsNameList, NotAfter, Thumbprint
```

`-KeyExportPolicy Exportable` allows exporting the private key for Kubernetes. Valid for 2 years.

## Step 2: trust it in Windows (padlock, no "Not secure")

```powershell
Export-Certificate -Cert $cert -FilePath D:\krconnects\localhost.cer | Out-Null
Import-Certificate -FilePath D:\krconnects\localhost.cer -CertStoreLocation Cert:\CurrentUser\Root
```

Windows shows a security warning for "localhost": it is your own certificate, click **Yes**.

## Step 3: export certificate and key as PEM files (same PowerShell window)

```powershell
$pfx = $cert.Export("Pfx", "temp-pass")
$exportable = [System.Security.Cryptography.X509Certificates.X509CertificateLoader]::LoadPkcs12($pfx, "temp-pass", [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
$cert.ExportCertificatePem() | Set-Content D:\krconnects\localhost.crt
$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($exportable)
$rsa.ExportPkcs8PrivateKeyPem() | Set-Content D:\krconnects\localhost.key
Get-Content D:\krconnects\localhost.crt -TotalCount 1   # -----BEGIN CERTIFICATE-----
Get-Content D:\krconnects\localhost.key -TotalCount 1   # -----BEGIN PRIVATE KEY-----
```

- Windows does not hand out the private key directly, so it is packed into a PFX in memory and reloaded as exportable.
- `GetRSAPrivateKey` is a .NET extension method: PowerShell must call it through
  `RSACertificateExtensions`, not as `$exportable.GetRSAPrivateKey()`.

## Step 4: store it as a Kubernetes TLS secret (next to the gateway pod)

```powershell
kubectl create secret tls krconnects-localhost-tls -n istio-ingress --cert=D:\krconnects\localhost.crt --key=D:\krconnects\localhost.key
kubectl get secret krconnects-localhost-tls -n istio-ingress   # TYPE kubernetes.io/tls, DATA 2
```

The secret must be in `istio-ingress` (the gateway POD's namespace), not in `default` where the Gateway
YAML lives: the gateway pod loads the certificate itself through `credentialName`.

## Step 5: Gateway with HTTPS (443) and redirect (80)

```powershell
kubectl apply -f k8s/docker-desktop/istio/scenarios/basic/gateway.yaml
```

Port 443 uses `tls.mode: SIMPLE` with `credentialName: krconnects-localhost-tls`; port 80 has
`httpsRedirect: true`. The VirtualServices do not change: they bind to the Gateway by name.

## Step 6: Argo CD behind the gateway

argocd-server serves HTTPS only by default and redirects HTTP to HTTPS. The gateway already decrypted
TLS and sends plain HTTP, so without a change the browser loops (ERR_TOO_MANY_REDIRECTS).
Fix: run argocd-server in insecure mode (plain HTTP inside the cluster) through a Helm value,
so a later `helm upgrade` does not undo it.

```powershell
helm list -n argocd        # CHART column, e.g. argo-cd-9.1.0 -> version 9.1.0
helm upgrade argocd argo/argo-cd -n argocd --version 9.1.0 -f k8s/docker-desktop/argocd/argocd-values.yaml
kubectl get configmap argocd-cmd-params-cm -n argocd -o jsonpath="{.data.server\.insecure}"   # true
kubectl apply -f k8s/docker-desktop/argocd/argocd-virtualservice.yaml
```

Use YOUR current chart version from `helm list` (keeps Argo CD at the same version).
Login: `admin` + the password from `argocd-initial-admin-secret` (see docs/docker-desktop-setup.md).

## Test

1. https://localhost shows the shop; site info says "Connection is secure".
2. http://localhost switches to https://localhost (redirect).
3. https://prometheus.localhost, https://grafana.localhost, https://kiali.localhost, https://argocd.localhost.

Still "Not secure"? Close all Chrome/Edge windows and reopen (trusted certificates are cached).

## Renew or remove

- Renew (2 years) or add a name: repeat steps 1-3, then replace the secret:
  `kubectl delete secret krconnects-localhost-tls -n istio-ingress` and step 4 again.
- Remove the trusted certificate: `certmgr.msc` (or Manage user certificates) ->
  Trusted Root Certification Authorities -> Certificates -> delete "localhost" (FriendlyName krconnects-localhost);
  also delete it from Personal -> Certificates.

## Production comparison

| Docker Desktop (this guide) | AKS / production |
|---|---|
| Self-signed certificate, trusted on one laptop | Certificate from a public or company CA (DigiCert, Let's Encrypt) |
| Secret created manually with kubectl | Key Vault + CSI driver or cert-manager, auto-renewal |
| One gateway, tools on the same gateway | Shop on the external gateway (behind WAF); Grafana, Prometheus, Argo CD on an internal gateway |
| argocd-server insecure, TLS at the gateway | Same pattern: TLS terminated at the gateway, mTLS inside the mesh |
