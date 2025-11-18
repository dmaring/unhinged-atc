# Docker Containerization Options for Unhinged ATC

This document explores Docker containerization strategies for the Unhinged ATC project, analyzing current architecture and providing recommendations for both development and production deployments.

**Date:** November 2025
**Status:** Exploration and planning phase

---

## Current Architecture Summary

Unhinged ATC currently uses a **monolithic deployment model**:
- Server serves both API/WebSocket AND static client files in production
- Single Node.js process handles everything (Express + Socket.io + static file serving)
- Server expects client dist at `../../client/dist` (relative path)
- Current GCP deployment: builds on VM startup via startup script, runs via systemd
- Deployment flow: GitHub → VM startup script → git pull → pnpm install → build → systemd service

**Project Structure (pnpm monorepo):**
- `packages/client` - React 18 + Vite frontend (360KB dist)
- `packages/server` - Node.js + Express + Socket.io backend (408KB dist)
- `packages/shared` - Shared TypeScript types/constants (124KB dist)
- Build dependency chain: shared → server, shared → client

**Production Build Details:**
- Shared: TypeScript compilation (`tsc`) → `dist/` with types and constants
- Server: TypeScript compilation → `dist/` with server code (~30MB production node_modules)
- Client: Vite build → `dist/` with optimized static assets (HTML + hashed JS/CSS bundles)
- Server serves client static files in production via `express.static()`

---

## Docker Containerization Strategies

### **Option 1: Single Container (Monolithic)** ⭐ Easiest Migration

Matches current architecture exactly.

**Architecture:**
```
┌─────────────────────────────┐
│   Docker Container          │
│  ┌─────────────────────┐   │
│  │  Node.js Server     │   │
│  │  (Express+Socket.io)│   │
│  │         ↓           │   │
│  │  Serves client/dist │   │
│  │  (static files)     │   │
│  └─────────────────────┘   │
│         Port 3000           │
└─────────────────────────────┘
```

**Pros:**
- Simple, single image to manage
- Matches existing deployment model exactly
- No architecture changes needed to application code
- Single health check endpoint
- Easy rollbacks (change image tag)

**Cons:**
- Larger image size (~200-400MB)
- Can't scale frontend/backend independently
- Rebuilding backend requires rebuilding entire image
- Couples frontend and backend deployment cycles

**Use Cases:**
- Quick Docker adoption with minimal changes
- Small-to-medium traffic applications
- Simplified operations and deployment
- Teams wanting to minimize operational complexity

**Image Size:** ~200MB (optimized with Alpine + multi-stage build)

---

### **Option 2: Multi-Container (Microservices)**

Separate client and server into distinct containers.

**Architecture:**
```
┌──────────────┐      ┌──────────────┐
│  nginx       │      │   Node.js    │
│  Container   │◄────►│   Server     │
│ (static      │      │ (API+WS only)│
│  files)      │      │              │
│  Port 80     │      │  Port 3000   │
└──────────────┘      └──────────────┘
     ~20MB                 ~150MB
```

**Pros:**
- Smaller individual images (client ~20MB, server ~150MB)
- Independent scaling (more client replicas vs fewer server replicas)
- CDN-friendly architecture (serve client from edge locations)
- Clear separation of concerns
- Can update frontend without redeploying backend

**Cons:**
- More complex orchestration (requires Docker Compose/Kubernetes)
- CORS/WebSocket configuration more complex
- Requires nginx or CDN setup for client
- Health checks for multiple services
- More moving parts to manage

**Use Cases:**
- High traffic with different scaling needs for static vs dynamic content
- Want to leverage CDN for static assets
- Microservices architecture preference
- Teams with container orchestration expertise

**Total Size:** ~170MB (nginx + Node.js)

---

### **Option 3: Hybrid Development/Production** ⭐ Recommended

Different strategies for dev vs prod environments.

**Development Architecture:**
```
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Client    │  │  Server    │  │   Shared   │
│  Vite HMR  │◄─┤  tsx watch │◄─┤   Build    │
│  Port 5173 │  │  Port 3000 │  │            │
└────────────┘  └────────────┘  └────────────┘
    (hot reload, fast iteration)
```

