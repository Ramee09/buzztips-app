# 🐝 BuzzTips — Business Intelligence Platform

> Find all businesses near you, visualize them on a map, and get AI-powered suggestions for businesses that would thrive in any area.

**Live at:** [https://buzztips.com](https://buzztips.com)

> Find all businesses near you, visualize them on a map, and get AI-powered suggestions for businesses that would thrive in any area.

**Live at:** [https://buzztips.com](https://buzztips.com)

---

## 🏗️ Architecture

```
                    buzztips.com (DNS)
                         │
                    ┌────▼────┐
                    │  Azure  │
                    │  AKS    │ ← Kubernetes Cluster
                    │ Ingress │
                    └────┬────┘
              ┌──────────┴──────────┐
              │                     │
        ┌─────▼──────┐       ┌──────▼─────┐
        │  Frontend  │       │  Backend   │
        │   React    │       │  Node.js   │
        │  (nginx)   │       │  Express   │
        └────────────┘       └──────┬─────┘
                                    │
                          ┌─────────┼─────────┐
                          │                   │
                   ┌──────▼──────┐   ┌────────▼──────┐
                   │ Google      │   │  Anthropic    │
                   │ Places API  │   │  Claude API   │
                   └─────────────┘   └───────────────┘
```

## 📁 Project Structure

```
buzztips/
├── frontend/               # React app
│   ├── src/App.jsx         # Main application
│   ├── Dockerfile          # Multi-stage build
│   └── nginx.conf          # Nginx + API proxy
├── backend/                # Node.js API
│   ├── server.js           # Express server
│   └── Dockerfile          # Hardened production image
├── k8s/
│   └── deployment.yaml     # AKS: Deployments, Services, Ingress, HPA
├── .github/
│   └── workflows/
│       └── ci-cd.yml       # GitHub Actions CI/CD (alternative)
├── Jenkinsfile             # Jenkins CI/CD pipeline
├── docker-compose.yml      # Local development
└── azure-setup.sh          # One-time Azure infrastructure setup
```

---

## 🚀 Quick Start

### 1. Clone & Setup
```bash
git clone https://github.com/YOUR_ORG/buzztips.git
cd buzztips
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Run Locally
```bash
docker-compose up --build
# App: http://localhost:3000
# API: http://localhost:5000
```

### 3. Required API Keys
| Key | Where to get |
|-----|-------------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `GOOGLE_PLACES_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) → Places API |

---

## ☁️ Deploy to Azure

### Step 1: Provision Infrastructure (once)
```bash
az login
chmod +x azure-setup.sh
./azure-setup.sh
```
This creates:
- Azure Resource Group
- Azure Container Registry (ACR)
- AKS Cluster (2 nodes)
- NGINX Ingress Controller
- cert-manager (auto TLS via Let's Encrypt)

### Step 2: Set DNS
After setup, the script prints your Load Balancer IP. Go to your domain registrar and add:
```
A record:  @    → <INGRESS_IP>
A record:  www  → <INGRESS_IP>
```

### Step 3: Add Secrets to Kubernetes
```bash
kubectl create secret generic buzztips-secrets \
  --from-literal=ANTHROPIC_API_KEY=your_key \
  --from-literal=GOOGLE_PLACES_API_KEY=your_key \
  -n buzztips
```

---

## 🔧 Jenkins CI/CD Setup

### Jenkins Credentials to Add
| ID | Type | Description |
|----|------|-------------|
| `azure-acr-credentials` | Username/Password | ACR username + password |
| `azure-service-principal` | Azure Service Principal | For AKS deployment |

### Get ACR credentials
```bash
az acr credential show --name buzztipsacr
```

### Create Azure Service Principal
```bash
az ad sp create-for-rbac \
  --name buzztips-jenkins \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/buzztips-rg
```

### Pipeline Flow
```
Checkout → Test → Build Images → Push to ACR → Deploy to AKS → Smoke Test
```
- Auto-rollback on failure
- Only deploys on `main` branch
- Parallel build for frontend and backend

---

## 🌟 Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Live Map** | Dark-themed interactive map with business pins |
| 🏷️ **Category Filters** | Filter by restaurant, cafe, gym, retail, health, hotel |
| 🤖 **AI Suggestions** | Claude analyzes the area and recommends thriving businesses |
| 📊 **Fit Score** | AI rates each suggestion 0-100% for that specific area |
| 📍 **Geolocation** | Auto-detects your location |
| 🔍 **Search** | Search any city, area, or zip code |
| 📱 **Responsive** | Works on desktop and mobile |
| ♾️ **Auto-scaling** | HPA scales pods 2→10 based on CPU load |

---

## 📡 API Endpoints

```
GET  /api/businesses?lat=40.71&lng=-74.00&radius=1000  → List nearby businesses
POST /api/suggest   { businesses, location }            → AI business suggestions
GET  /health                                             → Health check
```

---

## 🏷️ Tech Stack

- **Frontend:** React 18, Leaflet.js, Vite
- **Backend:** Node.js, Express
- **AI:** Anthropic Claude (claude-sonnet-4-20250514)
- **Maps:** Google Places API + OpenStreetMap tiles
- **Container:** Docker (multi-stage builds)
- **CI/CD:** Jenkins + GitHub Actions
- **Cloud:** Azure Kubernetes Service (AKS)
- **Registry:** Azure Container Registry (ACR)
- **DNS:** buzztips.com → AKS Ingress
- **TLS:** cert-manager + Let's Encrypt
