# Unhinged ATC - Security Checklist & Incident Response

This document provides a pre-launch security checklist and incident response procedures for production deployment.

---

## Pre-Launch Security Checklist

### Infrastructure Security

- [ ] **DNS Configuration**
  - DNS A record points to load balancer IP
  - No dangling DNS records from old deployments
  - TTL set appropriately (300-3600 seconds)

- [ ] **SSL/TLS Certificates**
  - Google-managed SSL certificate status: ACTIVE
  - Certificate covers all required domains
  - HTTPS redirects configured (HTTP → HTTPS)
  - Certificate auto-renewal monitoring enabled

- [ ] **Cloud Armor**
  - Security policy attached to backend service
  - All WAF rules active (XSS, SQLi, LFI, RCE)
  - Rate limiting rules configured
  - Bot detection enabled
  - Logging set to VERBOSE

- [ ] **VPC Firewall Rules**
  - All required firewall rules created
  - Default deny-all ingress verified
  - Health check access allowed (35.191.0.0/16, 130.211.0.0/22)
  - IAP SSH access configured (35.235.240.0/20)
  - Direct SSH from internet blocked
  - Direct access to port 3000 blocked
  - Firewall logging enabled

- [ ] **Load Balancer**
  - HTTPS forwarding rule configured
  - Backend service attached
  - Health checks passing (all instances HEALTHY)
  - Session affinity enabled (CLIENT_IP)
  - Backend timeout set to 3600s for WebSockets

### Application Security

- [ ] **Secret Management**
  - All API keys stored in Secret Manager
  - No secrets in code, environment files, or logs
  - Service account has minimal required permissions
  - Secrets rotation policy defined

- [ ] **CORS Configuration**
  - Production domain in allowlist
  - Localhost/dev domains removed from production
  - credentials: true set correctly
  - No wildcards (*) in production CORS

- [ ] **Rate Limiting**
  - HTTP endpoint rate limiting: 100 req/min
  - Socket.IO connection rate limiting: 10 conn/min
  - Health check endpoint excluded from rate limiting
  - Rate limit violations logged

- [ ] **Input Validation**
  - Username length validation (3-20 chars)
  - Profanity filter active
  - Email validation implemented
  - Command validation in CommandProcessor

- [ ] **Security Headers**
  - Helmet middleware configured
  - Content-Security-Policy set
  - HSTS enabled
  - X-Frame-Options set
  - X-Content-Type-Options set

### Monitoring & Alerting

- [ ] **Monitoring Setup**
  - Notification channel configured with correct email
  - All alert policies created:
    - High 4xx rate (DDoS detection)
    - Backend unhealthy (instance failure)
    - High CPU (scaling alert)
    - SSL certificate expiring
    - Cloud Armor denials
  - Uptime check configured and passing
  - Log-based metrics created

- [ ] **Logging Configuration**
  - Cloud Logging enabled
  - Security logs retained (30+ days recommended)
  - Firewall logging enabled
  - Cloud Armor logging enabled
  - Application logs sent to Cloud Logging

### Instance Security

- [ ] **OS Hardening**
  - Automatic security updates enabled
  - Only necessary software installed
  - Application runs as non-root user (systemd service)
  - Systemd service hardening configured
  - No public IP on instances (load balancer access only)

- [ ] **Access Control**
  - IAP configured for SSH access
  - IAM roles follow least privilege
  - No shared passwords or SSH keys
  - OS login enabled (optional but recommended)

### Operational Security

- [ ] **Backup & Recovery**
  - Backup strategy documented
  - Recovery procedures tested
  - RTO/RPO defined

- [ ] **Incident Response**
  - Incident response plan documented (see below)
  - Team roles and contacts defined
  - Escalation procedures defined
  - Post-mortem template prepared

- [ ] **Documentation**
  - Deployment documentation complete
  - Architecture diagrams current
  - Runbook for common operations
  - Emergency contacts documented

### Cost & Compliance

- [ ] **Budget Controls**
  - Budget alerts configured (50%, 75%, 100%)
  - Cost monitoring dashboard created
  - Resource quotas understood

- [ ] **Compliance** (if applicable)
  - Data residency requirements met
  - Privacy policy updated
  - Terms of service reviewed
  - GDPR/CCPA compliance verified (if applicable)

---

## Post-Launch Monitoring (First 7 Days)

### Daily Checks