**Production Architecture:**
```
┌─────────────────────────────┐
│   Optimized Single Image    │
│   Node.js + Static Assets   │
│         Port 3000           │
└─────────────────────────────┘
    (matches current GCP model)
```

**Pros:**
- Best of both worlds approach
- Development: Fast hot-reload, no container rebuilds
- Production: Simple, optimized single image
- Can use docker-compose for local development
- Production image matches current architecture (easy migration)

**Cons:**
- Two sets of Docker configurations to maintain
- Slightly more complex initial setup
- Need to ensure dev and prod environments stay in sync

**Use Cases:**
- Teams wanting excellent local development experience
- Production simplicity preferred
- **Current recommendation for Unhinged ATC**
- Balance between developer productivity and operational simplicity

---

### **Option 4: Cloud Run / Serverless Containers**

Leverage Google Cloud Run for auto-scaling containers.

**Architecture:**
```
Cloud Run Service (Container)
├─ Auto-scales 0→N instances based on traffic
├─ Built-in load balancer
├─ Automatic HTTPS/SSL certificates
├─ Integrated with Cloud CDN
└─ Pay-per-request pricing model
```

**Pros:**
- Serverless benefits (scale to zero, pay-per-use)
- Automatic HTTPS/SSL certificate management
- No instance/VM management required
- Built-in load balancing and auto-scaling
- Faster cold starts than Cloud Functions
- WebSocket support via HTTP/2

**Cons:**
- WebSocket connections have 60-minute timeout (acceptable for most games)
- Slightly higher cost at sustained high traffic vs dedicated VMs
- Cold starts if traffic drops to zero (mitigated with min-instances)
- Stateful connections more challenging (Socket.io handles reconnection)

**Use Cases:**
- Variable/unpredictable traffic patterns
- Don't want to manage VMs or clusters
- Want automatic scaling without configuration
- Cost optimization for low-traffic periods

**Deployment Command:**
```bash
gcloud run deploy unhinged-atc \
  --image gcr.io/PROJECT/unhinged-atc:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars CORS_ORIGIN=https://yourdomain.com \
  --min-instances 1 \
  --max-instances 10
```

---

## Recommended Approach: Hybrid with Production-First Focus

Based on goals of exploring modernization, keeping deployment options open, potential future scaling needs, and focus on production-ready CI/CD, we recommend **Option 3: Hybrid Development/Production**.

### Implementation Phases

#### **Phase 1: Production-First Docker Setup** (Start Here)

Build a production-optimized single container that can deploy **anywhere**:
- ✅ Google Cloud Run (serverless)
- ✅ GCP Compute Engine (current setup)
- ✅ Kubernetes/GKE
- ✅ AWS ECS/Fargate
- ✅ Azure Container Apps
- ✅ Any Docker host

**Deliverables:**
- Multi-stage `Dockerfile` producing ~200MB optimized image
- Contains: Node.js runtime + server code + client static files
- Runs on port 3000, serves everything from single process
- `.dockerignore` for efficient builds

**Benefits:**
- Matches current architecture (no app code changes)
- Build once in CI/CD, deploy anywhere
- Easy migration path from current GCP VMs
- Can switch deployment targets without rebuilding application

---

#### **Phase 2: Local Development with Docker Compose** (Optional)

Add developer experience improvements:

**Deliverables:**
- `docker-compose.yml` for local development
- Three services: shared, server, client
- Volume mounts for hot-reload
- Health checks and dependency ordering

**Benefits:**
- New developers: `git clone → docker compose up → start coding`
- No local Node.js/pnpm installation required
- Consistent development environment across team
- Fast hot-reload without rebuilding containers

---

#### **Phase 3: Migration Path to Microservices** (Future)

If independent scaling becomes necessary:

```
Current:  [Single Container]
            ↓
Option A: [Single Container → Cloud Run with CDN]
            ↓
Option B: [Split to: nginx (client) + Node (server) containers]
```

The initial Dockerfile structure allows easy splitting because builds are already separated into stages.

---

