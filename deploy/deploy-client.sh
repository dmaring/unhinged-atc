#!/bin/bash
# Unhinged ATC - Client Deployment Script
# Deploy React client to Cloud Storage with Cloud CDN

set -e

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${PROJECT_ID:-unhinged-atc-prod}"
BUCKET_NAME="${BUCKET_NAME:-openatc-client}"
DOMAIN="${DOMAIN:-openatc.app}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Unhinged ATC - Client Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Project: $PROJECT_ID"
echo "Bucket: gs://$BUCKET_NAME"
echo "Domain: https://$DOMAIN"
echo ""

# Build client
echo -e "${YELLOW}[1/4] Building client for production...${NC}"
cd packages/client

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "✗ .env.production not found!"
    echo "Creating default .env.production..."
    cat > .env.production <<EOF
VITE_WS_URL=wss://$DOMAIN
VITE_API_URL=https://$DOMAIN
NODE_ENV=production
EOF
fi

# Build
pnpm build

if [ ! -d "dist" ]; then
    echo "✗ Build failed - dist directory not found"
    exit 1
fi

echo -e "${GREEN}✓ Client built successfully${NC}"

# Create bucket if it doesn't exist
echo -e "${YELLOW}[2/4] Setting up Cloud Storage bucket...${NC}"
cd ../..

if ! gsutil ls -b "gs://$BUCKET_NAME" &>/dev/null; then
    echo "Creating bucket: gs://$BUCKET_NAME"
    gsutil mb -l us-central1 "gs://$BUCKET_NAME"

    # Enable static website hosting
    gsutil web set -m index.html -e index.html "gs://$BUCKET_NAME"

    # Make bucket public
    gsutil iam ch allUsers:objectViewer "gs://$BUCKET_NAME"

    echo -e "${GREEN}✓ Bucket created and configured${NC}"
else
    echo "✓ Bucket already exists"
fi

# Upload files to Cloud Storage
echo -e "${YELLOW}[3/4] Uploading files to Cloud Storage...${NC}"

# Set cache headers for different file types
echo "  Uploading assets with 1-year cache..."
gsutil -m -h "Cache-Control:public, max-age=31536000, immutable" \
    rsync -r -d packages/client/dist/assets/ "gs://$BUCKET_NAME/assets/" \
    2>/dev/null || true

echo "  Uploading HTML with short cache..."
gsutil -h "Cache-Control:public, max-age=300" \
    cp packages/client/dist/index.html "gs://$BUCKET_NAME/index.html"

echo "  Uploading other files..."
gsutil -m -h "Cache-Control:public, max-age=3600" \
    rsync -r -d -x ".*\.html$|assets/.*" \
    packages/client/dist/ "gs://$BUCKET_NAME/" \
    2>/dev/null || true

echo -e "${GREEN}✓ Files uploaded successfully${NC}"

# Setup Cloud CDN (if not already configured)
echo -e "${YELLOW}[4/4] Configuring Cloud CDN...${NC}"

# Check if backend bucket exists
if ! gcloud compute backend-buckets describe atc-static-backend --global &>/dev/null; then
    echo "Creating backend bucket for CDN..."
    gcloud compute backend-buckets create atc-static-backend \
        --gcs-bucket-name="$BUCKET_NAME" \
        --enable-cdn

    echo "Updating URL map to include static assets..."
    # Note: This requires the load balancer to be already set up
    # The URL map configuration would be updated here

    echo -e "${YELLOW}⚠ Manual step required: Update load balancer URL map to route static assets through CDN${NC}"
    echo "  gcloud compute url-maps add-path-matcher atc-url-map \\"
    echo "    --path-matcher-name=static-matcher \\"
    echo "    --default-service=atc-backend-service \\"
    echo "    --backend-bucket-path-rules='/assets/*=atc-static-backend,/*.ico=atc-static-backend,/*.png=atc-static-backend'"
else
    echo "✓ Backend bucket already configured"
fi

# Invalidate CDN cache
echo "Invalidating CDN cache..."
if gcloud compute url-maps describe atc-url-map --global &>/dev/null; then
    gcloud compute url-maps invalidate-cdn-cache atc-url-map \
        --path="/*" \
        --global \
        --async
    echo -e "${GREEN}✓ CDN cache invalidation requested (may take a few minutes)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Client Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Client URL: https://$DOMAIN"
echo "Bucket: gs://$BUCKET_NAME"
echo ""
echo "Testing deployment:"
echo "  curl -I https://$DOMAIN"
echo ""
echo "View files:"
echo "  gsutil ls -r gs://$BUCKET_NAME"
echo ""
echo "If changes don't appear immediately, wait 1-2 minutes for CDN cache to update."
