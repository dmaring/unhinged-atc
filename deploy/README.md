# Unhinged ATC - Deployment Scripts

This directory contains all scripts and documentation for deploying Unhinged ATC to Google Cloud Platform with enterprise-grade security.

## Quick Start

```bash
# 1. Configure environment variables
export PROJECT_ID="your-project-id"
export DOMAIN="your-domain.com"
export REGION="us-central1"
export ZONE="us-central1-a"

# 2. Run deployment
cd deploy
./deploy.sh

# 3. Deploy client
./deploy-client.sh
```

## Files Overview

### Deployment Scripts

| File | Purpose | Run Order |
|------|---------|-----------|
| `deploy.sh` | Main deployment orchestrator | 1st |
| `startup-script.sh` | VM initialization script | Auto (embedded in deploy.sh) |
| `cloud-armor.sh` | DDoS protection & WAF setup | Auto (called by deploy.sh) |
| `firewall-rules.sh` | VPC firewall configuration | Auto (called by deploy.sh) |
| `monitoring.sh` | Alerts & monitoring setup | Auto (called by deploy.sh) |
| `deploy-client.sh` | React client deployment | 2nd (after deploy.sh) |

### Configuration Files

| File | Purpose |
|------|---------|
| `.env` | Environment variables (create this yourself) |
| `packages/client/.env.production` | Client production config |

### Documentation

| File | Purpose |
|------|---------|
| `DEPLOYMENT.md` | Complete deployment guide |
| `SECURITY_CHECKLIST.md` | Security checklist & incident response |
| `README.md` | This file |

## Architecture

```
┌─────────────────────────────────────────────┐
│    Cloud Armor (DDoS + WAF Protection)      │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│   Load Balancer (HTTPS/SSL Termination)     │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  Managed Instance Group (Auto-scaling 1-5)  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │  VM 1   │  │  VM 2   │  │  VM 3   │     │
│  │Node.js  │  │Node.js  │  │Node.js  │     │
│  └─────────┘  └─────────┘  └─────────┘     │
└─────────────────────────────────────────────┘
```

## Security Features

✅ **DDoS Protection**: Cloud Armor with rate limiting
✅ **WAF**: XSS, SQLi, LFI, RCE blocking
✅ **Firewall**: Zero-trust VPC rules
✅ **SSL/TLS**: Auto-managed certificates (supports apex + www subdomain)
✅ **Monitoring**: Real-time alerts
✅ **IAP**: Secure SSH access

## Cost Estimate

- **Low traffic** (100 users): ~$85-150/month
- **Medium traffic** (500 users): ~$238/month
- **High traffic** (2000+ users): ~$827+/month

## Prerequisites

1. Google Cloud account with billing enabled
2. gcloud CLI installed and authenticated
3. Domain name with DNS access
4. pnpm installed locally

## Deployment Steps

### 1. Initial Setup

```bash
# Install gcloud CLI if needed
curl https://sdk.cloud.google.com | bash
gcloud init
gcloud auth login

# Create GCP project
gcloud projects create your-project-id
gcloud config set project your-project-id

# Link billing account
gcloud billing projects link your-project-id \
    --billing-account=BILLING_ACCOUNT_ID
```

### 2. Configure Environment

Create `deploy/.env`:
```bash
PROJECT_ID=your-project-id
REGION=us-central1
ZONE=us-central1-a
DOMAIN=yourdomain.com  # SSL cert will include both yourdomain.com and www.yourdomain.com
REPO_URL=https://github.com/YOUR_USERNAME/unhinged-atc.git
NOTIFICATION_EMAIL=alerts@yourdomain.com
```

Load environment:
```bash
source deploy/.env
export PROJECT_ID REGION ZONE DOMAIN REPO_URL NOTIFICATION_EMAIL
```

### 3. Deploy Infrastructure

```bash
cd deploy
./deploy.sh
```

**This will:**
- Create static IP and display it
- Prompt for DNS configuration (wait for you to configure)
- Create secrets (will prompt for API keys)
- Deploy all GCP infrastructure
- Configure security policies
- Setup monitoring and alerts

**Time**: ~30-45 minutes (including SSL cert provisioning)

### 4. Deploy Client

```bash
./deploy-client.sh
```

**This will:**
- Build React client for production
- Create Cloud Storage bucket
- Upload files with proper cache headers
- Configure Cloud CDN

**Time**: ~5-10 minutes

### 5. Verify Deployment