## Technical Implementation Details

### Production Dockerfile Structure

```dockerfile
# Stage 1: Base setup
FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# Stage 2: Install dependencies (cached layer)
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN pnpm install --frozen-lockfile

# Stage 3: Build shared package
FROM dependencies AS build-shared
COPY packages/shared ./packages/shared
RUN cd packages/shared && pnpm build

# Stage 4: Build server (depends on shared)
FROM dependencies AS build-server
COPY --from=build-shared /app/packages/shared/dist ./packages/shared/dist
COPY packages/server ./packages/server
RUN cd packages/server && pnpm build

# Stage 5: Build client (depends on shared)
FROM dependencies AS build-client
COPY --from=build-shared /app/packages/shared/dist ./packages/shared/dist
COPY packages/client ./packages/client
ARG VITE_WS_URL
ARG VITE_API_URL
RUN cd packages/client && pnpm build

# Stage 6: Production runtime (final image)
FROM node:20-alpine AS production
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for workspace structure
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Copy built artifacts
COPY --from=build-shared /app/packages/shared/dist ./packages/shared/dist
COPY --from=build-server /app/packages/server/dist ./packages/server/dist
COPY --from=build-client /app/packages/client/dist ./packages/client/dist

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "packages/server/dist/index.js"]
```

**Image Size Breakdown:**
- Base: Node 20 Alpine (~50MB)
- Production dependencies (~30MB)
- Built artifacts (~900KB)
- pnpm + overhead (~120MB)
- **Total: ~200MB**

---

### Environment Variable Strategy

**Build-time (ARG) - Client Vite Variables:**
```dockerfile
ARG VITE_WS_URL=wss://example.com
ARG VITE_API_URL=https://example.com
# Used during client build, values baked into JavaScript bundle
```

**Runtime (ENV) - Server Variables:**
```dockerfile
ENV PORT=3000
ENV NODE_ENV=production
# Set during docker run or deployment:
# - CORS_ORIGIN (e.g., https://yourdomain.com)
# - ANTHROPIC_API_KEY (from secrets)
# - OPENAI_API_KEY (from secrets)
# - ADMIN_PASSWORD (optional)
```

**Deployment Examples:**

Cloud Run:
```bash
gcloud run deploy unhinged-atc \
  --image=gcr.io/PROJECT/unhinged-atc:latest \
  --set-env-vars="CORS_ORIGIN=https://yourdomain.com" \
  --set-secrets="ANTHROPIC_API_KEY=anthropic-key:latest"
```

Docker run:
```bash
docker run -p 3000:3000 \
  -e CORS_ORIGIN=https://yourdomain.com \
  -e ANTHROPIC_API_KEY=$KEY \
  unhinged-atc:latest
```

---

### Key Technical Considerations

#### 1. Workspace Dependencies

**Challenge:** `"shared": "workspace:*"` references in package.json

**Solutions:**
- **Option A (Recommended):** Preserve workspace structure in container
  - Copy entire workspace layout
  - Run `pnpm install` at root level
  - Maintains workspace protocol

- **Option B:** Flatten dependencies
  - Replace `workspace:*` with `file:../shared`
  - More complex, requires package.json manipulation

- **Option C:** Use `pnpm deploy`
  - Prunes workspace to production dependencies only
  - More advanced, requires testing

**Chosen Approach:** Option A - Preserve workspace structure (simplest, most reliable)

---

#### 2. Build Order Dependencies

**Critical Requirement:** Shared package must build before server and client

**Dockerfile Implementation:**
```dockerfile
# Stage 3: Build shared first
FROM dependencies AS build-shared
COPY packages/shared ./packages/shared
RUN cd packages/shared && pnpm build

# Stages 4 & 5: Copy shared/dist before building server/client
COPY --from=build-shared /app/packages/shared/dist ./packages/shared/dist
```

**Benefits of Multi-stage:**
- Parallel builds where possible (server and client can build in parallel after shared completes)
- Layer caching (only rebuild what changed)
- Smaller final image (only production artifacts)

---

#### 3. Image Size Optimization

