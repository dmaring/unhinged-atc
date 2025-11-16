# Unhinged ATC - GCP Deployment Guide

This guide walks you through deploying Unhinged ATC to Google Cloud Platform with enterprise-grade security including DDoS protection, WAF, and auto-scaling.

## Architecture Overview

```
Internet → Cloud Armor (DDoS + WAF) → Load Balancer (SSL/HTTPS)
    → Managed Instance Group (Auto-scaling 1-5 VMs)
    → VPC Firewall (Zero-trust rules)
    → Monitoring & Alerts
```

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and configured
   ```bash
   # Install gcloud CLI
   curl https://sdk.cloud.google.com | bash

   # Initialize and authenticate
   gcloud init
   gcloud auth login
   ```

3. **Domain name** with DNS access (e.g., unhingedatc.com)

4. **Local environment** with pnpm installed
   ```bash
   npm install -g pnpm
   ```

## Cost Estimate

**Monthly costs:**
- Low traffic (100 users): ~$85-150/month
- Medium traffic (500 users): ~$238/month
- High traffic (2000+ users): ~$827+/month

**Free tier credit**: $300 for new accounts (90 days)

---

## Step-by-Step Deployment

### Phase 1: Initial Setup (15 minutes)

#### 1.1 Create GCP Project

```bash
# Create new project
PROJECT_ID="unhinged-atc-prod"
gcloud projects create $PROJECT_ID --name="Unhinged ATC Production"

# Set as default project
gcloud config set project $PROJECT_ID

# Link billing account (replace BILLING_ACCOUNT_ID)
gcloud billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

#### 1.2 Configure Environment Variables

Create `.env` file in the `deploy/` directory:

```bash
# deploy/.env
PROJECT_ID=unhinged-atc-prod
REGION=us-central1
ZONE=us-central1-a
DOMAIN=unhingedatc.com
REPO_URL=https://github.com/YOUR_USERNAME/unhinged-atc.git
NOTIFICATION_EMAIL=your-email@gmail.com
```

Load environment:
```bash
source deploy/.env
export PROJECT_ID REGION ZONE DOMAIN REPO_URL NOTIFICATION_EMAIL
```

#### 1.3 Make Scripts Executable

```bash
cd deploy
chmod +x *.sh
```

---

### Phase 2: Infrastructure Deployment (30 minutes)

#### 2.1 Run Main Deployment Script

```bash
./deploy.sh
```

This script will:
1. ✓ Enable required GCP APIs
2. ✓ Reserve static IP address
3. ✓ Create secrets in Secret Manager
4. ✓ Configure VPC firewall rules
5. ✓ Create health check
6. ✓ Create instance template with startup script
7. ✓ Create managed instance group with auto-scaling
8. ✓ Create backend service
9. ✓ Configure Cloud Armor security policy
10. ✓ Create SSL certificate
11. ✓ Create load balancer (URL map, proxy, forwarding rule)
12. ✓ Setup monitoring and alerting

**Expected prompts:**
- Static IP address will be displayed - **configure DNS A record**
- Enter Anthropic API key (or skip)
- Enter OpenAI API key (or skip)
- Enter notification email for alerts

#### 2.2 Configure DNS

After the script displays the load balancer IP:

```
Load Balancer IP: 34.102.xxx.xxx
```

Add DNS A record:
```
Type: A
Name: @  (or unhingedatc.com)
Value: 34.102.xxx.xxx
TTL: 300
```

Wait 5-10 minutes for DNS propagation.

#### 2.3 Verify SSL Certificate Provisioning

```bash
# Check SSL certificate status
gcloud compute ssl-certificates describe atc-ssl-cert --global

# Status should change from PROVISIONING → ACTIVE (takes 15-60 min)
```

---

### Phase 3: Deploy Client (10 minutes)

#### 3.1 Update Client Environment

Verify `packages/client/.env.production` contains:

```
VITE_WS_URL=wss://unhingedatc.com
VITE_API_URL=https://unhingedatc.com
NODE_ENV=production
```

Replace `unhingedatc.com` with your domain.

#### 3.2 Run Client Deployment

```bash
./deploy-client.sh
```

This will:
1. Build React client for production
2. Create Cloud Storage bucket
3. Upload files with cache headers
4. Configure Cloud CDN

---

### Phase 4: Verification (15 minutes)

#### 4.1 Check Instance Health

```bash
# View instance status
gcloud compute instances list

# Check health
gcloud compute backend-services get-health atc-backend-service --global
```

Expected output:
```
status:
  healthStatus:
  - healthState: HEALTHY
```

#### 4.2 View Instance Logs

```bash
# View recent logs
gcloud logging read "resource.type=gce_instance" --limit 50 --format=json

# Follow live logs
gcloud logging tail "resource.type=gce_instance"
```

Look for:
```
✓ Unhinged ATC server is running successfully!
```

#### 4.3 Test Application

```bash
# Test health endpoint
curl https://unhingedatc.com/health

