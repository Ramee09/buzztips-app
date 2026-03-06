#!/bin/bash
# ============================================================
# BuzzTips - Azure Infrastructure Setup Script
# Run this ONCE to provision all Azure resources
# ============================================================
set -e

RESOURCE_GROUP="buzztips-rg"
LOCATION="eastus"
ACR_NAME="buzztipsacr"
AKS_CLUSTER="buzztips-aks"

echo "🐝 Setting up BuzzTips Azure Infrastructure..."

# 1. Create Resource Group
echo "📦 Creating Resource Group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Create Azure Container Registry (ACR)
echo "🐳 Creating Container Registry..."
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# 3. Create AKS Cluster
echo "☸️  Creating AKS Cluster..."
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER \
  --node-count 2 \
  --node-vm-size Standard_B2s \
  --enable-addons monitoring \
  --generate-ssh-keys \
  --attach-acr $ACR_NAME

# 4. Get AKS credentials
echo "🔑 Getting AKS credentials..."
az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER

# 5. Install NGINX Ingress Controller
echo "🌐 Installing NGINX Ingress..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz

# 6. Install cert-manager (for TLS)
echo "🔒 Installing cert-manager for TLS..."
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# 7. Create namespace and deploy app
echo "🚀 Deploying BuzzTips..."
kubectl apply -f k8s/deployment.yaml

# 8. Get ingress IP for DNS setup
echo ""
echo "✅ Infrastructure ready!"
echo ""
echo "⏳ Getting Load Balancer IP (may take 2-3 mins)..."
sleep 60
INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo ""
echo "============================================="
echo "🌍 DNS SETUP REQUIRED:"
echo "  Point buzztips.com → $INGRESS_IP"
echo "  Add A record: @ → $INGRESS_IP"
echo "  Add A record: www → $INGRESS_IP"
echo "============================================="
echo ""
echo "🐝 BuzzTips will be live at https://buzztips.com once DNS propagates!"