- [ ] **Day 1**: Monitor Cloud Armor denials - adjust rules if false positives
- [ ] **Day 1**: Verify all alerts functioning - trigger test alert
- [ ] **Day 2**: Review cost report - identify any unexpected charges
- [ ] **Day 3**: Check SSL certificate status - should be ACTIVE
- [ ] **Day 3**: Load test - simulate 2x expected traffic
- [ ] **Day 4**: Review security logs - check for suspicious activity
- [ ] **Day 5**: Verify auto-scaling - check if MIG scaled appropriately
- [ ] **Day 6**: Review instance uptime - verify no unexpected restarts
- [ ] **Day 7**: Complete security audit - re-run this checklist

### Weekly Checks

- [ ] Review Security Command Center findings
- [ ] Analyze traffic patterns and adjust rate limits
- [ ] Review and update firewall rules
- [ ] Check for software/dependency updates
- [ ] Review cost optimization opportunities

### Monthly Checks

- [ ] Rotate secrets (API keys)
- [ ] Review and update IAM policies
- [ ] Patch OS and dependencies
- [ ] Test disaster recovery procedures
- [ ] Conduct security audit
- [ ] Review and renew SSL certificates (if not auto-renewed)

---

## Incident Response Procedures

### Incident Severity Levels

**P0 - Critical**: Service completely unavailable, major security breach
**P1 - High**: Degraded performance, partial outage, active attack
**P2 - Medium**: Minor issues, potential security concerns
**P3 - Low**: Cosmetic issues, non-urgent improvements

---

### Incident 1: DDoS Attack Detected

**Symptoms:**
- Alert: "High 4xx Rate (Potential DDoS)"
- Cloud Armor denials > 1000/min
- High request volume from specific IPs or regions
- Legitimate users report slow performance

**Response Procedure:**

1. **Verify Attack** (5 minutes)
   ```bash
   # Check request patterns
   gcloud logging read 'resource.type="http_load_balancer"' \
       --limit 100 --format=json | jq '.[] | .jsonPayload.statusDetails'

   # Check Cloud Armor denials
   gcloud logging read 'jsonPayload.enforcedSecurityPolicy.outcome="DENY"' \
       --limit 50

   # Identify attack source
   gcloud logging read 'resource.type="http_load_balancer"' \
       --limit 1000 --format=json | jq -r '.[] | .httpRequest.remoteIp' | sort | uniq -c | sort -nr | head -20
   ```

2. **Immediate Mitigation** (10 minutes)
   ```bash
   # Block specific IP or range
   gcloud compute security-policies rules create 100 \
       --security-policy=atc-security-policy \
       --expression="inIpRange(origin.ip, 'ATTACKER_IP/32')" \
       --action=deny-403

   # Or block country (if attack is from specific region)
   gcloud compute security-policies rules create 101 \
       --security-policy=atc-security-policy \
       --expression="origin.region_code == 'XX'" \
       --action=deny-403

   # Temporarily increase rate limits for WebSocket (if false positives)
   gcloud compute security-policies rules update 1000 \
       --security-policy=atc-security-policy \
       --rate-limit-threshold-count=50
   ```

3. **Monitor and Adjust** (30 minutes)
   ```bash
   # Watch live traffic
   gcloud logging tail 'resource.type="http_load_balancer"'

   # Check if attack subsided
   # Monitor Cloud Armor denials
   ```

4. **Escalate if Needed** (if attack continues)
   - Consider upgrading to Cloud Armor Managed Protection Plus ($3k/month)
   - Contact Google Cloud Support
   - Enable Adaptive Protection (ML-based DDoS detection)

5. **Post-Incident**
   - Document attack details (source IPs, volume, duration)
   - Remove temporary rules after 24-48 hours
   - Update security policies based on learnings
   - Write post-mortem

**Rollback:**
```bash
# Remove blocking rules
gcloud compute security-policies rules delete 100 --security-policy=atc-security-policy
gcloud compute security-policies rules delete 101 --security-policy=atc-security-policy

# Reset rate limits
gcloud compute security-policies rules update 1000 \
    --security-policy=atc-security-policy \
    --rate-limit-threshold-count=20
```

---

### Incident 2: All Instances Unhealthy (503 Errors)

**Symptoms:**
- Alert: "Backend Service Unhealthy"
- Users see 503 Service Unavailable
- Health checks failing

**Response Procedure:**

1. **Check Instance Status** (2 minutes)
   ```bash
   # Check backend health
   gcloud compute backend-services get-health atc-backend-service --global

   # Check instance status
   gcloud compute instances list --filter="tags.items:atc-server"
   ```