# Expected response:
# {"status":"ok","timestamp":1234567890}

# Test WebSocket (requires websocat or browser)
# Open browser: https://unhingedatc.com
```

#### 4.4 View Security Logs

```bash
# View Cloud Armor denials
gcloud logging read 'resource.type="http_load_balancer" AND jsonPayload.enforcedSecurityPolicy.outcome="DENY"' --limit 20

# View firewall logs
gcloud logging read 'resource.type="gce_firewall_rule"' --limit 20
```

---

## Security Features

### Cloud Armor (DDoS + WAF Protection)

**Configured rules:**
- ✓ Rate limiting: 20 WebSocket connections/min per IP
- ✓ XSS protection (OWASP rules)
- ✓ SQL injection protection
- ✓ LFI/RCE blocking
- ✓ Bot detection and blocking
- ✓ Rate-based IP banning (100 req/min triggers 10-min ban)

**View policy:**
```bash
gcloud compute security-policies describe atc-security-policy
```

### VPC Firewall Rules

**Configured rules:**
- ✓ Allow: Load balancer health checks only
- ✓ Allow: SSH via Identity-Aware Proxy (IAP) only
- ✗ Deny: Direct SSH from internet
- ✗ Deny: Direct access to application port

**Test SSH access:**
```bash
# Connect via IAP (secure)
gcloud compute ssh INSTANCE_NAME --zone=$ZONE --tunnel-through-iap

# Direct SSH will be blocked
```

### Application Security

**Server middleware:**
- ✓ Helmet: Security headers (CSP, HSTS, etc.)
- ✓ Rate limiting: 100 HTTP requests/min per IP
- ✓ Socket.IO rate limiting: 10 connections/min per IP
- ✓ CORS: Strict origin validation
- ✓ Input validation: Username length, profanity filter

---

## Monitoring & Alerting

### Configured Alerts

Alerts sent to: `$NOTIFICATION_EMAIL`

1. **High 4xx rate** (> 1000/min) - Potential DDoS attack
2. **Backend unhealthy** (5xx errors) - Instance failure
3. **High CPU** (> 85%) - Scaling needed
4. **SSL expiring** (< 30 days) - Certificate renewal issue
5. **Cloud Armor denials** (> 100/min) - Security events

### Dashboards

```bash
# View in Google Cloud Console
open "https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
```

### Log Queries

```bash
# View all errors
gcloud logging read "severity=ERROR" --limit 50

# View security events
gcloud logging read 'jsonPayload.enforcedSecurityPolicy.name="atc-security-policy"' --limit 50

# View game events
gcloud logging read "resource.type=gce_instance AND textPayload:\"GameRoom\"" --limit 50
```

---

## Maintenance

### Update Application Code

```bash
# Option 1: Rolling update (zero downtime)
# 1. Push code to GitHub
# 2. Create new instance template with updated code
gcloud compute instance-templates create atc-server-template-v2 \
    --source-instance-template=atc-server-template

# 3. Update MIG
gcloud compute instance-groups managed set-instance-template atc-mig \
    --template=atc-server-template-v2 --zone=$ZONE

# 4. Rolling update
gcloud compute instance-groups managed rolling-action start-update atc-mig \
    --version=template=atc-server-template-v2 \
    --max-surge=1 --max-unavailable=0 \
    --zone=$ZONE

# Option 2: Manual instance recreation
gcloud compute instance-groups managed recreate-instances atc-mig \
    --instances=INSTANCE_NAME --zone=$ZONE
```

### Update Client

```bash
# From repo root
./deploy/deploy-client.sh
```

### Scale Manually

```bash
# Temporarily increase instances
gcloud compute instance-groups managed resize atc-mig --size=5 --zone=$ZONE

# Auto-scaling will override this after cooldown period
```

### View Costs

```bash
# View billing
open "https://console.cloud.google.com/billing?project=$PROJECT_ID"

# Set budget alerts (recommended)
gcloud billing budgets create \
    --billing-account=BILLING_ACCOUNT_ID \
    --display-name="Unhinged ATC Budget" \
    --budget-amount=200USD \
    --threshold-rule=percent=50 \
    --threshold-rule=percent=90 \
    --threshold-rule=percent=100
```

---

## Troubleshooting

### Issue: SSL Certificate Stuck in PROVISIONING

**Cause:** DNS not configured correctly or not propagated

**Solution:**
```bash
# 1. Verify DNS
nslookup unhingedatc.com
# Should return the load balancer IP

# 2. Wait 15-60 minutes for Google to provision

