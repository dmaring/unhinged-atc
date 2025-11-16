#!/bin/bash
# Unhinged ATC - Create Deployment Package
# Creates a deployment tarball and uploads to Cloud Storage

set -e

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

PROJECT_ID="${PROJECT_ID:-unhinged-atc-prod}"
BUCKET_NAME="${DEPLOY_BUCKET:-${PROJECT_ID}-deploy}"
PACKAGE_NAME="unhinged-atc-deploy.tar.gz"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Unhinged ATC - Create Deployment Package${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Project: $PROJECT_ID"
echo "Bucket: gs://$BUCKET_NAME"
echo "Package: $PACKAGE_NAME"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    echo -e "${RED}✗ Error: Must run from repository root${NC}"
    echo "Current directory: $(pwd)"
    exit 1
fi

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}✗ Error: gcloud CLI not found${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set the GCP project
echo -e "${YELLOW}[1/6] Setting GCP project...${NC}"
gcloud config set project "$PROJECT_ID" --quiet
echo -e "${GREEN}✓ Project set to $PROJECT_ID${NC}"

# Create Cloud Storage bucket if it doesn't exist
echo -e "${YELLOW}[2/6] Ensuring deployment bucket exists...${NC}"
if gsutil ls -b "gs://$BUCKET_NAME" &>/dev/null; then
    echo "✓ Bucket gs://$BUCKET_NAME already exists"
else
    echo "Creating bucket: gs://$BUCKET_NAME"
    gsutil mb -l us-central1 "gs://$BUCKET_NAME"

    # Enable versioning for rollback capability
    gsutil versioning set on "gs://$BUCKET_NAME"

    echo -e "${GREEN}✓ Bucket created with versioning enabled${NC}"
fi

# Install dependencies
echo -e "${YELLOW}[3/6] Installing dependencies...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}✗ Error: pnpm not found${NC}"
    echo "Install with: npm install -g pnpm"
    exit 1
fi

pnpm install --frozen-lockfile
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Build packages
echo -e "${YELLOW}[4/6] Building packages...${NC}"

# Build shared package
echo "  Building shared package..."
cd packages/shared
pnpm build
cd ../..

# Build server package
echo "  Building server package..."
cd packages/server
pnpm build
cd ../..

# Build client package
echo "  Building client package..."
cd packages/client

# Create production environment file (will be overwritten by startup script with correct domain)
cat > .env.production <<EOF
VITE_WS_URL=wss://DOMAIN_PLACEHOLDER
VITE_API_URL=https://DOMAIN_PLACEHOLDER
EOF

pnpm build
cd ../..

echo -e "${GREEN}✓ All packages built successfully${NC}"

# Create tarball
echo -e "${YELLOW}[5/6] Creating deployment package...${NC}"

# Remove old tarball if it exists
rm -f "/tmp/$PACKAGE_NAME"

# Create tarball with only necessary files
tar -czf "/tmp/$PACKAGE_NAME" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='*.log' \
    --exclude='test-results' \
    --exclude='coverage' \
    packages/ \
    pnpm-lock.yaml \
    package.json \
    pnpm-workspace.yaml

# Check tarball size
TARBALL_SIZE=$(du -h "/tmp/$PACKAGE_NAME" | cut -f1)
echo "Package size: $TARBALL_SIZE"

echo -e "${GREEN}✓ Deployment package created${NC}"

# Upload to Cloud Storage
echo -e "${YELLOW}[6/6] Uploading to Cloud Storage...${NC}"

# Create backup of previous version if it exists
if gsutil ls "gs://$BUCKET_NAME/$PACKAGE_NAME" &>/dev/null; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    echo "  Backing up previous version to backups/$TIMESTAMP-$PACKAGE_NAME"
    gsutil cp "gs://$BUCKET_NAME/$PACKAGE_NAME" "gs://$BUCKET_NAME/backups/$TIMESTAMP-$PACKAGE_NAME"
fi

# Upload new version
gsutil cp "/tmp/$PACKAGE_NAME" "gs://$BUCKET_NAME/$PACKAGE_NAME"

# Verify upload
if gsutil ls "gs://$BUCKET_NAME/$PACKAGE_NAME" &>/dev/null; then
    echo -e "${GREEN}✓ Package uploaded successfully${NC}"
else
    echo -e "${RED}✗ Upload verification failed${NC}"
    exit 1
fi

# Clean up local tarball
rm "/tmp/$PACKAGE_NAME"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Package Created!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Bucket: gs://$BUCKET_NAME/$PACKAGE_NAME"
echo "Size: $TARBALL_SIZE"
echo ""
echo "Next steps:"
echo "  1. Deploy new instances: gcloud compute instance-groups managed rolling-action replace atc-mig --zone=\$ZONE"
echo "  2. Or create new instance template with updated startup script"
echo ""
echo "View all versions:"
echo "  gsutil ls gs://$BUCKET_NAME/backups/"
echo ""
