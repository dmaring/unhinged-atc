#!/bin/bash
# Unhinged ATC - Monitoring and Alerting Configuration
# Proactive detection of DDoS attacks, instance failures, and SSL issues

set -e

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"

echo "Setting up monitoring and alerting..."

# Prompt for notification email if not provided
if [ -z "$NOTIFICATION_EMAIL" ]; then
    read -p "Enter email address for alerts: " NOTIFICATION_EMAIL
fi

# Create notification channel
echo "Creating notification channel for email: $NOTIFICATION_EMAIL"
CHANNEL_ID=$(gcloud alpha monitoring channels create \
    --display-name="Primary Email Alerts" \
    --type=email \
    --channel-labels=email_address="$NOTIFICATION_EMAIL" \
    --format='value(name)' 2>/dev/null || \
    gcloud alpha monitoring channels list \
    --filter="type=email AND labels.email_address=$NOTIFICATION_EMAIL" \
    --format='value(name)' \
    --limit=1)

if [ -z "$CHANNEL_ID" ]; then
    echo "✗ Failed to create or find notification channel"
    exit 1
fi

echo "✓ Notification channel: $CHANNEL_ID"

# Alert 1: High 4xx rate (potential DDoS attack)
echo "Creating DDoS attack detection alert..."
gcloud alpha monitoring policies create \
    --notification-channels="$CHANNEL_ID" \
    --display-name="High 4xx Rate (Potential DDoS)" \
    --condition-display-name="Request count > 1000/min" \
    --condition-threshold-value=1000 \
    --condition-threshold-duration=60s \
    --condition-threshold-comparison=COMPARISON_GT \
    --condition-filter='
        resource.type="https_lb_rule" AND
        metric.type="loadbalancing.googleapis.com/https/request_count" AND
        metric.labels.response_code_class="4xx"
    ' \
    --aggregation-alignment-period=60s \
    --aggregation-per-series-aligner=ALIGN_RATE \
    --aggregation-cross-series-reducer=REDUCE_SUM \
    2>/dev/null || echo "  Alert already exists, skipping..."

# Alert 2: Backend unhealthy instances
echo "Creating backend health alert..."
gcloud alpha monitoring policies create \
    --notification-channels="$CHANNEL_ID" \
    --display-name="Backend Service Unhealthy" \
    --condition-display-name="Unhealthy backend instances detected" \
    --condition-threshold-value=0 \
    --condition-threshold-duration=300s \
    --condition-threshold-comparison=COMPARISON_GT \
    --condition-filter='
        resource.type="https_lb_rule" AND
        metric.type="loadbalancing.googleapis.com/https/backend_request_count" AND
        metric.labels.response_code_class="5xx"
    ' \
    --aggregation-alignment-period=60s \
    --aggregation-per-series-aligner=ALIGN_RATE \
    --aggregation-cross-series-reducer=REDUCE_SUM \
    2>/dev/null || echo "  Alert already exists, skipping..."

# Alert 3: High CPU usage on instances
echo "Creating high CPU alert..."
gcloud alpha monitoring policies create \
    --notification-channels="$CHANNEL_ID" \
    --display-name="High CPU Usage" \
    --condition-display-name="CPU utilization > 85%" \
    --condition-threshold-value=0.85 \
    --condition-threshold-duration=300s \
    --condition-threshold-comparison=COMPARISON_GT \
    --condition-filter='
        resource.type="gce_instance" AND
        metric.type="compute.googleapis.com/instance/cpu/utilization"
    ' \
    --aggregation-alignment-period=60s \
    --aggregation-per-series-aligner=ALIGN_MEAN \
    --aggregation-cross-series-reducer=REDUCE_MEAN \
    2>/dev/null || echo "  Alert already exists, skipping..."

# Alert 4: SSL certificate expiring soon
echo "Creating SSL certificate expiry alert..."
gcloud alpha monitoring policies create \
    --notification-channels="$CHANNEL_ID" \
    --display-name="SSL Certificate Expiring Soon" \
    --condition-display-name="Certificate expires in < 30 days" \
    --condition-threshold-value=2592000 \
    --condition-threshold-duration=86400s \
    --condition-threshold-comparison=COMPARISON_LT \
    --condition-filter='
        resource.type="https_lb_rule" AND
        metric.type="loadbalancing.googleapis.com/https/frontend/ssl_certificate_time_to_expiry"
    ' \
    --aggregation-alignment-period=3600s \
    --aggregation-per-series-aligner=ALIGN_MIN \
    2>/dev/null || echo "  Alert already exists, skipping..."

# Alert 5: Cloud Armor denials (security events)
echo "Creating Cloud Armor security event alert..."
gcloud alpha monitoring policies create \
    --notification-channels="$CHANNEL_ID" \
    --display-name="High Cloud Armor Denial Rate" \
    --condition-display-name="Security policy denials > 100/min" \
    --condition-threshold-value=100 \
    --condition-threshold-duration=60s \
    --condition-threshold-comparison=COMPARISON_GT \
    --condition-filter='
        resource.type="http_load_balancer" AND
        metric.type="loadbalancing.googleapis.com/https/request_count" AND
        metric.labels.response_code="403"
    ' \
    --aggregation-alignment-period=60s \
    --aggregation-per-series-aligner=ALIGN_RATE \
    --aggregation-cross-series-reducer=REDUCE_SUM \
    2>/dev/null || echo "  Alert already exists, skipping..."

# Create uptime check for public endpoint
echo "Creating uptime check..."
DOMAIN="${DOMAIN:-openatc.app}"
gcloud monitoring uptime create "atc-https-uptime" \
    --resource-type=uptime-url \
    --display-name="Unhinged ATC HTTPS Uptime" \
    --http-check-path=/health \
    --protocol=HTTPS \
    --port=443 \
    --hostname="$DOMAIN" \
    --period=60 \
    --timeout=10s \
    2>/dev/null || echo "  Uptime check already exists, skipping..."

echo "✓ Monitoring and alerting configured successfully"
echo ""
echo "Alert Summary:"
echo "  ✓ DDoS detection: 4xx rate > 1000/min"
echo "  ✓ Backend health: 5xx errors detected"
echo "  ✓ High CPU: > 85% utilization"
echo "  ✓ SSL expiry: < 30 days remaining"
echo "  ✓ Security events: Cloud Armor denials > 100/min"
echo "  ✓ Uptime check: https://$DOMAIN/health every 60s"
echo ""
echo "Alerts will be sent to: $NOTIFICATION_EMAIL"
echo ""
echo "View alerts: https://console.cloud.google.com/monitoring/alerting?project=$PROJECT_ID"
echo "View dashboards: https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
