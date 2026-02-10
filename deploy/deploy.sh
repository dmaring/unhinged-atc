#!/bin/bash
# Unhinged ATC - GCP Deployment Script
# This script provisions all GCP infrastructure with security hardening

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - CUSTOMIZE THESE VALUES
PROJECT_ID="${PROJECT_ID:-unhinged-atc-prod}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-a}"
DOMAIN="${DOMAIN:-openatc.app}"
REPO_URL="${REPO_URL:-https://github.com/dmaring/unhinged-atc.git}"

# Derived values
MIG_NAME="atc-mig"
TEMPLATE_NAME="atc-server-template"
BACKEND_SERVICE="atc-backend-service"
HEALTH_CHECK="atc-health-check"
SECURITY_POLICY="atc-security-policy"
SSL_CERT="atc-ssl-cert"
LB_IP_NAME="atc-lb-ip"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Unhinged ATC - GCP Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Zone: $ZONE"
echo "Domain: $DOMAIN"
echo ""

# Confirm before proceeding
read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Set project
echo -e "${YELLOW}[1/12] Setting up GCP project...${NC}"
gcloud config set project "$PROJECT_ID"
gcloud config set compute/region "$REGION"
gcloud config set compute/zone "$ZONE"

# Enable required APIs
echo -e "${YELLOW}[2/12] Enabling required APIs...${NC}"
gcloud services enable compute.googleapis.com \
    secretmanager.googleapis.com \
    logging.googleapis.com \
    monitoring.googleapis.com \
    cloudresourcemanager.googleapis.com

# Reserve static IP
echo -e "${YELLOW}[3/12] Reserving static IP address...${NC}"
if ! gcloud compute addresses describe "$LB_IP_NAME" --global &>/dev/null; then
    gcloud compute addresses create "$LB_IP_NAME" \
        --ip-version=IPV4 \
        --global
fi

LB_IP=$(gcloud compute addresses describe "$LB_IP_NAME" --global --format='value(address)')
echo -e "${GREEN}✓ Load Balancer IP: $LB_IP${NC}"
echo -e "${YELLOW}⚠ Configure DNS: Add A record for $DOMAIN pointing to $LB_IP${NC}"
read -p "Press Enter after DNS is configured..."

# Create secrets (interactive)
echo -e "${YELLOW}[4/12] Setting up secrets in Secret Manager...${NC}"
if ! gcloud secrets describe anthropic-api-key &>/dev/null; then
    read -sp "Enter Anthropic API Key (or press Enter to skip): " ANTHROPIC_KEY
    echo
    if [ -n "$ANTHROPIC_KEY" ]; then
        echo -n "$ANTHROPIC_KEY" | gcloud secrets create anthropic-api-key --data-file=-
        echo -e "${GREEN}✓ Anthropic API key stored${NC}"
    fi
fi

if ! gcloud secrets describe openai-api-key &>/dev/null; then
    read -sp "Enter OpenAI API Key (or press Enter to skip): " OPENAI_KEY
    echo
    if [ -n "$OPENAI_KEY" ]; then
        echo -n "$OPENAI_KEY" | gcloud secrets create openai-api-key --data-file=-
        echo -e "${GREEN}✓ OpenAI API key stored${NC}"
    fi
fi

# Grant compute service account access to secrets
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
COMPUTE_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

for secret in anthropic-api-key openai-api-key; do
    if gcloud secrets describe "$secret" &>/dev/null; then
        gcloud secrets add-iam-policy-binding "$secret" \
            --member="serviceAccount:$COMPUTE_SA" \
            --role=roles/secretmanager.secretAccessor \
            --condition=None &>/dev/null || true
    fi
done

# Create firewall rules
echo -e "${YELLOW}[5/12] Creating VPC firewall rules...${NC}"
./firewall-rules.sh

# Create health check
echo -e "${YELLOW}[6/12] Creating health check...${NC}"
if ! gcloud compute health-checks describe "$HEALTH_CHECK" &>/dev/null; then
    gcloud compute health-checks create http "$HEALTH_CHECK" \
        --port=3000 \
        --request-path=/health \
        --check-interval=10s \
        --timeout=5s \
        --healthy-threshold=2 \
        --unhealthy-threshold=3
fi

# Create instance template
echo -e "${YELLOW}[7/12] Creating instance template...${NC}"
if ! gcloud compute instance-templates describe "$TEMPLATE_NAME" &>/dev/null; then
    gcloud compute instance-templates create "$TEMPLATE_NAME" \
        --machine-type=e2-medium \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --boot-disk-size=20GB \
        --boot-disk-type=pd-standard \
        --tags=atc-server \
        --metadata=startup-script="$(cat startup-script.sh)",domain="$DOMAIN",repo-url="$REPO_URL" \
        --scopes=cloud-platform \
        --network-interface=network=default,no-address
