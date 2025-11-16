#!/bin/bash
# Unhinged ATC - Cloud Armor Security Policy Configuration
# DDoS Protection, WAF, and Rate Limiting

set -e

SECURITY_POLICY="${SECURITY_POLICY:-atc-security-policy}"

echo "Configuring Cloud Armor security policy: $SECURITY_POLICY"

# Create security policy if it doesn't exist
if ! gcloud compute security-policies describe "$SECURITY_POLICY" &>/dev/null; then
    gcloud compute security-policies create "$SECURITY_POLICY" \
        --description="Unhinged ATC DDoS and WAF protection"
    echo "✓ Security policy created"
fi

# Enable verbose logging for security events
gcloud compute security-policies update "$SECURITY_POLICY" \
    --log-level=VERBOSE

echo "Creating security rules..."

# Rule 1000: Rate limit WebSocket connection attempts (20/min per IP)
echo "  - Rate limiting WebSocket connections..."
gcloud compute security-policies rules create 1000 \
    --security-policy="$SECURITY_POLICY" \
    --expression="request.path.matches('/socket.io/')" \
    --action=throttle \
    --rate-limit-threshold-count=20 \
    --rate-limit-threshold-interval-sec=60 \
    --conform-action=allow \
    --exceed-action=deny-429 \
    --enforce-on-key=IP \
    2>/dev/null || echo "  Rule 1000 already exists, skipping..."

# Rule 2000: Block XSS attempts
echo "  - Blocking XSS attacks..."
gcloud compute security-policies rules create 2000 \
    --security-policy="$SECURITY_POLICY" \
    --expression="evaluatePreconfiguredExpr('xss-stable')" \
    --action=deny-403 \
    2>/dev/null || echo "  Rule 2000 already exists, skipping..."

# Rule 2001: Block SQL injection attempts
echo "  - Blocking SQL injection attacks..."
gcloud compute security-policies rules create 2001 \
    --security-policy="$SECURITY_POLICY" \
    --expression="evaluatePreconfiguredExpr('sqli-stable')" \
    --action=deny-403 \
    2>/dev/null || echo "  Rule 2001 already exists, skipping..."

# Rule 2002: Block local file inclusion (LFI) attempts
echo "  - Blocking LFI attacks..."
gcloud compute security-policies rules create 2002 \
    --security-policy="$SECURITY_POLICY" \
    --expression="evaluatePreconfiguredExpr('lfi-stable')" \
    --action=deny-403 \
    2>/dev/null || echo "  Rule 2002 already exists, skipping..."

# Rule 2003: Block remote code execution (RCE) attempts
echo "  - Blocking RCE attacks..."
gcloud compute security-policies rules create 2003 \
    --security-policy="$SECURITY_POLICY" \
    --expression="evaluatePreconfiguredExpr('rce-stable')" \
    --action=deny-403 \
    2>/dev/null || echo "  Rule 2003 already exists, skipping..."

# Rule 3000: Block common bots (basic bot detection)
echo "  - Blocking common bots..."
gcloud compute security-policies rules create 3000 \
    --security-policy="$SECURITY_POLICY" \
    --expression="has(request.headers['user-agent']) && request.headers['user-agent'].lower().contains('bot') && !request.headers['user-agent'].lower().contains('googlebot') && !request.headers['user-agent'].lower().contains('bingbot')" \
    --action=deny-403 \
    2>/dev/null || echo "  Rule 3000 already exists, skipping..."

# Rule 4000: Rate-based ban for excessive requests (100 requests/min triggers 10-min ban)
echo "  - Configuring rate-based IP banning..."
gcloud compute security-policies rules create 4000 \
    --security-policy="$SECURITY_POLICY" \
    --src-ip-ranges="*" \
    --action=rate-based-ban \
    --rate-limit-threshold-count=100 \
    --rate-limit-threshold-interval-sec=60 \
    --ban-duration-sec=600 \
    --ban-threshold-count=500 \
    --ban-threshold-interval-sec=300 \
    --conform-action=allow \
    --exceed-action=deny-429 \
    --enforce-on-key=IP \
    2>/dev/null || echo "  Rule 4000 already exists, skipping..."

# Rule 5000: Block suspicious user agents (empty or too short)
echo "  - Blocking suspicious user agents..."
gcloud compute security-policies rules create 5000 \
    --security-policy="$SECURITY_POLICY" \
    --expression="!has(request.headers['user-agent']) || request.headers['user-agent'].size() < 10" \
    --action=deny-403 \
    2>/dev/null || echo "  Rule 5000 already exists, skipping..."

# Rule 6000: Geographic restrictions (OPTIONAL - commented out by default)
# Uncomment and customize if you want to block specific countries
# echo "  - Configuring geographic restrictions..."
# gcloud compute security-policies rules create 6000 \
#     --security-policy="$SECURITY_POLICY" \
#     --expression="origin.region_code == 'CN' || origin.region_code == 'RU'" \
#     --action=deny-403 \
#     2>/dev/null || echo "  Rule 6000 already exists, skipping..."

# Rule 2147483647: Default allow (highest priority number = lowest priority)
echo "  - Setting default allow rule..."
gcloud compute security-policies rules create 2147483647 \
    --security-policy="$SECURITY_POLICY" \
    --action=allow \
    2>/dev/null || echo "  Default rule already exists, skipping..."

echo "✓ Cloud Armor security policy configured successfully"
echo ""
echo "Security Policy Summary:"
echo "  - WebSocket connection rate limiting: 20/min per IP"
echo "  - OWASP protection: XSS, SQLi, LFI, RCE blocking"
echo "  - Bot detection and blocking"
echo "  - Rate-based IP banning: 100 req/min triggers 10-min ban"
echo "  - Suspicious user agent blocking"
echo ""
echo "View policy: gcloud compute security-policies describe $SECURITY_POLICY"
echo "View logs: gcloud logging read 'resource.type=\"http_load_balancer\" AND jsonPayload.enforcedSecurityPolicy.name=\"$SECURITY_POLICY\"' --limit 50"