2. **Check Application Logs** (5 minutes)
   ```bash
   # View recent errors
   gcloud logging read "resource.type=gce_instance AND severity>=ERROR" \
       --limit 50

   # Check service status on instance
   gcloud compute ssh INSTANCE_NAME --zone=$ZONE --tunnel-through-iap \
       --command="sudo systemctl status unhinged-atc.service"

   # View application logs
   gcloud compute ssh INSTANCE_NAME --zone=$ZONE --tunnel-through-iap \
       --command="sudo journalctl -u unhinged-atc.service -n 100"
   ```

3. **Common Causes and Fixes:**

   **Cause: Application crashed**
   ```bash
   # Restart service
   gcloud compute ssh INSTANCE_NAME --zone=$ZONE --tunnel-through-iap \
       --command="sudo systemctl restart unhinged-atc.service"
   ```

   **Cause: Port 3000 not responding**
   ```bash
   # Check if port is listening
   gcloud compute ssh INSTANCE_NAME --zone=$ZONE --tunnel-through-iap \
       --command="sudo netstat -tlnp | grep 3000"

   # Test health endpoint locally
   gcloud compute ssh INSTANCE_NAME --zone=$ZONE --tunnel-through-iap \
       --command="curl http://localhost:3000/health"
   ```

   **Cause: Firewall blocking health checks**
   ```bash
   # Verify firewall rules
   gcloud compute firewall-rules list --filter="targetTags:atc-server"

   # Re-create health check rule if missing
   gcloud compute firewall-rules create allow-health-checks \
       --network=default --action=ALLOW --rules=tcp:3000,tcp:80 \
       --source-ranges=35.191.0.0/16,130.211.0.0/22 \
       --target-tags=atc-server
   ```

4. **Emergency Rollback** (if issue persists)
   ```bash
   # Rollback to previous instance template
   gcloud compute instance-groups managed rolling-action start-update atc-mig \
       --version=template=atc-server-template-v1 \
       --zone=$ZONE
   ```

5. **Scale Up Manually** (temporary mitigation)
   ```bash
   # Add more instances temporarily
   gcloud compute instance-groups managed resize atc-mig --size=5 --zone=$ZONE
   ```

---

### Incident 3: SSL Certificate Failure

**Symptoms:**
- Alert: "SSL Certificate Expiring Soon" or validation failure
- Users see "Your connection is not private" error
- HTTPS connections failing

**Response Procedure:**

1. **Check Certificate Status** (2 minutes)
   ```bash
   # View certificate status
   gcloud compute ssl-certificates describe atc-ssl-cert --global

   # Check expiry date
   gcloud compute ssl-certificates list
   ```

2. **If Certificate Expired or Failed:**
   ```bash
   # Create new certificate
   gcloud compute ssl-certificates create atc-ssl-cert-v2 \
       --domains=$DOMAIN --global

   # Update target proxy
   gcloud compute target-https-proxies update atc-https-proxy \
       --ssl-certificates=atc-ssl-cert-v2

   # Wait 15-60 minutes for provisioning
   ```

3. **Verify DNS** (if provisioning fails)
   ```bash
   # Check DNS points to load balancer
   nslookup $DOMAIN

   # Should return load balancer IP
   gcloud compute addresses describe atc-lb-ip --global --format='value(address)'
   ```

4. **Temporary Workaround** (emergency only)
   ```bash
   # Remove HTTPS requirement temporarily (NOT RECOMMENDED)
   # Users can access via HTTP while you fix SSL
   # Only use if critical business need
   ```

---

### Incident 4: Security Breach / Unauthorized Access

**Symptoms:**
- Suspicious activity in logs
- Unexpected admin actions
- Data exfiltration detected
- Compromised credentials

**Response Procedure:**

1. **Immediate Containment** (5 minutes)
   ```bash
   # Block suspicious IPs
   gcloud compute security-policies rules create 50 \
       --security-policy=atc-security-policy \
       --expression="inIpRange(origin.ip, 'SUSPICIOUS_IP/32')" \
       --action=deny-403

   # Rotate all secrets immediately
   gcloud secrets versions add anthropic-api-key --data-file=new-key.txt
   gcloud secrets versions add openai-api-key --data-file=new-key.txt
   ```

2. **Investigate** (30 minutes)
   ```bash
   # Review all logs for suspicious activity
   gcloud logging read 'resource.type="gce_instance" AND severity>=WARNING' \
       --limit 1000 --format=json > security-investigation.json

   # Check IAM changes
   gcloud logging read 'protoPayload.methodName="SetIamPolicy"' --limit 100

   # Check firewall rule changes
   gcloud logging read 'protoPayload.serviceName="compute.googleapis.com" AND protoPayload.methodName:firewall' \
       --limit 100
   ```

