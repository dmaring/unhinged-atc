#!/bin/bash
# Update production instances to enable Cloud Logging via Ops Agent
# This script creates a new instance template and performs a rolling update

set -e

echo "=== Updating Unhinged ATC deployment with Cloud Logging ==="

# Load environment variables
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found. Please create one based on .env.example"
    exit 1
fi

# Check required variables
if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID not set in .env"
    exit 1
fi

if [ -z "$DOMAIN" ]; then
    echo "Error: DOMAIN not set in .env"
    exit 1
fi

# Set project
gcloud config set project "$PROJECT_ID"

# Get the current instance template
CURRENT_TEMPLATE=$(gcloud compute instance-groups managed describe atc-mig --zone=us-central1-a --format="value(instanceTemplate)" | sed 's|.*/||')
echo "Current instance template: $CURRENT_TEMPLATE"

# Generate new template name with timestamp
NEW_TEMPLATE="atc-template-logging-$(date +%Y%m%d-%H%M%S)"
echo "New instance template: $NEW_TEMPLATE"

# Create new instance template with updated startup script
echo "Creating new instance template with Ops Agent configuration..."
gcloud compute instance-templates create "$NEW_TEMPLATE" \
    --machine-type=e2-medium \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --boot-disk-type=pd-standard \
    --tags=atc-server,http-server,https-server \
    --scopes=cloud-platform \
    --metadata-from-file=startup-script=startup-script.sh \
    --metadata=domain="$DOMAIN",repo-url="https://github.com/dmaring/unhinged-atc.git"

echo "✓ New instance template created: $NEW_TEMPLATE"

# Update the managed instance group to use the new template
echo "Updating managed instance group..."
gcloud compute instance-groups managed set-instance-template atc-mig \
    --template="$NEW_TEMPLATE" \
    --zone=us-central1-a

echo "✓ Instance group updated to use new template"

# Perform rolling update
echo ""
echo "Starting rolling update..."
echo "This will replace instances one at a time to minimize downtime."
read -p "Continue with rolling update? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    gcloud compute instance-groups managed rolling-action replace atc-mig \
        --zone=us-central1-a \
        --max-surge=1 \
        --max-unavailable=0

    echo ""
    echo "✓ Rolling update initiated!"
    echo ""
    echo "Monitor progress with:"
    echo "  gcloud compute instance-groups managed list-instances atc-mig --zone=us-central1-a"
    echo ""
    echo "Once complete, verify Cloud Logging with:"
    echo "  gcloud logging read 'jsonPayload.logType=\"player_event\"' --limit 10 --format json"
else
    echo "Rolling update cancelled. The instance group is configured with the new template,"
    echo "but existing instances were not replaced. New instances will use the updated template."
fi

echo ""
echo "=== Update Complete ==="
echo ""
echo "Next steps:"
echo "1. Wait for new instances to start (5-10 minutes)"
echo "2. Test the application: https://$DOMAIN"
echo "3. View logs: gcloud logging read 'jsonPayload.username=\"YOUR_USERNAME\"' --limit 50"
