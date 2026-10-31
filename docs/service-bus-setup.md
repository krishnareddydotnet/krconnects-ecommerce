# Azure Service Bus setup (manual steps)

These steps connect **order-api** and **notification-service** through Azure Service Bus.
Run them yourself (Azure CLI); nothing here is automated, and there are **no secrets**: both services log in with
**Microsoft Entra Workload Identity**, so there are no connection strings or shared access keys.

Replace every `<placeholder>`:

| Placeholder | Example | Meaning |
|---|---|---|
| `<resource-group>` | `rg-krconnects` | Resource group of your AKS cluster |
| `<location>` | `centralindia` | Azure region |
| `<namespace>` | `krconnects-sb` | Service Bus namespace name (must be globally unique) |
| `<aks-name>` | `aks-krconnects` | Your AKS cluster |

```
order-api ──send──▶ topic "orders" ──▶ subscription "notification-service" ──receive──▶ notification-service
 (Data Sender)                                                                         (Data Receiver)
```

---

## 1. Service Bus namespace

Use the **Standard** tier: **topics need Standard** (the Basic tier only has queues).

```bash
az servicebus namespace create \
  --resource-group <resource-group> \
  --name <namespace> \
  --location <location> \
  --sku Standard

# Optional but recommended: turn off key-based (SAS) login completely, so only Entra ID works
az servicebus namespace update --resource-group <resource-group> --name <namespace> --disable-local-auth true
```

## 2. Topic and subscription

Topic `orders` with **duplicate detection** (10 minutes). order-api sets `messageId` = order number, so if the same
order is sent twice within 10 minutes, Service Bus drops the second copy.

```bash
az servicebus topic create \
  --resource-group <resource-group> \
  --namespace-name <namespace> \
  --name orders \
  --enable-duplicate-detection true \
  --duplicate-detection-history-time-window PT10M
```

Subscription `notification-service`:
- **max delivery count 5**: after 5 failed attempts the message goes to the dead-letter queue instead of looping forever;
- **dead-lettering on message expiration**: expired messages are kept in the dead-letter queue instead of disappearing.

```bash
az servicebus topic subscription create \
  --resource-group <resource-group> \
  --namespace-name <namespace> \
  --topic-name orders \
  --name notification-service \
  --max-delivery-count 5 \
  --enable-dead-lettering-on-message-expiration true
```

## 3. One managed identity per service

Each service gets its **own** identity, so each has only the rights it needs (least privilege).

```bash
az identity create --resource-group <resource-group> --name id-order-api
az identity create --resource-group <resource-group> --name id-notification-service

# Client IDs: put them in the Helm values (serviceAccount.annotations azure.workload.identity/client-id)
az identity show --resource-group <resource-group> --name id-order-api            --query clientId -o tsv
az identity show --resource-group <resource-group> --name id-notification-service --query clientId -o tsv
```

Client IDs are not secrets, but they are specific to your subscription, so the repo keeps the annotation empty (`""`).
Fill it in at deploy time, e.g. `--set serviceAccount.annotations."azure\.workload\.identity/client-id"=<client-id>`.

## 4. Roles (least privilege)

| Identity | Role | Scope | Why |
|---|---|---|---|
| `id-order-api` | **Azure Service Bus Data Sender** | topic `orders` | Can only **send** to this topic |
| `id-notification-service` | **Azure Service Bus Data Receiver** | subscription `notification-service` | Can only **receive** from its own subscription |
| `id-notification-service` (used by KEDA) | **Azure Service Bus Data Owner** | subscription `notification-service` | KEDA reads the **message count** (see below) |

```bash
SB_ID=$(az servicebus namespace show --resource-group <resource-group> --name <namespace> --query id -o tsv)
TOPIC_SCOPE="$SB_ID/topics/orders"
SUBSCRIPTION_SCOPE="$SB_ID/topics/orders/subscriptions/notification-service"

ORDER_API_PRINCIPAL=$(az identity show -g <resource-group> -n id-order-api --query principalId -o tsv)
NOTIFICATION_PRINCIPAL=$(az identity show -g <resource-group> -n id-notification-service --query principalId -o tsv)

az role assignment create --assignee-object-id "$ORDER_API_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Azure Service Bus Data Sender" --scope "$TOPIC_SCOPE"

az role assignment create --assignee-object-id "$NOTIFICATION_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Azure Service Bus Data Receiver" --scope "$SUBSCRIPTION_SCOPE"
```

### Which role does KEDA need?

