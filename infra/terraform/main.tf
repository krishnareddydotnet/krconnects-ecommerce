# =======================================================================
# KRConnects - dev infrastructure (single file for learning)
# =======================================================================

terraform {
  required_version = ">= 1.14, < 2.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.11"
    }
  }

  # Remote state (created earlier with az cli)
  backend "azurerm" {
    resource_group_name  = "rg-krconnects-tfstate-cin-001"
    storage_account_name = "stkrctfstatecin001"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

# Reads who is running Terraform (we need the tenant ID for Entra ID login)
data "azurerm_client_config" "current" {}

# -----------------------------------------------------------------------
# 1. Resource group
# -----------------------------------------------------------------------
resource "azurerm_resource_group" "rg" {
  name     = "rg-krconnects-dev-cin-001"
  location = "centralindia"
  tags = {
    environment = "dev"
  }
}

# -----------------------------------------------------------------------
# 2. Storage account + container for product images
# -----------------------------------------------------------------------
resource "azurerm_storage_account" "sa" {
  name                            = "stkrcimagesdevcin001"
  resource_group_name             = azurerm_resource_group.rg.name
  location                        = azurerm_resource_group.rg.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  public_network_access           = "Enabled"
  allow_nested_items_to_be_public = true
  access_tier                     = "Hot"
  min_tls_version                 = "TLS1_2"
  tags = {
    environment = "dev"
  }

  # Safety: Terraform refuses to delete this (images are used by kind + AKS)
  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_container" "images" {
  name                  = "products"
  storage_account_id    = azurerm_storage_account.sa.id
  container_access_type = "blob" # anyone can read a blob by URL, but cannot list

  # Safety: Terraform refuses to delete the container (500 product images)
  lifecycle {
    prevent_destroy = true
  }
}

# -----------------------------------------------------------------------
# 3. Network: VNet + subnets
# -----------------------------------------------------------------------
resource "azurerm_virtual_network" "vnet" {
  name                = "vnet-krconnects-dev-cin-001"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  address_space       = ["10.0.0.0/16"]
  tags = {
    environment = "dev"
  }
}

# Nodes get their IPs from here (pods use overlay IPs, not this subnet)
resource "azurerm_subnet" "aks" {
  name                 = "snet-aks-dev-cin-001"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]
}

# Reserved for Application Gateway later (empty subnet = no cost)
resource "azurerm_subnet" "appgw" {
  name                 = "snet-appgw-dev-cin-001"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.2.0/24"]
}

# -----------------------------------------------------------------------
# 4. Log Analytics workspace (for Container Insights logs)
# -----------------------------------------------------------------------
resource "azurerm_log_analytics_workspace" "law" {
  name                = "log-krconnects-dev-cin-001"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "PerGB2018" # pay per GB ingested
  retention_in_days   = 30          # 30 days retention is included in the price
  daily_quota_gb      = 0.5         # cost cap: stop ingesting after 0.5 GB per day
  tags = {
    environment = "dev"
  }
}

# -----------------------------------------------------------------------
# 5. Azure Container Registry (private image registry for AKS)
# -----------------------------------------------------------------------
resource "azurerm_container_registry" "acr" {
  name                = "krconnects" # globally unique, letters/numbers only (5-50 chars)
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic" # cheapest tier; Premium needed for private endpoints
  admin_enabled       = false   # zero trust: no shared admin username/password, Entra ID only
  tags = {
    environment = "dev"
  }
}

# You can push images (docker push / az acr build) with your own Entra ID login
resource "azurerm_role_assignment" "acr_push_me" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPush"
  principal_id         = "69d8ab41-6beb-41f8-a9b6-2b605d3067d9"
}

# -----------------------------------------------------------------------
# 6. AKS identity (created BEFORE the cluster)
# -----------------------------------------------------------------------
resource "azurerm_user_assigned_identity" "aks" {
  name                = "id-aks-krconnects-dev-cin-001"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  tags = {
    environment = "dev"
  }
}

# The cluster identity may manage the AKS subnet (load balancer, node NICs)
resource "azurerm_role_assignment" "aks_subnet_network_contributor" {
  scope                = azurerm_subnet.aks.id
  role_definition_name = "Network Contributor"
  principal_id         = azurerm_user_assigned_identity.aks.principal_id
}

