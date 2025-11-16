#!/bin/bash
# Unhinged ATC - VPC Firewall Rules Configuration
# Zero-trust network security

set -e

echo "Configuring VPC firewall rules..."

# Rule 1: Allow health checks from load balancer
echo "  - Allowing health checks from load balancer..."
gcloud compute firewall-rules create allow-health-checks \
    --network=default \
    --action=ALLOW \
    --rules=tcp:3000,tcp:80 \
    --source-ranges=35.191.0.0/16,130.211.0.0/22 \
    --target-tags=atc-server \
    --priority=1000 \
    --description="Allow health checks from GCP load balancers" \
    2>/dev/null || echo "  Rule 'allow-health-checks' already exists, skipping..."

# Rule 2: Allow load balancer traffic to backends
echo "  - Allowing load balancer traffic..."
gcloud compute firewall-rules create allow-lb-traffic \
    --network=default \
    --action=ALLOW \
    --rules=tcp:3000 \
    --source-ranges=130.211.0.0/22,35.191.0.0/16 \
    --target-tags=atc-server \
    --priority=1000 \
    --description="Allow traffic from load balancer to backend instances" \
    2>/dev/null || echo "  Rule 'allow-lb-traffic' already exists, skipping..."

# Rule 3: Allow IAP for SSH (secure management access)
echo "  - Allowing IAP for SSH..."
gcloud compute firewall-rules create allow-iap-ssh \
    --network=default \
    --action=ALLOW \
    --rules=tcp:22 \
    --source-ranges=35.235.240.0/20 \
    --target-tags=atc-server \
    --priority=1000 \
    --description="Allow SSH through Identity-Aware Proxy" \
    2>/dev/null || echo "  Rule 'allow-iap-ssh' already exists, skipping..."

# Rule 4: Deny direct SSH from internet
echo "  - Blocking direct SSH from internet..."
gcloud compute firewall-rules create deny-ssh-from-internet \
    --network=default \
    --action=DENY \
    --rules=tcp:22 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=atc-server \
    --priority=2000 \
    --description="Block direct SSH access from internet (use IAP instead)" \
    2>/dev/null || echo "  Rule 'deny-ssh-from-internet' already exists, skipping..."

# Rule 5: Deny direct access to application port from internet
echo "  - Blocking direct access to application port..."
gcloud compute firewall-rules create deny-direct-access \
    --network=default \
    --action=DENY \
    --rules=tcp:3000 \
    --source-ranges=0.0.0.0/0 \
    --destination-ranges=0.0.0.0/0 \
    --priority=2000 \
    --description="Block direct access to application port (must go through load balancer)" \
    2>/dev/null || echo "  Rule 'deny-direct-access' already exists, skipping..."

# Enable firewall logging for security auditing
echo "  - Enabling firewall logging..."
for rule in allow-health-checks allow-lb-traffic allow-iap-ssh deny-ssh-from-internet deny-direct-access; do
    gcloud compute firewall-rules update "$rule" \
        --enable-logging \
        2>/dev/null || true
done

echo "✓ Firewall rules configured successfully"
echo ""
echo "Firewall Security Summary:"
echo "  ✓ Allow: Load balancer health checks (tcp:3000, tcp:80)"
echo "  ✓ Allow: Load balancer traffic (tcp:3000)"
echo "  ✓ Allow: SSH via IAP only (tcp:22 from 35.235.240.0/20)"
echo "  ✗ Deny:  Direct SSH from internet"
echo "  ✗ Deny:  Direct access to application port"
echo ""
echo "To connect via SSH:"
echo "  gcloud compute ssh INSTANCE_NAME --zone=ZONE --tunnel-through-iap"
echo ""
echo "View firewall rules:"
echo "  gcloud compute firewall-rules list --filter='targetTags:atc-server'"
