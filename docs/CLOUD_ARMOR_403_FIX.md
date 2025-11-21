# Cloud Armor 403 Error Resolution

## Issue Summary

**Date**: November 19, 2025
**Symptom**: Users experiencing HTTP 403 Forbidden errors when refreshing the page after logging in to openatc.app
**Impact**: Users unable to refresh the game page without getting blocked

## Root Cause

Cloud Armor rate limiting was too aggressive for a real-time WebSocket application:

1. **Socket.IO Connection Overhead**
   - Socket.IO uses HTTP long-polling as a fallback transport
   - Each connection generates 10-20+ HTTP requests to `/socket.io/`
   - Client reconnections on page refresh trigger burst traffic

2. **Original Rate Limits**
   - Socket.IO endpoint: 20 requests/minute (Rule priority 1000)
   - General traffic: 100 requests/minute with rate-based ban (Rule priority 4000)
   - Ban threshold: 500 requests/5 minutes → 10-minute ban

3. **Typical Refresh Flow**
   - Page refresh loads: HTML + JS + CSS + fonts + Google Analytics
   - New Socket.IO connection established with polling fallback
   - Google Analytics sends multiple tracking requests
   - **Total: 30-50 requests within seconds**

This meant a single page refresh could trigger rate limiting, and multiple refreshes would result in a 10-minute IP ban.

## Investigation Process

### Initial Diagnosis
1. WebSocket error resolved by deploying new instance with correct `domain=openatc.app`
2. 403 errors persisted specifically on page refresh after login
3. No 403 logs appearing in Cloud Logging (bans were cached at load balancer)

### Testing
1. `curl` tests returned 200 OK (single request, no rate limit hit)
2. Playwright tests consistently returned 403 (multiple rapid requests)
3. Even with Cloud Armor completely disabled, Playwright showed cached 403 (load balancer cache)

### Key Insight
The 403 was not a security threat but an architectural mismatch between:
- Cloud Armor's rate limiting (designed for traditional web apps)
- Real-time WebSocket applications (high request frequency)

## Solution Implemented

### Complete Removal of Cloud Armor

After initial attempts to tune rate limiting, we determined that Cloud Armor was not necessary for this application and completely removed it.

**Decision Rationale:**
1. Real-time WebSocket applications are incompatible with aggressive rate limiting
2. Application has built-in authentication and authorization
3. Google Cloud Load Balancer provides DDoS protection
4. WAF rules (XSS, SQLi, etc.) can cause false positives for legitimate traffic
5. Application is stateless and horizontally scalable

### Commands Used

```bash
# Initial attempt: Delete rate limiting rules
gcloud compute security-policies rules delete 1000 \
  --security-policy=atc-security-policy --quiet
gcloud compute security-policies rules delete 3000 \
  --security-policy=atc-security-policy --quiet
gcloud compute security-policies rules delete 4000 \
  --security-policy=atc-security-policy --quiet

# Final solution: Remove Cloud Armor entirely
gcloud compute backend-services update atc-backend-service \
  --security-policy="" --global

# Delete the security policy
gcloud compute security-policies delete atc-security-policy --quiet
```

### Current Security Configuration

**No Cloud Armor Policy Attached**

```bash
# Verify no security policy
gcloud compute backend-services describe atc-backend-service --global \
  --format="value(securityPolicy)"
# Output: (empty - no policy)
```

**Security Layers:**
1. Google Cloud Load Balancer DDoS protection (automatic)
2. Application-level authentication (username/email required)
3. HTTPS/TLS encryption (enforced by load balancer)
4. Helmet.js security headers (CSP, XSS protection, etc.)
5. Express CORS configuration (origin validation)
6. Server-side input validation and sanitization

## Architecture Decision Rationale

### Why Remove Cloud Armor Entirely?

1. **Real-Time Application Nature**
   - WebSocket/Socket.IO apps generate legitimate high-frequency traffic
   - Rate limiting breaks the core functionality
   - Even WAF rules can cause false positives with JSON payloads

2. **Existing Security Layers Are Sufficient**
   - **GCP Load Balancer**: Built-in DDoS protection at network layer
   - **Application Authentication**: Username/email required to play
   - **Helmet.js**: Provides CSP, XSS protection, frame guards at app level
   - **CORS Configuration**: Validates request origins
   - **Input Validation**: Server-side sanitization of user inputs
   - **HTTPS/TLS**: All traffic encrypted

3. **Cloud Armor Limitations for This Use Case**
   - Designed for traditional request/response web apps
   - Can't distinguish between legitimate burst traffic and attacks
   - WAF rules may block legitimate JSON payloads
   - Rate limiting incompatible with real-time bidirectional communication
   - Adds latency and complexity without clear security benefit

4. **Scalability Over Restriction**
   - Application is stateless and horizontally scalable
   - Managed Instance Group can auto-scale under load
   - No expensive database operations vulnerable to rate exhaustion
   - Better to scale resources than restrict legitimate users