# 3. If still stuck after 60 min, delete and recreate
gcloud compute ssl-certificates delete atc-ssl-cert --global
gcloud compute ssl-certificates create atc-ssl-cert --domains=$DOMAIN --global
```

### Issue: Instances Unhealthy

**Cause:** Application not starting, health check failing

**Solution:**
```bash
# 1. Check instance logs
gcloud compute instances list
gcloud logging read "resource.type=gce_instance AND resource.labels.instance_id=INSTANCE_ID" --limit 100

# 2. SSH into instance
gcloud compute ssh INSTANCE_NAME --zone=$ZONE --tunnel-through-iap

# 3. Check service status
sudo systemctl status unhinged-atc.service
sudo journalctl -u unhinged-atc.service -n 100

# 4. Common fixes:
#    - Missing secrets: Check Secret Manager
#    - Port conflict: Ensure port 3000 is free
#    - Build failed: Check Node.js version, pnpm install logs
```

### Issue: 503 Service Unavailable

**Cause:** No healthy instances in backend

**Solution:**
```bash
# Check backend health
gcloud compute backend-services get-health atc-backend-service --global

# If all unhealthy, check:
# 1. Firewall allows health checks
gcloud compute firewall-rules list --filter="targetTags:atc-server"

# 2. Instance can respond to /health
curl http://INSTANCE_INTERNAL_IP:3000/health
```

### Issue: Cloud Armor Blocking Legitimate Traffic

**Cause:** False positives in WAF rules

**Solution:**
```bash
# 1. View denied requests
gcloud logging read 'jsonPayload.enforcedSecurityPolicy.outcome="DENY"' --limit 50

# 2. Identify rule causing false positive

# 3. Update or disable rule
gcloud compute security-policies rules update RULE_PRIORITY \
    --security-policy=atc-security-policy \
    --action=allow

# 4. Or add exception
gcloud compute security-policies rules create NEW_PRIORITY \
    --security-policy=atc-security-policy \
    --expression="origin.ip == 'TRUSTED_IP'" \
    --action=allow
```

### Issue: High Costs

**Cause:** Excessive egress, too many instances, Cloud Armor requests

**Solution:**
```bash
# 1. Check cost breakdown
open "https://console.cloud.google.com/billing/reports?project=$PROJECT_ID"

# 2. Enable Cloud CDN more aggressively (reduce egress)
# Update client deployment script cache headers

# 3. Reduce max instances
gcloud compute instance-groups managed set-autoscaling atc-mig \
    --zone=$ZONE \
    --max-num-replicas=3

# 4. Use committed use discounts (37-55% savings)
# Reserve instances for 1 or 3 years
```

---

## Cleanup / Teardown

To delete all resources and stop billing:

```bash
# WARNING: This deletes EVERYTHING. Backup data first!

# Delete load balancer components
gcloud compute forwarding-rules delete atc-https-rule --global --quiet
gcloud compute target-https-proxies delete atc-https-proxy --global --quiet
gcloud compute url-maps delete atc-url-map --global --quiet
gcloud compute ssl-certificates delete atc-ssl-cert --global --quiet

# Delete backend and health check
gcloud compute backend-services delete atc-backend-service --global --quiet
gcloud compute health-checks delete atc-health-check --quiet

# Delete Cloud Armor policy
gcloud compute security-policies delete atc-security-policy --quiet

# Delete instance group and template
gcloud compute instance-groups managed delete atc-mig --zone=$ZONE --quiet
gcloud compute instance-templates delete atc-server-template --quiet

# Delete firewall rules
gcloud compute firewall-rules delete allow-health-checks --quiet
gcloud compute firewall-rules delete allow-lb-traffic --quiet
gcloud compute firewall-rules delete allow-iap-ssh --quiet
gcloud compute firewall-rules delete deny-ssh-from-internet --quiet
gcloud compute firewall-rules delete deny-direct-access --quiet

# Delete static IP
gcloud compute addresses delete atc-lb-ip --global --quiet

# Delete secrets
gcloud secrets delete anthropic-api-key --quiet
gcloud secrets delete openai-api-key --quiet

# Delete client bucket
gsutil -m rm -r gs://unhingedatc-client
gcloud compute backend-buckets delete atc-static-backend --global --quiet

echo "✓ All resources deleted"
```

---

## Next Steps

After successful deployment:

1. **Review Security Checklist** - See `SECURITY_CHECKLIST.md`
2. **Test Load** - Simulate traffic to verify auto-scaling
3. **Setup CI/CD** - Automate deployments with Cloud Build or GitHub Actions
4. **Add Database** - If needed, deploy Cloud SQL or Firestore
5. **Multi-Region** - Deploy to additional regions for global users
6. **Optimize Costs** - Review usage and enable committed use discounts

---

## Support & Resources

- **GCP Documentation**: https://cloud.google.com/docs
- **Cloud Armor**: https://cloud.google.com/armor/docs
- **Monitoring**: https://cloud.google.com/monitoring/docs
- **Cost Calculator**: https://cloud.google.com/products/calculator

For issues specific to Unhinged ATC, see repository issues.
