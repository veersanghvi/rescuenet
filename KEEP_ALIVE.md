# Backend Keep-Alive Guide

This document provides a comprehensive guide to keeping the RescueNet backend warm and available at all times.

## Problem Statement

**Free-tier hosting platforms** (Render, Heroku, Railway, etc.) automatically put services to sleep after a period of inactivity to save resources. When a request arrives at a sleeping service:

1. **Cold start delay:** 10-30 seconds to wake up
2. **Database cold start:** Additional 5-15 seconds for Neon to resume compute
3. **Poor user experience:** Long wait times for emergency rescue reports

**Solution:** Keep the backend "warm" through periodic activity to prevent sleep.

---

## Current Implementation

RescueNet uses a **multi-layered approach** to maximize uptime:

### Layer 1: GitHub Actions Scheduled Ping ⭐ (Primary)

**File:** `.github/workflows/keepalive.yml`

```yaml
schedule:
  - cron: '*/5 * * * *'  # Every 5 minutes
```

**How it works:**
- Automatically pings `https://rescuenet-az60.onrender.com/api/healthz` every 5 minutes
- Includes 4 retry attempts with exponential backoff (15s, 30s, 45s, 60s)
- Handles transient failures gracefully (no alert spam)
- Can be manually triggered via GitHub Actions UI

**Benefits:**
- ✅ Completely free (unlimited for public repos)
- ✅ Reliable execution (GitHub infrastructure)
- ✅ Zero maintenance required
- ✅ Works even when no users are active

**Limitations:**
- ⚠️ Minimum interval: 5 minutes (GitHub Actions scheduling limitation)
- ⚠️ Slight delays possible during GitHub maintenance

---

### Layer 2: Database Keep-Alive (Built-in)

**File:** `server.ts` lines 50-68

**How it works:**
- Runs `SELECT 1` queries every 55 seconds (configurable)
- Keeps Neon database compute active
- Independent of external HTTP requests
- Starts automatically when server boots

**Configuration:**
```bash
# .env.local or Render environment variables
KEEP_DB_AWAKE="true"
KEEP_DB_AWAKE_INTERVAL_MS="55000"  # 55 seconds (recommended)
```

**Benefits:**
- ✅ Keeps database warm even during Render cold starts
- ✅ Reduces database connection latency
- ✅ Configurable interval
- ✅ Graceful shutdown (uses `timer.unref()`)

**Tuning recommendations:**
- **Default:** 55 seconds - balanced between warmth and resource usage
- **Aggressive:** 45 seconds - maximum warmth, slightly higher resource usage
- **Conservative:** 60 seconds - minimal resource usage, slight warmth risk
- **Minimum:** 15 seconds (enforced in code to prevent abuse)

---

### Layer 3: Connection Pool Optimization

**File:** `server.ts` lines 19-28

**Configuration:**
```typescript
const pool = new Pool({
  min: 1,                        // Maintain at least 1 connection
  max: 10,                       // Allow up to 10 concurrent connections
  idleTimeoutMillis: 30000,      // Close idle connections after 30s
  connectionTimeoutMillis: 10000 // 10s timeout for acquiring connections
});
```

**Benefits:**
- ✅ Always maintains 1 warm database connection
- ✅ Reduces connection establishment overhead
- ✅ Balances warmth with resource efficiency

---

### Layer 4: Health Check Endpoint

**File:** `server.ts` lines 388-397

**Endpoint:** `GET /api/healthz`

**Response:**
```json
{
  "ok": true,
  "db": "up"
}
```

**Features:**
- Checks database connectivity
- 3 retry attempts with 600ms base delay
- Returns 200 (healthy) or 503 (unhealthy)
- Used by GitHub Actions and external monitors

---

## Additional Options

### Option A: External Uptime Monitoring (Recommended)

Use third-party services for additional redundancy and monitoring:

#### 1. **UptimeRobot** (Most Popular)
- **URL:** https://uptimerobot.com
- **Free tier:** 50 monitors, 5-minute checks
- **Setup:**
  1. Create account
  2. Add HTTP(s) monitor
  3. URL: `https://rescuenet-az60.onrender.com/api/healthz`
  4. Interval: 5 minutes
  5. Expected keyword: `"ok":true`
- **Benefits:**
  - Email/SMS/Slack alerts
  - Public status page
  - Incident history
  - Better than GitHub Actions alone

#### 2. **Better Stack (Uptime)**
- **URL:** https://betterstack.com
- **Free tier:** 10 monitors, 3-minute checks (faster!)
- **Features:**
  - Modern UI
  - Incident management
  - On-call scheduling
  - Status pages

#### 3. **Cron-Job.org**
- **URL:** https://cron-job.org
- **Free tier:** Unlimited jobs, 1-minute checks (best!)
- **Setup:**
  1. Create account
  2. Add new cron job
  3. URL: `https://rescuenet-az60.onrender.com/api/healthz`
  4. Schedule: `*/1 * * * *` (every minute)
- **Benefits:**
  - Most aggressive ping interval
  - Virtually eliminates cold starts
  - Completely free

**Recommendation:** Use UptimeRobot or Cron-Job.org in addition to GitHub Actions for maximum reliability.

---

### Option B: Render Configuration File

**File:** `render.yaml` (already created)

This file configures Render-specific deployment settings:

```yaml
services:
  - type: web
    healthCheckPath: /api/healthz
    envVars:
      - key: KEEP_DB_AWAKE
        value: true
```

**Limitations:**
- Free tier **always** sleeps after 15 minutes of inactivity
- Cannot be disabled on free tier
- Paid plans ($7+/month) offer "Always On" feature

**When to use:**
- If you upgrade to a paid Render plan
- Provides native health checks within Render dashboard
- Can configure auto-deploy and other CI/CD features