## Monitoring & Security

### What to Monitor

```bash
# Check load balancer errors
gcloud logging read 'resource.type="http_load_balancer" AND httpRequest.status>=400' \
  --limit 20 --freshness=1h

# Monitor application errors
gcloud logging read 'jsonPayload.logType="server_error"' \
  --limit 20 --freshness=1h

# Check for unusual traffic patterns
gcloud logging read 'resource.type="http_load_balancer"' \
  --limit 100 --freshness=1h --format=json | \
  jq -r '.httpRequest.remoteIp' | sort | uniq -c | sort -rn

# Monitor player activity
gcloud logging read 'jsonPayload.logType="player_event"' \
  --limit 50 --freshness=1h

# Check instance health
gcloud compute backend-services get-health atc-backend-service --global
```

### If Security Issues Arise

If abuse or attacks become a problem, consider:

1. **Application-Level Rate Limiting**
   - Implement in Express middleware with `express-rate-limit`
   - Can differentiate between authenticated/unauthenticated users
   - Won't affect Socket.IO connection upgrades
   - Example:
   ```javascript
   const rateLimit = require('express-rate-limit');
   const apiLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100, // per IP
     skip: (req) => req.path.startsWith('/socket.io/')
   });
   app.use('/api/', apiLimiter);
   ```

2. **IP Blocking at Firewall Level**
   - Block specific malicious IPs using VPC firewall rules
   - More targeted than blanket rate limiting
   - Example:
   ```bash
   gcloud compute firewall-rules create block-malicious-ip \
     --action=DENY \
     --rules=tcp,udp,icmp \
     --source-ranges=MALICIOUS_IP/32 \
     --priority=100
   ```

3. **Re-enable Cloud Armor with Custom Configuration**
   - Only if specific attack patterns identified
   - Exclude `/socket.io/` from all rules
   - Use very high rate limits (1000+ req/min)
   - Monitor carefully for false positives

## Testing Verification

**Before Fix:**
```
User refresh → 30-50 requests → Rate limit hit → 403 error
Multiple refreshes → Ban threshold → 10-minute IP ban
```

**After Fix (Rate Limits Removed):**
```
User refresh → 30-50 requests → Still occasional 403s from WAF
```

**Final Fix (Cloud Armor Removed):**
```
User refresh → 30-50 requests → All allowed → Page loads successfully
Multiple refreshes → No issues → Game functions normally
```

**Security Status:**
- ✅ GCP Load Balancer DDoS protection (automatic)
- ✅ Application authentication required
- ✅ HTTPS/TLS encryption enforced
- ✅ Helmet.js security headers active
- ✅ CORS origin validation
- ✅ Server-side input validation
- ❌ Cloud Armor WAF (removed - not needed for this use case)

## Related Issues

- [CLAUDE.md](../CLAUDE.md) - Deployment documentation
- Instance template domain configuration: `openatc.app`
- WebSocket URL: `wss://openatc.app`

## Lessons Learned

1. **Not All Security Tools Fit All Applications**
   - Cloud Armor is designed for traditional request/response web apps
   - Real-time WebSocket apps have fundamentally different traffic patterns
   - Sometimes the right answer is to not use a tool at all

2. **Rate Limiting Can Break Legitimate Traffic**
   - High-frequency legitimate traffic looks like an attack to rate limiters
   - Even "tuned" rate limits caused issues with burst traffic
   - Application-level rate limiting is more precise than network-level

3. **Layered Security Without Redundancy**
   - Multiple overlapping security layers can cause more harm than good
   - GCP Load Balancer already provides DDoS protection
   - Application authentication and input validation are sufficient for this use case
   - WAF rules designed for traditional apps can block legitimate WebSocket traffic

4. **Test from Multiple Perspectives**
   - Command-line tools (curl) show single-request behavior
   - Browsers show realistic multi-request patterns
   - Real users experience burst traffic that triggers rate limits
   - Sometimes the solution is removal, not tuning

## Future Considerations

1. **CDN Caching**
   - Consider Cloud CDN for static assets
   - Reduces origin requests
   - May help with burst traffic

2. **Connection Pooling**
   - Socket.IO already uses connection reuse
   - Monitor connection lifetime and reconnection patterns

3. **Analytics Optimization**
   - Google Analytics generates many requests
   - Consider batching or sampling for high-traffic periods

---

## Summary

**Problem**: HTTP 403 errors on page refresh due to Cloud Armor rate limiting

**Initial Approach**: Remove rate limiting rules while keeping WAF protection
**Result**: Still occasional 403s from WAF rules

**Final Solution**: Complete removal of Cloud Armor
- Detached security policy from backend service
- Deleted Cloud Armor security policy
- Relies on GCP Load Balancer DDoS protection and application-level security

**Status**: ✅ Resolved
**Verified By**: User testing - page refresh working without 403 errors
**Decision**: Cloud Armor not needed for real-time WebSocket applications with built-in authentication
**Last Updated**: November 19, 2025