# -----------------------------------------------------------------------
# 7. AKS cluster
# -----------------------------------------------------------------------
resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-krconnects-dev-cin-001"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  dns_prefix          = "aks-krconnects-dev"
  kubernetes_version  = "1.35" # minor version only; AKS applies patches automatically

  # Pricing tier: Standard = production tier with uptime SLA (Free = no SLA, dev/test only)
  sku_tier = "Standard"

  # Upgrades: patch versions automatically, node OS images weekly
  automatic_upgrade_channel = "patch"
  node_os_upgrade_channel   = "NodeImage"

  # Upgrades only happen Sunday 2 AM IST
  maintenance_window_auto_upgrade {
    frequency   = "Weekly"
    interval    = 1
    duration    = 4
    day_of_week = "Sunday"
    start_time  = "02:00"
    utc_offset  = "+05:30"
  }

  maintenance_window_node_os {
    frequency   = "Weekly"
    interval    = 1
    duration    = 4
    day_of_week = "Sunday"
    start_time  = "02:00"
    utc_offset  = "+05:30"
  }

  # System node pool "agentpool": only Kubernetes system pods (coredns, istiod, etc.)
  default_node_pool {
    name                         = "agentpool"
    vm_size                      = "Standard_D2ads_v5"
    os_sku                       = "Ubuntu"
    vnet_subnet_id               = azurerm_subnet.aks.id
    auto_scaling_enabled         = true
    min_count                    = 1
    max_count                    = 3
    only_critical_addons_enabled = true       # app pods are NOT scheduled here
    temporary_name_for_rotation  = "tmpagent" # lets Terraform change vm_size safely
  }

  # Nodes come from our own node pools + cluster autoscaler (not Karpenter auto-provisioning)
  node_provisioning_profile {
    mode = "Manual"
  }

  # Control plane uses the identity from step 6
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aks.id]
  }

  # Azure CNI Overlay + Cilium. These CIDRs must NOT overlap the VNet (10.0.0.0/16)
  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    network_data_plane  = "cilium"        # Cilium dataplane (eBPF)
    network_policy      = "cilium"        # Cilium enforces NetworkPolicies
    pod_cidr            = "10.244.0.0/16" # pod IPs
    service_cidr        = "10.100.0.0/16" # ClusterIP service IPs
    dns_service_ip      = "10.100.0.10"   # must be inside service_cidr
    load_balancer_sku   = "standard"
  }

  # API server is public, but only YOUR IP can reach it
  api_server_access_profile {
    authorized_ip_ranges = ["49.207.55.249/32"]
  }

  # Zero trust: login with Entra ID only, permissions via Azure RBAC
  local_account_disabled = true
  azure_active_directory_role_based_access_control {
    tenant_id          = data.azurerm_client_config.current.tenant_id
    azure_rbac_enabled = true
  }

  # Workload Identity: pods access Azure without secrets (used with Key Vault)
  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  # ---------------- Azure add-ons ----------------

  # Add-on 1: Azure Policy guardrails (engine only; policies are assigned separately)
  azure_policy_enabled = true

  # Add-on 2: Istio service mesh (Azure-managed Istio + public ingress gateway)
  service_mesh_profile {
    mode                             = "Istio"
    revisions                        = ["asm-1-30"] # newest; supports Kubernetes 1.32-1.37
    internal_ingress_gateway_enabled = false        # no private (VNet-only) gateway for now
    external_ingress_gateway_enabled = true         # public ingress gateway (Azure public IP)
  }

  # Add-on 3: Key Vault Secrets Provider = secret store CSI driver
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "2m" # re-read secrets from Key Vault every 2 minutes
  }

  # Add-on 4: Container Insights (logs to Log Analytics; ingestion capped at 0.5 GB/day)
  oms_agent {
    log_analytics_workspace_id      = azurerm_log_analytics_workspace.law.id
    msi_auth_for_monitoring_enabled = true # managed identity auth, no workspace keys
  }

  # Add-on 5: Managed Prometheus metrics agent (sends metrics to section 9)
  monitor_metrics {}

  tags = {
    environment = "dev"
  }

  # Subnet permission must exist before the cluster is created
  depends_on = [azurerm_role_assignment.aks_subnet_network_contributor]

  # The cluster autoscaler changes the node count at runtime; Terraform must not report it as drift
  lifecycle {
    ignore_changes = [default_node_pool[0].node_count]
  }
}

# Nodes (kubelet identity) may pull images from ACR, no imagePullSecrets needed
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
}

# -----------------------------------------------------------------------
# 8. User node pool "userpool": your apps run here
# -----------------------------------------------------------------------
resource "azurerm_kubernetes_cluster_node_pool" "userpool" {
  name                  = "userpool"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.aks.id
  mode                  = "User"
  vm_size               = "Standard_D2ads_v5"
  os_type               = "Linux"
  os_sku                = "Ubuntu"
  vnet_subnet_id        = azurerm_subnet.aks.id
  auto_scaling_enabled  = true
  min_count             = 1
  max_count             = 3
  tags = {
    environment = "dev"
  }

  # The cluster autoscaler changes the node count at runtime; Terraform must not report it as drift
  lifecycle {
    ignore_changes = [node_count]
  }
}