```bash
# Check instance health
gcloud compute backend-services get-health atc-backend-service --global

# Test application
curl https://yourdomain.com/health

# View logs
gcloud logging tail "resource.type=gce_instance"
```

## Updating Deployment

### Update Server Code

```bash
# Option 1: Rolling update (recommended)
# 1. Push code to GitHub
# 2. Run rolling update
gcloud compute instance-groups managed rolling-action replace atc-mig \
    --zone=$ZONE

# Option 2: Manual instance recreation
gcloud compute instance-groups managed recreate-instances atc-mig \
    --instances=INSTANCE_NAME --zone=$ZONE
```

### Update Client

```bash
./deploy-client.sh
```

## Troubleshooting

### SSL Certificate Not Provisioning

**Cause:** DNS not configured or propagated

**Fix:**
```bash
# Verify DNS for both apex and www subdomain
nslookup yourdomain.com
nslookup www.yourdomain.com

# Wait 15-60 minutes for Google to provision certificate
# Note: Production uses versioned certificates (e.g., atc-ssl-cert-v2)
gcloud compute ssl-certificates list --global
gcloud compute ssl-certificates describe atc-ssl-cert-v2 --global
```

### Instances Unhealthy

**Cause:** Application not starting or health check failing

**Fix:**
```bash
# Check logs
gcloud logging read "resource.type=gce_instance AND severity>=ERROR" --limit 50

# SSH into instance
gcloud compute ssh INSTANCE_NAME --zone=$ZONE --tunnel-through-iap

# Check service
sudo systemctl status unhinged-atc.service
sudo journalctl -u unhinged-atc.service -n 100
```

### 503 Errors

**Cause:** No healthy backends

**Fix:**
```bash
# Check backend health
gcloud compute backend-services get-health atc-backend-service --global

# Verify firewall allows health checks
gcloud compute firewall-rules list --filter="targetTags:atc-server"
```

## Monitoring

### View Logs

```bash
# All logs
gcloud logging read "resource.type=gce_instance" --limit 50

# Errors only
gcloud logging read "severity>=ERROR" --limit 50

# Security events
gcloud logging read 'jsonPayload.enforcedSecurityPolicy.outcome="DENY"' --limit 50

# Follow live
gcloud logging tail "resource.type=gce_instance"
```

### Check Costs

```bash
# Open billing dashboard
open "https://console.cloud.google.com/billing?project=$PROJECT_ID"

# Set budget alerts
gcloud billing budgets create \
    --billing-account=BILLING_ACCOUNT_ID \
    --display-name="Unhinged ATC Budget" \
    --budget-amount=200USD \
    --threshold-rule=percent=50 \
    --threshold-rule=percent=90
```

## Cleanup

To delete all resources and stop billing:

```bash
# WARNING: This deletes EVERYTHING
# Run each command and confirm

gcloud compute forwarding-rules delete atc-https-rule --global --quiet
gcloud compute target-https-proxies delete atc-https-proxy --global --quiet
gcloud compute url-maps delete atc-url-map --global --quiet
# Delete all SSL certificates (adjust version number as needed)
gcloud compute ssl-certificates delete atc-ssl-cert-v2 --global --quiet
gcloud compute backend-services delete atc-backend-service --global --quiet
gcloud compute health-checks delete atc-health-check --quiet
gcloud compute security-policies delete atc-security-policy --quiet
gcloud compute instance-groups managed delete atc-mig --zone=$ZONE --quiet
gcloud compute instance-templates delete atc-server-template --quiet
gcloud compute firewall-rules delete allow-health-checks --quiet
gcloud compute firewall-rules delete allow-lb-traffic --quiet
gcloud compute firewall-rules delete allow-iap-ssh --quiet
gcloud compute firewall-rules delete deny-ssh-from-internet --quiet
gcloud compute firewall-rules delete deny-direct-access --quiet
gcloud compute addresses delete atc-lb-ip --global --quiet
gsutil -m rm -r gs://unhingedatc-client
```

## Support

For detailed instructions, see:
- **DEPLOYMENT.md** - Complete deployment guide
- **SECURITY_CHECKLIST.md** - Security checklist & incident response

For GCP issues:
- [GCP Documentation](https://cloud.google.com/docs)
- [Cloud Armor Docs](https://cloud.google.com/armor/docs)
- [GCP Support](https://cloud.google.com/support)

For application issues:
- See repository issues on GitHub