3. **Secure Environment**
   ```bash
   # Recreate all instances from known good template
   gcloud compute instance-groups managed rolling-action replace atc-mig --zone=$ZONE

   # Review and update IAM permissions
   gcloud projects get-iam-policy $PROJECT_ID

   # Enable additional logging if not already enabled
   gcloud logging sinks create security-sink \
       storage.googleapis.com/security-logs-bucket \
       --log-filter='severity>=WARNING'
   ```

4. **Notify Stakeholders**
   - Email all users if data breach confirmed
   - Contact legal/compliance team
   - File incident report

5. **Post-Incident**
   - Conduct thorough security audit
   - Implement additional security controls
   - Update incident response procedures
   - Mandatory security training

---

### Incident 5: Unexpected High Costs

**Symptoms:**
- Budget alert triggered
- Costs 2x+ expected
- Unusual usage patterns

**Response Procedure:**

1. **Identify Cost Drivers** (10 minutes)
   ```bash
   # View cost breakdown
   open "https://console.cloud.google.com/billing/reports?project=$PROJECT_ID"

   # Check current resource usage
   gcloud compute instances list
   gcloud compute instance-groups managed describe atc-mig --zone=$ZONE
   ```

2. **Immediate Cost Reduction**
   ```bash
   # Reduce max instances
   gcloud compute instance-groups managed set-autoscaling atc-mig \
       --zone=$ZONE --max-num-replicas=2

   # Delete unused resources
   # Review and delete:
   # - Orphaned disks
   # - Unused static IPs
   # - Old snapshots
   ```

3. **Investigate Root Cause**
   - Check for runaway autoscaling
   - Review egress bandwidth usage
   - Check for DDoS attack (attackers cost you money)
   - Review Cloud Armor request volume

4. **Long-term Optimization**
   ```bash
   # Enable committed use discounts
   # Set up more aggressive CDN caching
   # Optimize instance sizes
   # Set hard budget limits
   ```

---

## Emergency Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| Primary On-Call | [Your Name] | [Phone/Email] | 24/7 |
| Backup On-Call | [Backup] | [Phone/Email] | 24/7 |
| Security Lead | [Security] | [Phone/Email] | Business hours |
| GCP Account Manager | [Google] | [Email] | Business hours |

---

## Post-Incident Procedures

After resolving any P0 or P1 incident:

1. **Immediate (within 24 hours)**
   - Update status page/users
   - Document timeline of events
   - Identify root cause

2. **Within 1 week**
   - Write post-mortem (no-blame culture)
   - Identify action items
   - Assign owners to action items
   - Share learnings with team

3. **Within 1 month**
   - Complete all action items
   - Update runbooks and documentation
   - Implement preventive measures
   - Conduct retrospective

---

## Useful Commands Reference

### Quick Diagnostics
```bash
# Overall health check
gcloud compute backend-services get-health atc-backend-service --global

# Recent errors
gcloud logging read "severity>=ERROR" --limit 20

# Current traffic volume
gcloud logging read 'resource.type="http_load_balancer"' \
    --format=json --limit 1000 | jq -r '.[] | .timestamp' | cut -c1-16 | uniq -c

# Active instances
gcloud compute instances list --filter="tags.items:atc-server"

# Cost estimate (current month)
gcloud billing accounts get-billing-info --billing-account=BILLING_ACCOUNT_ID
```

### Emergency Actions
```bash
# Block IP immediately
gcloud compute security-policies rules create 1 \
    --security-policy=atc-security-policy \
    --expression="origin.ip == 'MALICIOUS_IP'" \
    --action=deny-403

# Scale down immediately
gcloud compute instance-groups managed resize atc-mig --size=1 --zone=$ZONE

# Disable autoscaling
gcloud compute instance-groups managed stop-autoscaling atc-mig --zone=$ZONE

# Emergency rollback
gcloud compute instance-groups managed rolling-action replace atc-mig \
    --zone=$ZONE --max-unavailable=all
```

---

## Compliance & Audit Trail

All security incidents must be logged with:
- Date and time
- Severity level
- Incident description
- Response actions taken
- Resolution time
- Root cause analysis
- Preventive measures implemented

Store incident logs in: `gs://PROJECT_ID-incident-logs/`

---

## Review Schedule

This document should be reviewed and updated:
- After every P0/P1 incident
- Monthly during regular security audits
- When new features are deployed
- When infrastructure changes significantly

Last reviewed: [DATE]
Next review: [DATE + 30 days]
