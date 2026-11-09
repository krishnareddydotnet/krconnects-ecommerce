# Product images on Docker Desktop (PVC + image-server)

The 500 product images live on a **PersistentVolume** in the cluster and a small nginx pod serves them.
No Azure Blob Storage, no cloud cost.

```
browser  https://localhost/images/products/wireless-mouse.webp
   -> Istio gateway  (VirtualService rule "product-images": prefix /images/, rewrite to /)
   -> image-server   (nginx, non-root, read-only root filesystem)  /products/wireless-mouse.webp
   -> PVC product-images  (kind "standard" StorageClass, 1Gi, ReadWriteOnce)
```

- The **database stores only the path** (`products/wireless-mouse.webp`).
- **catalog-api** adds the base URL from `IMAGES_BASE_URL` = `/images/` (`k8s/docker-desktop/apps/catalog-api.yaml`).
  Same site as the shop: no extra hostname, certificate or CORS. Moving images again only changes that value.
- A PVC is only storage; the **pod** is what answers HTTP requests. You need both.

| File | Objects |
|---|---|
| `image-server.yaml` | PVC `product-images`, ConfigMap (nginx config), ServiceAccount, Deployment, Service, NetworkPolicy |
| `../istio/common/authorization-policies/image-server.yaml` | Only the ingress gateway may call it, GET/HEAD only |
| `../istio/scenarios/basic/virtualservice.yaml` | The `/images/` route (also in the canary and blue-green VirtualServices) |

## Set up (once)

Run from the repo root (PowerShell 7).

**1. Deploy the image server, its policy and the route**

```powershell
kubectl apply -f k8s/docker-desktop/images/image-server.yaml
kubectl apply -f k8s/docker-desktop/istio/common/authorization-policies/image-server.yaml
kubectl apply -f k8s/docker-desktop/istio/scenarios/basic/virtualservice.yaml
kubectl get pvc product-images
kubectl get pods -l app.kubernetes.io/name=image-server
```

**Check:** the PVC is `Bound` (kind creates the PV when the pod starts: `WaitForFirstConsumer`) and the pod is `2/2 Running`.

**2. Copy the images into the PVC** (from the local backup `D:\krconnects\product-images-backup`, 500 `.webp` files)

`kubectl cp` on Windows can't take a path with `C:`/`D:` (the colon looks like `pod:path`), so run it from inside the folder:

```powershell
cd D:\krconnects\product-images-backup
kubectl cp . default/<image-server-pod-name>:/usr/share/nginx/html/products -c image-server
cd D:\krconnects\krconnects-ecommerce
kubectl exec deploy/image-server -c image-server -- sh -c "ls /usr/share/nginx/html/products | wc -l"
```

**Check:** the count is `500`. The pod name comes from `kubectl get pods -l app.kubernetes.io/name=image-server`.

**3. Point catalog-api at the image server**

`IMAGES_BASE_URL: "/images/"` is in `k8s/docker-desktop/apps/catalog-api.yaml`. catalog-api is managed by Argo CD, so the change
is applied by **merging it to `main`** (Argo CD syncs; click REFRESH to make it instant).

**4. Test**

Open https://localhost/images/products/wireless-mouse.webp (one image), then https://localhost (the shop shows the pictures).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `RBAC: access denied` on /images/... | The AuthorizationPolicy isn't applied | Step 1 (`authorization-policies/image-server.yaml`) |
| `404` for an image | File missing on the PVC, or the name differs | `kubectl exec deploy/image-server -c image-server -- ls /usr/share/nginx/html/products` |
| Shop still shows letter placeholders | catalog-api still has the old `IMAGES_BASE_URL` | Merge the change, REFRESH catalog-api in Argo CD, hard-refresh the browser (Ctrl+F5) |
| /images/ shows the shop page instead | The VirtualService without the `/images/` rule is active (e.g. an old scenario file) | Apply the scenario's current `virtualservice.yaml` |
| PVC `Pending` | Normal until the pod starts (`WaitForFirstConsumer`) | Check the pod; `kubectl describe pvc product-images` |