KEDA does not receive messages; it only **reads how many messages are waiting**. Service Bus returns that number
from its *management* API (the "runtime properties" of the subscription), which needs the **Manage** right.
In Entra ID roles, Manage is only in **Azure Service Bus Data Owner**. *Data Receiver* (Listen) is not enough, and
KEDA logs an authorization error.

> Check this against the KEDA documentation for your KEDA version
> (`https://keda.sh/docs/<version>/scalers/azure-service-bus/`). It could not be verified while this guide was written.

```bash
az role assignment create --assignee-object-id "$NOTIFICATION_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Azure Service Bus Data Owner" --scope "$SUBSCRIPTION_SCOPE"
```

**Trade-off:** Data Owner gives the notification-service identity more than it needs for receiving (although only
on its own subscription). Stricter option: create a **third identity just for KEDA** (`id-keda-servicebus`), give
*it* Data Owner on the subscription, and put its client ID in `identityId` in
`notification-service/deploy/keda-scaledobject.yaml`. Then the worker identity keeps only Data Receiver.

## 5. Federated credentials (Workload Identity)

A federated credential says: "a token from **this** Kubernetes ServiceAccount may log in as **this** managed
identity". The Helm chart creates ServiceAccounts named after `fullnameOverride`: `order-api` and
`notification-service`, in namespace `default`.

```bash
OIDC_ISSUER=$(az aks show --resource-group <resource-group> --name <aks-name> --query oidcIssuerProfile.issuerUrl -o tsv)

az identity federated-credential create \
  --resource-group <resource-group> \
  --identity-name id-order-api \
  --name fc-order-api \
  --issuer "$OIDC_ISSUER" \
  --subject system:serviceaccount:default:order-api \
  --audiences api://AzureADTokenExchange

az identity federated-credential create \
  --resource-group <resource-group> \
  --identity-name id-notification-service \
  --name fc-notification-service \
  --issuer "$OIDC_ISSUER" \
  --subject system:serviceaccount:default:notification-service \
  --audiences api://AzureADTokenExchange
```

**KEDA needs one more.** With `provider: azure-workload`, the token is requested by the **KEDA operator pod**, not by
the notification-service pod. So the identity KEDA uses also needs a federated credential for KEDA's own
ServiceAccount:

- AKS KEDA add-on: ServiceAccount `keda-operator` in namespace `kube-system`
- KEDA installed with Helm: ServiceAccount `keda-operator` in namespace `keda`

```bash
az identity federated-credential create \
  --resource-group <resource-group> \
  --identity-name id-notification-service \
  --name fc-keda-operator \
  --issuer "$OIDC_ISSUER" \
  --subject system:serviceaccount:kube-system:keda-operator \
  --audiences api://AzureADTokenExchange
```

Also make sure Workload Identity is enabled for the KEDA operator. The AKS add-on does this when the cluster has
Workload Identity enabled; a Helm install needs `podIdentity.azureWorkload.enabled=true`. After adding the federated
credential, restart the operator so it picks it up:
`kubectl rollout restart deployment keda-operator -n kube-system`.

## 6. Deploy

1. Put the Service Bus namespace (`<namespace>.servicebus.windows.net`) and the client IDs into the Helm values
   (or `--set` them at deploy time).
2. Deploy **notification-service** first (so the subscription is being read), then redeploy **order-api**.
3. Optional: apply `notification-service/deploy/keda-scaledobject.yaml` (after replacing its placeholders).
4. Check: place an order on the website, then look at the logs:

```bash
kubectl logs deploy/order-api | grep OrderPlaced                   # "OrderPlaced event sent for KRC-..."
kubectl logs deploy/notification-service | grep "Order confirmation"
```

## 7. Look at dead-lettered messages (Azure portal)

1. Azure portal → your Service Bus namespace → **Topics** → `orders` → **Subscriptions** → `notification-service`.
2. The overview shows **Active** and **Dead-letter** message counts.
3. Open **Service Bus Explorer** (left menu) → choose **Dead-letter** → **Peek from start**.
4. Click a message to see its body and properties. `DeadLetterReason` tells you why:
   - `InvalidMessage`: notification-service rejected it (the description says what was wrong);
   - `MaxDeliveryCountExceeded`: it failed 5 times (look at the notification-service logs for the error);
   - `TTLExpiredException`: it expired before anyone processed it.

Your own Entra user needs a data role (e.g. *Azure Service Bus Data Receiver* on the subscription) to see message
contents in Service Bus Explorer. If you disabled local (SAS) auth in step 1, make sure Service Bus Explorer is set
to use your Microsoft Entra account.