**Strategies Applied:**
- ✅ Alpine Linux base (~50MB vs ~200MB for standard Node image)
- ✅ Multi-stage builds (drop build tools from final image)
- ✅ Production-only dependencies (`pnpm install --prod`)
- ✅ Layer caching for node_modules (rebuild only when dependencies change)
- ✅ Exclude unnecessary files via `.dockerignore`

**Layer Caching Strategy:**
```dockerfile
# 1. Copy package files first (rarely change)
COPY package.json pnpm-lock.yaml ./

# 2. Install dependencies (cached until lockfile changes)
RUN pnpm install --frozen-lockfile

# 3. Copy source code (changes frequently)
COPY packages/ ./packages/

# Result: Dependency install only runs when lockfile changes
```

---

#### 4. .dockerignore Configuration

**Files to Exclude:**
```
# Dependencies (installed fresh in container)
node_modules
packages/*/node_modules

# Build artifacts (built in container)
dist
packages/*/dist

# Development files
.git
.github
.claude
.env
.env.*

# Test artifacts
test-results
playwright-report
coverage

# Documentation
*.md
docs

# IDE
.vscode
.idea

# Misc
.DS_Store
*.log
```

**Impact:** Reduces build context from ~500MB to ~50MB (faster builds)

---

## CI/CD Pipeline Design

### GitHub Actions Workflow

**File:** `.github/workflows/docker-build.yml`

```yaml
name: Build and Deploy Docker Image

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: gcr.io
  IMAGE_NAME: ${{ secrets.GCP_PROJECT_ID }}/unhinged-atc

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configure Docker for GCR
        run: gcloud auth configure-docker

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            VITE_WS_URL=${{ secrets.VITE_WS_URL }}
            VITE_API_URL=${{ secrets.VITE_API_URL }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy unhinged-atc \
            --image ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest \
            --platform managed \
            --region us-central1 \
            --allow-unauthenticated \
            --set-env-vars CORS_ORIGIN=${{ secrets.CORS_ORIGIN }} \
            --min-instances 1 \
            --max-instances 10
```

**Features:**
- ✅ Builds on PR (validation)
- ✅ Pushes on main branch merge
- ✅ Semantic versioning from git tags
- ✅ GitHub Actions cache for faster builds
- ✅ Auto-deploy to Cloud Run on main
- ✅ Multiple image tags (latest, SHA, semver)

---

### Local Development with Docker Compose

**File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  shared:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: shared
    volumes:
      - ./packages/shared:/app/packages/shared
      - shared-dist:/app/packages/shared/dist
    command: pnpm --filter shared build --watch

  server:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: server
    ports:
      - "3000:3000"
    volumes:
      - ./packages/server:/app/packages/server
      - shared-dist:/app/packages/shared/dist:ro
    environment:
      - NODE_ENV=development
      - PORT=3000
    command: pnpm --filter server dev
    depends_on:
      - shared
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  client:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: client
    ports:
      - "5173:5173"
    volumes:
      - ./packages/client:/app/packages/client
      - shared-dist:/app/packages/shared/dist:ro
    environment:
      - VITE_WS_URL=ws://localhost:3000
      - VITE_API_URL=http://localhost:3000
    command: pnpm --filter client dev
    depends_on:
      - shared
      - server

volumes:
  shared-dist:
```

**Usage:**
```bash
# Start all services
docker compose up

# Start specific service
docker compose up server

# Rebuild after dependency changes
docker compose up --build

# View logs
docker compose logs -f server

# Stop all services
docker compose down
```

---

## Deployment Target Comparison

### Option A: Google Cloud Run (Recommended)

**Best For:** Serverless deployment with minimal operations

**Pros:**
- ✅ Easiest migration from current GCP setup
- ✅ Serverless (no VM management)
- ✅ Auto-scaling (0→N instances based on traffic)
- ✅ Automatic HTTPS/SSL certificates
- ✅ Pay-per-request pricing
- ✅ 30-second deployments
- ✅ Built-in load balancing
- ✅ WebSocket support (60min timeout)

**Cons:**
- ❌ WebSocket 60-minute timeout (acceptable for most game sessions)
- ❌ Slightly higher cost at sustained high traffic
- ❌ Less control over infrastructure

**Deployment:**
```bash
# Initial deployment
gcloud run deploy unhinged-atc \
  --image gcr.io/PROJECT/unhinged-atc:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10

