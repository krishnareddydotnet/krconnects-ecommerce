# Local SQL Server (Windows laptop) for the Docker Desktop cluster

The shop's database runs on the laptop itself: **SQL Server 2025 Express**, default instance (`MSSQLSERVER`), port **1433**.
No Azure SQL, no cloud cost. Pods reach it through the in-cluster name `sql-server` (file `sql-server-external.yaml`).

```
data-api pod --> sql-server:1433 (Service, no selector) --> EndpointSlice 192.168.65.254 --> Windows host SQL Server
```

Why not `host.docker.internal` directly? Pods use CoreDNS, which doesn't know that Docker Desktop name.
The kind **nodes** do: `docker exec desktop-control-plane getent hosts host.docker.internal` prints the IP
(`192.168.65.254`), which the EndpointSlice uses.

## One-time setup on Windows

1. **Install SQL Server 2025 Express**: Custom install, only *Database Engine Services*, **Default instance**,
   **Mixed Mode** (strong `sa` password), add your Windows user as admin. Don't install LocalDB for this
   (LocalDB doesn't accept TCP connections).
2. **Enable TCP/IP** (Express installs with it off): SQL Server Configuration Manager > SQL Server Network Configuration >
   Protocols for MSSQLSERVER > TCP/IP > Enabled = Yes; IP Addresses > **IPAll**: TCP Dynamic Ports empty, TCP Port `1433`.
   Restart in an admin PowerShell and check:
   ```powershell
   Restart-Service -Name 'MSSQLSERVER' -Force
   Test-NetConnection -ComputerName localhost -Port 1433
   ```
3. **Restore the data** in SSMS (connect to `localhost`, tick *Trust Server Certificate*): `CREATE DATABASE ecommerce;`,
   then run the backup script `D:\krconnects\dbscript\dbscript.sql` against `ecommerce` (remove Azure-only
   `CREATE/ALTER DATABASE` lines at the top if present). Check `SELECT COUNT(*) FROM Products;` = 500.
4. **App login (least privilege, never `sa`)**:
   ```sql
   CREATE LOGIN ecommerce_data_api WITH PASSWORD = '<strong-password>', CHECK_POLICY = ON;
   GO
   USE ecommerce;
   CREATE USER ecommerce_data_api FOR LOGIN ecommerce_data_api;
   ALTER ROLE db_datareader ADD MEMBER ecommerce_data_api;
   ALTER ROLE db_datawriter ADD MEMBER ecommerce_data_api;
   ALTER ROLE db_ddladmin   ADD MEMBER ecommerce_data_api;   -- data-api runs EnsureCreated() + schema checks at startup
   GO
   ```

## Connect the cluster

```powershell
kubectl apply -f k8s/docker-desktop/sql-server/sql-server-external.yaml
kubectl get endpointslice -l kubernetes.io/service-name=sql-server

kubectl create secret generic data-api-secret --from-literal=ConnectionStrings__DataDb="Server=sql-server,1433;Database=ecommerce;User Id=ecommerce_data_api;Password=<password>;Encrypt=True;TrustServerCertificate=True" --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment data-api
```

`TrustServerCertificate=True`: local SQL Server uses a self-signed certificate. Fine on a laptop, never in production.

## Check the network path (if data-api can't connect)

```powershell
kubectl create namespace sql-test
kubectl run nc-test -n sql-test --image=busybox:1.36 --restart=Never --command -- sh -c "nc -zv -w 5 192.168.65.254 1433"
kubectl logs -n sql-test nc-test          # expect: ... 1433 open
kubectl delete namespace sql-test
```