# -----------------------------------------------------------------------
# 9. Managed Prometheus
#    Flow: AKS metrics agent -> endpoint (DCE) -> rule (DCR) -> Azure Monitor workspace
# -----------------------------------------------------------------------

# Where Prometheus metrics are stored (Azure-managed Prometheus database)
resource "azurerm_monitor_workspace" "amw" {
  name                = "amw-krconnects-dev-cin-001"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  tags = {
    environment = "dev"
  }
}

# Endpoint the metrics agent sends data to
resource "azurerm_monitor_data_collection_endpoint" "dce" {
  name                = "dce-prometheus-krconnects-dev-cin-001"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  kind                = "Linux"
  tags = {
    environment = "dev"
  }
}

# Rule: "take Prometheus metrics and write them into the monitor workspace"
resource "azurerm_monitor_data_collection_rule" "dcr" {
  name                        = "dcr-prometheus-krconnects-dev-cin-001"
  resource_group_name         = azurerm_resource_group.rg.name
  location                    = azurerm_resource_group.rg.location
  kind                        = "Linux"
  data_collection_endpoint_id = azurerm_monitor_data_collection_endpoint.dce.id

  destinations {
    monitor_account {
      monitor_account_id = azurerm_monitor_workspace.amw.id
      name               = "MonitoringAccount1"
    }
  }

  data_flow {
    streams      = ["Microsoft-PrometheusMetrics"]
    destinations = ["MonitoringAccount1"]
  }

  data_sources {
    prometheus_forwarder {
      streams = ["Microsoft-PrometheusMetrics"]
      name    = "PrometheusDataSource"
    }
  }

  tags = {
    environment = "dev"
  }
}

# Attach the rule to the AKS cluster
resource "azurerm_monitor_data_collection_rule_association" "dcra" {
  name                    = "dcra-prometheus-aks-krconnects-dev"
  target_resource_id      = azurerm_kubernetes_cluster.aks.id
  data_collection_rule_id = azurerm_monitor_data_collection_rule.dcr.id
}

# -----------------------------------------------------------------------
# 10. Alert rules (recommended basics) + where to send them
# -----------------------------------------------------------------------

# Action group: who gets notified (email)
resource "azurerm_monitor_action_group" "ag" {
  name                = "ag-krconnects-dev-cin-001"
  resource_group_name = azurerm_resource_group.rg.name
  short_name          = "krcalerts" # max 12 characters, shown in SMS/email

  email_receiver {
    name                    = "krishnaReddy"
    email_address           = "ckreddy3030.net@gmail.com"
    use_common_alert_schema = true
  }

  tags = {
    environment = "dev"
  }
}

# Alert 1: node CPU above 80% for 15 minutes
resource "azurerm_monitor_metric_alert" "node_cpu" {
  name                = "alert-aks-node-cpu-high"
  resource_group_name = azurerm_resource_group.rg.name
  scopes              = [azurerm_kubernetes_cluster.aks.id]
  description         = "Node CPU usage above 80%"
  severity            = 2       # 0 = critical ... 4 = verbose
  frequency           = "PT5M"  # check every 5 minutes
  window_size         = "PT15M" # look at the last 15 minutes

  criteria {
    metric_namespace = "Microsoft.ContainerService/managedClusters"
    metric_name      = "node_cpu_usage_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.ag.id
  }
}

# Alert 2: node memory above 80% for 15 minutes
resource "azurerm_monitor_metric_alert" "node_memory" {
  name                = "alert-aks-node-memory-high"
  resource_group_name = azurerm_resource_group.rg.name
  scopes              = [azurerm_kubernetes_cluster.aks.id]
  description         = "Node memory working set above 80%"
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.ContainerService/managedClusters"
    metric_name      = "node_memory_working_set_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.ag.id
  }
}

# Alert 3: any pod in Failed phase
resource "azurerm_monitor_metric_alert" "pods_failed" {
  name                = "alert-aks-pods-failed"
  resource_group_name = azurerm_resource_group.rg.name
  scopes              = [azurerm_kubernetes_cluster.aks.id]
  description         = "One or more pods are in Failed state"
  severity            = 1
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.ContainerService/managedClusters"
    metric_name      = "kube_pod_status_phase"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 0

    dimension {
      name     = "phase"
      operator = "Include"
      values   = ["Failed"]
    }
  }

  action {
    action_group_id = azurerm_monitor_action_group.ag.id
  }
}

# -----------------------------------------------------------------------
# 11. Give YOUR user cluster-admin
#     (local accounts are disabled, so without this nobody can use kubectl)
# -----------------------------------------------------------------------
resource "azurerm_role_assignment" "aks_admin" {
  scope                = azurerm_kubernetes_cluster.aks.id
  role_definition_name = "Azure Kubernetes Service RBAC Cluster Admin"
  principal_id         = "69d8ab41-6beb-41f8-a9b6-2b605d3067d9"
}


#End of file
