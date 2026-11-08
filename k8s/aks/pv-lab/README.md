# PV and PVC hands-on lab (AKS, Azure Files)

A small, production-style lab to learn **StorageClass, PersistentVolumeClaim (PVC) and PersistentVolume (PV)**.
A tiny nginx pod serves photos from the volume: you copy a photo in, open it in the browser, then prove it survives
pod restarts, is shared across nodes, can grow, and is kept when the PVC is deleted.

Everything runs in namespace `pv-lab`, so the shop, Istio and Kyverno (`default` namespace) are not affected.

| File | Object | What it is |
|---|---|---|
| `storageclass.yaml` | StorageClass `azurefile-std-retain` | HOW to create storage: Azure Files Standard_LRS, Retain, expandable |
| `pvc.yaml` | PVC `photos-pvc` | The REQUEST: 1Gi, ReadWriteMany, of that class |
| `photo-server.yaml` | ConfigMap, Deployment, Service `photo-server` | nginx that mounts the PVC at `/usr/share/nginx/html/photos` |

**Cost:** Azure Files Standard_LRS bills for the GB actually stored, so a few photos cost almost nothing.

## The three objects in one picture

```
StorageClass (cluster-wide)      "how to make storage"      azurefile-std-retain
      ^ storageClassName
PVC (namespace pv-lab)           "I need 1Gi, RWX"          photos-pvc
      | bound 1-to-1
PV (cluster-wide)                "this piece of storage"    pvc-<uid>  ->  Azure file share
      ^ claimName
Pod                              mounts the PVC at a path   /usr/share/nginx/html/photos
```

Run all commands in **PowerShell 7** from the repo root, with kubectl pointing at AKS.

---

## Step 1: StorageClass

```powershell
kubectl create namespace pv-lab
kubectl apply -f k8s/aks/pv-lab/storageclass.yaml
kubectl get storageclass
```

**Look at:** your `azurefile-std-retain` next to the AKS built-in classes (`managed-csi` = Azure Disk RWO,
`azurefile-csi` = Azure Files RWX). The RECLAIMPOLICY column: yours `Retain`, built-in ones `Delete`.

## Step 2: PVC -> PV (dynamic provisioning)

```powershell
kubectl apply -f k8s/aks/pv-lab/pvc.yaml
kubectl get pvc -n pv-lab -w
```

Press Ctrl+C when STATUS is `Bound`, then:

```powershell
kubectl get pv
kubectl describe pvc photos-pvc -n pv-lab
```

**Look at:** a new PV named `pvc-<uid>` with CLAIM `pv-lab/photos-pvc`, ACCESS MODES `RWX`, RECLAIM POLICY `Retain`.
Nobody wrote a PV YAML: the CSI driver created the PV **and** an Azure file share, in a storage account inside the
cluster's node resource group:

```powershell
az aks show --resource-group rg-krconnects-practice-cin-001 --name aks-krconnects-practice-cin-001 --query nodeResourceGroup -o tsv
```

Azure portal > that resource group > storage account `f...` > **File shares**.

## Step 3: mount it and store a photo

```powershell
kubectl apply -f k8s/aks/pv-lab/photo-server.yaml
kubectl get pods -n pv-lab -o wide
```

When the pod is `1/1 Running`, copy any small photo from your laptop into the volume
(replace `<pod-name>` and the file path):

```powershell
kubectl cp C:\Users\krish\Pictures\profile.png pv-lab/<pod-name>:/usr/share/nginx/html/photos/profile.png
kubectl exec -n pv-lab <pod-name> -- ls -l /usr/share/nginx/html/photos
kubectl port-forward -n pv-lab service/photo-server 8080:8080
```

Open http://localhost:8080/photos/ (file list) and click the photo.
The file is also visible in the Azure file share (portal > storage account > File shares > the share > Browse).

`kubectl cp` copies a file into a running container (it uses `tar` inside the container).