# Update deployment
gcloud run services update unhinged-atc \
  --image gcr.io/PROJECT/unhinged-atc:v2.0.0

# Rollback
gcloud run services update-traffic unhinged-atc \
  --to-revisions=unhinged-atc-00005-abc=100
```

**Cost Estimate (1000 daily users):** $20-40/month

---

### Option B: GCP Compute Engine with Docker

**Best For:** Maximum control, predictable costs

**Pros:**
- ✅ Keep existing infrastructure familiarity
- ✅ Full control over VMs
- ✅ No WebSocket limitations
- ✅ Predictable costs
- ✅ Can use existing managed instance groups

**Cons:**
- ❌ Still managing VMs
- ❌ Manual scaling configuration
- ❌ More operational overhead

**Changes from Current:**
- Replace startup script build with `docker pull + docker run`
- Faster deployments (no build on VM, ~2min vs ~8min)
- Easier rollbacks (change image tag, ~30sec)

**Deployment Script:**
```bash
#!/bin/bash
# deploy/docker-deploy-gce.sh

# Pull latest image
gcloud compute instances update-container INSTANCE_NAME \
  --zone us-central1-a \
  --container-image gcr.io/PROJECT/unhinged-atc:latest \
  --container-env CORS_ORIGIN=https://yourdomain.com
```

**Cost Estimate:** $30-50/month (same as current)

---

### Option C: Google Kubernetes Engine (GKE)

**Best For:** Enterprise-scale, complex deployments

**Pros:**
- ✅ Production-grade orchestration
- ✅ Advanced scaling/networking capabilities
- ✅ Multi-region support
- ✅ Future-proof for microservices
- ✅ Rolling updates and canary deployments
- ✅ Service mesh integration (Istio)

**Cons:**
- ❌ Overkill for current scale
- ❌ Higher complexity and learning curve
- ❌ Higher minimum cost (~$70/month for cluster)
- ❌ Requires Kubernetes expertise

**When to Consider:**
- Multiple microservices to orchestrate
- Advanced traffic management needs (A/B testing, canary)
- Multi-region deployment required
- Team has Kubernetes expertise

**Cost Estimate:** $70-150/month

---

## Cost Comparison

**Estimated monthly costs for ~1000 daily active users:**

| Deployment Option | Monthly Cost | Deployment Time | Rollback Time | Complexity |
|------------------|--------------|-----------------|---------------|------------|
| **Current GCP VMs** | $30-50 | 5-8 minutes | 5-8 minutes | Medium |
| **Cloud Run** | $20-40 | 30 seconds | 10 seconds | Low |
| **GCE + Docker** | $30-50 | 2 minutes | 30 seconds | Medium |
| **GKE** | $70-150 | 2 minutes | 1 minute | High |

**Recommendation:** Start with Cloud Run for best cost/simplicity balance

---

## Migration Path Example

### Current State
```
Developer pushes to main
  ↓
GitHub webhook triggers deployment
  ↓
GCP instance startup script:
  - git pull from GitHub
  - pnpm install (5-8 minutes)
  - pnpm build (all packages)
  - systemd restart service
```
**Total time:** 5-8 minutes
**Rollback:** Redeploy previous commit (5-8 minutes)

---

### Future State with Docker (Cloud Run)
```
Developer pushes to main
  ↓
GitHub Actions triggered:
  - Build Docker image (2-3 minutes, cached)
  - Push to Google Artifact Registry
  ↓
Auto-deploy to Cloud Run:
  - Pull new image
  - Rolling update (30 seconds)
  - Zero downtime
