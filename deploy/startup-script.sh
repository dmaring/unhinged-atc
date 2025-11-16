#!/bin/bash
# Unhinged ATC - VM Startup Script
# This script runs on each new VM instance to set up the Node.js server

set -e

echo "Starting Unhinged ATC server setup..."

# Update system packages
apt-get update
apt-get install -y unattended-upgrades git curl

# Configure automatic security updates (non-interactive)
echo 'APT::Periodic::Update-Package-Lists "1";' > /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/20auto-upgrades

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install pnpm globally
npm install -g pnpm

# Fetch metadata from instance
echo "Fetching instance metadata..."
PROJECT_ID=$(curl -s "http://metadata.google.internal/computeMetadata/v1/project/project-id" -H "Metadata-Flavor: Google")
REPO_URL=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/repo-url" -H "Metadata-Flavor: Google" 2>/dev/null || echo "https://github.com/dmaring/unhinged-atc.git")
DOMAIN=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/domain" -H "Metadata-Flavor: Google" 2>/dev/null || echo "localhost")

echo "Project ID: $PROJECT_ID"
echo "Repository: $REPO_URL"
echo "Domain: $DOMAIN"

# Clone repository
echo "Cloning application code from GitHub..."
GIT_TERMINAL_PROMPT=0 git clone --depth 1 "$REPO_URL" /opt/unhinged-atc

cd /opt/unhinged-atc

# Install dependencies
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Build shared package
echo "Building shared package..."
cd packages/shared
pnpm build
cd ../..

# Build server package
echo "Building server package..."
cd packages/server
pnpm build
cd ../..

# Build client package
echo "Building client package..."
cd packages/client
# Create production environment file
cat > .env.production <<EOF
VITE_WS_URL=wss://${DOMAIN}
VITE_API_URL=https://${DOMAIN}

# Google Analytics 4 Measurement ID
VITE_GA_MEASUREMENT_ID=G-E1253L4R2Y
EOF
pnpm build
cd ../..

# Fetch secrets from Secret Manager
echo "Fetching secrets from Secret Manager..."
export ANTHROPIC_API_KEY=$(gcloud secrets versions access latest --secret=anthropic-api-key --project="$PROJECT_ID" 2>/dev/null || echo "")
export OPENAI_API_KEY=$(gcloud secrets versions access latest --secret=openai-api-key --project="$PROJECT_ID" 2>/dev/null || echo "")

# Create environment file for server
cat > packages/server/.env <<EOF
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://${DOMAIN}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
EOF

# Create systemd service file
cat > /etc/systemd/system/unhinged-atc.service <<EOF
[Unit]
Description=Unhinged ATC Game Server
Documentation=https://github.com/YOUR_USERNAME/unhinged-atc
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/unhinged-atc/packages/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=unhinged-atc

# Environment
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=GOOGLE_CLOUD_PROJECT=$PROJECT_ID
Environment=GCP_PROJECT=$PROJECT_ID

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/unhinged-atc

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable unhinged-atc.service

# Start the service
echo "Starting Unhinged ATC service..."
systemctl start unhinged-atc.service

# Wait for service to be ready
echo "Waiting for service to start..."
sleep 15

# Health check
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✓ Unhinged ATC server is running successfully!"
    systemctl status unhinged-atc.service --no-pager
else
    echo "✗ Health check failed. Checking logs..."
    journalctl -u unhinged-atc.service -n 50 --no-pager
    exit 1
fi

echo "Startup script completed successfully."