fi

# Create managed instance group
echo -e "${YELLOW}[8/12] Creating Managed Instance Group...${NC}"
if ! gcloud compute instance-groups managed describe "$MIG_NAME" --zone="$ZONE" &>/dev/null; then
    gcloud compute instance-groups managed create "$MIG_NAME" \
        --template="$TEMPLATE_NAME" \
        --size=1 \
        --zone="$ZONE" \
        --health-check="$HEALTH_CHECK" \
        --initial-delay=300

    # Set named ports
    gcloud compute instance-groups managed set-named-ports "$MIG_NAME" \
        --named-ports=http:3000 \
        --zone="$ZONE"

    # Configure autoscaling
    gcloud compute instance-groups managed set-autoscaling "$MIG_NAME" \
        --zone="$ZONE" \
        --max-num-replicas=5 \
        --min-num-replicas=1 \
        --target-cpu-utilization=0.6 \
        --cool-down-period=60
fi

# Create backend service
echo -e "${YELLOW}[9/12] Creating backend service...${NC}"
if ! gcloud compute backend-services describe "$BACKEND_SERVICE" --global &>/dev/null; then
    gcloud compute backend-services create "$BACKEND_SERVICE" \
        --protocol=HTTP \
        --port-name=http \
        --health-checks="$HEALTH_CHECK" \
        --session-affinity=CLIENT_IP \
        --timeout=3600s \
        --global

    # Add instance group to backend
    gcloud compute backend-services add-backend "$BACKEND_SERVICE" \
        --instance-group="$MIG_NAME" \
        --instance-group-zone="$ZONE" \
        --balancing-mode=UTILIZATION \
        --max-utilization=0.8 \
        --global
fi

# Create Cloud Armor security policy
echo -e "${YELLOW}[10/12] Creating Cloud Armor security policy...${NC}"
./cloud-armor.sh

# Attach security policy to backend
gcloud compute backend-services update "$BACKEND_SERVICE" \
    --security-policy="$SECURITY_POLICY" \
    --global

# Create SSL certificate
echo -e "${YELLOW}[11/12] Creating managed SSL certificate...${NC}"
if ! gcloud compute ssl-certificates describe "$SSL_CERT" --global &>/dev/null; then
    gcloud compute ssl-certificates create "$SSL_CERT" \
        --domains="$DOMAIN,www.$DOMAIN" \
        --global
    echo -e "${YELLOW}⚠ SSL certificate provisioning can take 15-60 minutes${NC}"
    echo -e "${YELLOW}⚠ Don't forget to create DNS A record for www.$DOMAIN pointing to $LB_IP${NC}"
fi

# Create URL map and load balancer
echo -e "${YELLOW}[12/12] Creating load balancer...${NC}"
if ! gcloud compute url-maps describe atc-url-map --global &>/dev/null; then
    gcloud compute url-maps create atc-url-map \
        --default-service="$BACKEND_SERVICE"
fi

if ! gcloud compute target-https-proxies describe atc-https-proxy --global &>/dev/null; then
    gcloud compute target-https-proxies create atc-https-proxy \
        --ssl-certificates="$SSL_CERT" \
        --url-map=atc-url-map
fi

if ! gcloud compute forwarding-rules describe atc-https-rule --global &>/dev/null; then
    gcloud compute forwarding-rules create atc-https-rule \
        --address="$LB_IP_NAME" \
        --target-https-proxy=atc-https-proxy \
        --ports=443 \
        --global
fi

# Setup monitoring and alerting
echo -e "${YELLOW}Setting up monitoring and alerting...${NC}"
./monitoring.sh

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Load Balancer IP: ${GREEN}$LB_IP${NC}"
echo -e "Domain: ${GREEN}https://$DOMAIN${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait 5-10 minutes for instances to become healthy"
echo "2. Check instance logs: gcloud logging read \"resource.type=gce_instance\" --limit 50"
echo "3. Verify health: gcloud compute backend-services get-health $BACKEND_SERVICE --global"
echo "4. Test your application: curl https://$DOMAIN/health"
echo "5. Deploy client: ./deploy-client.sh"
echo ""
echo -e "${YELLOW}Monitor deployment:${NC}"
echo "gcloud compute instances list"
echo "gcloud compute backend-services get-health $BACKEND_SERVICE --global"
echo ""