## Step 4: persistence (the whole point of a PV)

```powershell
kubectl delete pod -n pv-lab -l app.kubernetes.io/name=photo-server
kubectl get pods -n pv-lab
kubectl exec -n pv-lab <new-pod-name> -- ls -l /usr/share/nginx/html/photos
```

**Look at:** a NEW pod (new name), and the photo is still there. Compare with the `tmp` volume (`emptyDir`):
anything written there is deleted with the pod.

## Step 5: ReadWriteMany (shared across nodes)

```powershell
kubectl scale deployment photo-server -n pv-lab --replicas=2
kubectl get pods -n pv-lab -o wide
kubectl exec -n pv-lab <second-pod-name> -- ls -l /usr/share/nginx/html/photos
```

**Look at:** the NODE column shows two different nodes (pod anti-affinity), and both pods see the same photo.
With an Azure Disk (`managed-csi`, ReadWriteOnce) the second pod on another node could NOT mount the volume.

## Step 6: expand the volume (no downtime)

```powershell
kubectl patch pvc photos-pvc -n pv-lab --patch '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'
kubectl get pvc -n pv-lab -w
```

**Look at:** CAPACITY changes from `1Gi` to `2Gi` while the pods keep running.
Only works because the StorageClass has `allowVolumeExpansion: true`. Volumes can grow, never shrink.

## Step 7: Retain (deleting the PVC keeps the data)

```powershell
kubectl delete -f k8s/aks/pv-lab/photo-server.yaml
kubectl delete -f k8s/aks/pv-lab/pvc.yaml
kubectl get pv
```

**Look at:** the PV still exists with STATUS `Released` (not deleted), and the Azure file share and photo are still there.
With `reclaimPolicy: Delete` (the built-in classes) the PV and the share would be gone. Retain protects against accidental
data loss, but someone must clean up by hand.

## Clean up (Retain = manual)

Find the file share behind the PV (`volumeHandle` = `<resource-group>#<storage-account>#<share>#...`):

```powershell
kubectl get pv
kubectl get pv <pv-name> -o jsonpath="{.spec.csi.volumeHandle}"
```

Delete the PV object, then the Azure file share (use the values from the volumeHandle):

```powershell
kubectl delete pv <pv-name>
az storage share-rm delete --resource-group <resource-group> --storage-account <storage-account> --name <share> --yes
kubectl delete namespace pv-lab
kubectl delete -f k8s/aks/pv-lab/storageclass.yaml
```

---

## Interview points

- **StorageClass** = how storage is created (provisioner, SKU, reclaim policy, expansion). **PVC** = an app's request.
  **PV** = the actual storage, bound 1-to-1 to the PVC. Dynamic provisioning creates the PV from the class.
- **Access modes:** RWO (Azure Disk, one node) for databases; RWX (Azure Files) when pods on many nodes share files.
- **Reclaim policy:** Delete (default) removes the storage with the PVC; Retain keeps it (`Released`) for safety.
- **Expansion:** needs `allowVolumeExpansion: true`; grow only.
- In production, user uploads usually go to **Blob Storage**; PVCs are for workloads that need a filesystem
  (databases as StatefulSets with `volumeClaimTemplates`, shared legacy folders), plus backups (Azure Backup for AKS).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| PVC stays `Pending` | Class name typo, or the CSI driver can't create the storage account/share | `kubectl describe pvc photos-pvc -n pv-lab` (Events) |
| Pod `ContainerCreating`, event `MountVolume.SetUp failed` | Share not reachable (network) or mount options | `kubectl describe pod <pod> -n pv-lab` |
| `kubectl cp` says permission denied | The volume isn't owned by UID 101 | Check `uid=101,gid=101` in the StorageClass `mountOptions` (only applies to NEW PVs: recreate the PVC) |
| Patch fails with `field can not be less than previous value` | Volumes can only grow | Use a bigger size |