---

### Option C: Upgrade to Paid Hosting

If critical uptime is required:

#### Render Paid Plans
- **Starter:** $7/month per service
- **Always On:** No auto-sleep
- **Faster cold starts:** Even if manually stopped

#### Alternative Platforms (No Sleep on Free Tier)
- **Fly.io:** Free tier doesn't auto-sleep
- **Railway:** $5 credit/month, no auto-sleep
- **Koyeb:** Free tier stays warm longer

---

## Monitoring & Verification

### Check GitHub Actions Status

1. Visit: https://github.com/veersanghvi/rescuenet/actions
2. Look for "Keep Backend Warm" workflow
3. Verify runs every 5 minutes with success ✅

### Test Health Endpoint Manually

```bash
curl -i https://rescuenet-az60.onrender.com/api/healthz
```

**Expected output:**
```
HTTP/2 200
content-type: application/json

{"ok":true,"db":"up"}
```

**Response time benchmarks:**
- **Warm backend:** < 200ms
- **Cold start:** 10-30 seconds (first request after sleep)
- **Database cold start:** +5-15 seconds

### Check Render Logs

1. Log into Render dashboard
2. Navigate to your service
3. Check "Logs" tab
4. Look for:
   - "Server is running on port 3000"
   - Regular health check requests
   - No "service is spinning down" messages

---

## Troubleshooting

### Backend Still Goes to Sleep

**Diagnosis:**
```bash
# If this takes >5 seconds, backend was sleeping
time curl https://rescuenet-az60.onrender.com/api/healthz
```

**Solutions:**

1. **Check GitHub Actions workflow:**
   - Ensure workflow is enabled (not paused)
   - Check recent runs for failures
   - Manually trigger workflow to test

2. **Verify Render environment variables:**
   - Log into Render dashboard
   - Go to Environment tab
   - Ensure `KEEP_DB_AWAKE=true` is set
   - Ensure `KEEP_DB_AWAKE_INTERVAL_MS=55000` is set

3. **Check Render service logs:**
   - Look for "DB keep-alive ping failed" errors
   - Verify server is actually starting the keep-alive timer

4. **Add external monitoring:**
   - Set up UptimeRobot or Cron-Job.org
   - Provides redundancy beyond GitHub Actions

### Database Connection Errors

If you see errors like "connection timeout" or "database unavailable":

1. **Check Neon dashboard:**
   - Verify compute is active
   - Check for quota limits (free tier: 100 hours/month compute)

2. **Verify DATABASE_URL:**
   - Ensure connection string is correct
   - Check SSL mode is set: `?sslmode=require`

3. **Test connection manually:**
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1"
   ```

### GitHub Actions Workflow Failures

If workflow shows failures:

1. **Check workflow logs:**
   - Look for HTTP error codes
   - 503 = Service temporarily unavailable (cold start)
   - 500 = Server error (check Render logs)

2. **Verify backend URL:**
   - Ensure `https://rescuenet-az60.onrender.com` is correct
   - Test URL in browser

3. **Check GitHub Actions quotas:**
   - Ensure you haven't exceeded usage limits
   - Public repos: Unlimited
   - Private repos: Check billing

---

## Best Practices

### For Maximum Uptime (Free Tier)

✅ **Do:**
- Use GitHub Actions (5-minute ping)
- Enable `KEEP_DB_AWAKE=true` on Render
- Add UptimeRobot or Cron-Job.org for redundancy
- Monitor GitHub Actions for failures

❌ **Don't:**
- Set KEEP_DB_AWAKE_INTERVAL_MS below 15 seconds (will be ignored)
- Rely on a single warming mechanism
- Forget to check Neon compute hours quota

### For Production Use

✅ **Do:**
- Upgrade to Render paid plan ($7/month) for "Always On"
- Use external monitoring with alerts (Better Stack, PagerDuty)
- Set up proper logging and observability (Sentry, LogRocket)
- Consider multi-region deployment for redundancy

---

## Cost Analysis

### Current Setup (Free)

| Component | Cost | Uptime Impact |
|-----------|------|---------------|
| GitHub Actions | $0 (public repo) | High |
| KEEP_DB_AWAKE | $0 (built-in) | Medium |
| Connection Pool | $0 (built-in) | Low |
| UptimeRobot | $0 (free tier) | High |
| Render Free | $0 | Limited (sleeps after 15min) |
| Neon Free | $0 | Limited (100hrs compute/month) |

**Total:** $0/month
**Expected Uptime:** ~95-98% (with occasional cold starts)

### Paid Upgrade Options

| Component | Cost | Uptime Impact |
|-----------|------|---------------|
| Render Starter | $7/month | 99.9% uptime (no sleep) |
| Neon Pro | $19/month | Unlimited compute hours |
| Better Stack | $24/month | Advanced monitoring |

**Minimum Upgrade:** $7/month (Render only) → 99.9% uptime

---

## Summary

**Current Status:** ✅ Multi-layered warming strategy (free)

- GitHub Actions pings every 5 minutes
- Database keep-alive runs every 55 seconds
- Connection pool maintains 1 warm connection
- Health endpoint with retry logic

**Recommended Addition:** Add UptimeRobot or Cron-Job.org for maximum free-tier reliability.

**For Production:** Upgrade to Render paid plan ($7/month) for guaranteed "Always On" behavior.

---

## Quick Reference

### Environment Variables
```bash
KEEP_DB_AWAKE="true"
KEEP_DB_AWAKE_INTERVAL_MS="55000"
```

### Health Check URL
```
https://rescuenet-az60.onrender.com/api/healthz
```

### GitHub Actions Workflow
```
.github/workflows/keepalive.yml
```

### Render Config
```
render.yaml
```

---

**Last Updated:** 2026-03-20