```
**Total time:** 2-3 minutes
**Rollback:** Revert to previous image tag (30 seconds)

---

### Benefits of Migration

**Faster Deployments:**
- Current: 5-8 minutes (build on VM)
- Docker: 2-3 minutes (pre-built image)
- **Improvement: 60% faster**

**Instant Rollbacks:**
- Current: Redeploy previous commit (5-8 minutes)
- Docker: Tag previous image (30 seconds)
- **Improvement: 90% faster**

**Consistency:**
- Current: Build on VM (potential environment drift)
- Docker: Build in CI, same image everywhere
- **Improvement: Guaranteed consistency**

**Developer Experience:**
- Current: Install Node, pnpm, manage versions
- Docker: `docker compose up` and start coding
- **Improvement: 5-minute onboarding**

---

## Next Steps and Implementation Plan

### Quick Start (2-3 hours)
**Goal:** Get production Docker build working locally

1. Create production `Dockerfile` with multi-stage build
2. Create `.dockerignore` for efficient builds
3. Build and test locally:
   ```bash
   docker build -t unhinged-atc .
   docker run -p 3000:3000 unhinged-atc
   ```
4. Verify application works (open http://localhost:3000)

**Deliverables:**
- `Dockerfile` (production build)
- `.dockerignore`
- Local validation

---

### Full Setup (4-6 hours)
**Goal:** Complete CI/CD pipeline to Cloud Run

5. Create `docker-compose.yml` for local development
6. Set up GitHub Actions workflow (`.github/workflows/docker-build.yml`)
7. Configure Google Artifact Registry
8. Deploy to Cloud Run
9. Update documentation in `CLAUDE.md` and `README.md`
10. Create deployment scripts with rollback support

**Deliverables:**
- Complete Docker setup
- Automated CI/CD pipeline
- Cloud Run deployment
- Updated documentation
- Deployment runbooks

---

### Files to Create

```
unhinged-atc/
├── Dockerfile                           # Production multi-stage build
├── Dockerfile.dev                       # Development build (optional)
├── .dockerignore                        # Exclude unnecessary files
├── docker-compose.yml                   # Local development
├── docker-compose.prod.yml              # Local production testing
├── .github/
│   └── workflows/
│       └── docker-build.yml             # CI/CD pipeline
└── deploy/
    ├── docker-deploy-cloudrun.sh        # Cloud Run deployment
    ├── docker-deploy-gce.sh             # GCE deployment (optional)
    └── docker-rollback.sh               # Rollback script
```

---

## Decision Matrix

Use this matrix to choose your deployment strategy:

| If you want... | Choose... | Why |
|---------------|-----------|-----|
| Simplest migration | **Cloud Run** | Serverless, minimal config, matches architecture |
| Maximum control | **GCE + Docker** | Keep VMs, full control, predictable costs |
| Zero ops burden | **Cloud Run** | No VM management, auto-scaling, auto-SSL |
| Future microservices | **GKE** or **Cloud Run** | Can split containers later |
| Lowest cost | **Cloud Run** | Pay-per-request, scale to zero |
| Predictable costs | **GCE + Docker** | Fixed VM costs |
| Great local dev | **Hybrid + Compose** | Hot-reload, no rebuilds |

---

## Conclusion

**Recommended Path:**
1. **Start:** Production Dockerfile + Cloud Run deployment
2. **Then:** Add docker-compose for local development
3. **Future:** Split to microservices if scaling needs diverge

This approach provides:
- ✅ Quick migration (minimal code changes)
- ✅ Deployment flexibility (any cloud provider)
- ✅ Improved developer experience
- ✅ Production-ready CI/CD
- ✅ Easy rollbacks and updates
- ✅ Future-proof architecture

**Estimated effort:** 4-6 hours for complete implementation

---

## Additional Resources

**Docker Best Practices:**
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Layer caching](https://docs.docker.com/build/cache/)
- [Alpine Linux](https://hub.docker.com/_/node)

**Google Cloud:**
- [Cloud Run documentation](https://cloud.google.com/run/docs)
- [Artifact Registry](https://cloud.google.com/artifact-registry)
- [GKE](https://cloud.google.com/kubernetes-engine)

**pnpm + Docker:**
- [pnpm in Docker](https://pnpm.io/docker)
- [Workspace protocol](https://pnpm.io/workspaces)
