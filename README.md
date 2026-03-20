# RescueNet

RescueNet is an emergency animal rescue web platform for fast reporting, case tracking, volunteer operations, and lost-and-found posts.

It is built as a full-stack TypeScript app:
- Frontend: React + Vite
- Backend: Express
- Database: PostgreSQL (Neon)
- Images: Cloudinary

## Core Features

- Create rescue cases with location and optional photo
- Track case progress with a unique reporter token
- Admin and volunteer authentication with role-based access
- NGO directory with species support, radius filtering, and search
- Lost and found board with status updates
- Species-specific first-aid guidance
- Health endpoint for uptime monitoring

## Tech Stack

- React 19, Vite 6, TypeScript
- Express 4
- PostgreSQL via pg
- Cloudinary for uploads
- Google GenAI SDK for search assistance

## Project Structure

- src: frontend app pages and components
- server.ts: backend API, auth, DB setup, and production server
- public: static assets (robots, sitemap)
- netlify.toml: frontend deployment redirects to backend API

## Environment Variables

Create a local environment file named .env.local.

Required:
- DATABASE_URL
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET


## Local Development

Prerequisites:
- Node.js 18+ recommended

Install dependencies:
npm install

Start development server:
npm run dev

The app runs on http://localhost:3000.

## Production Build

Build frontend:
npm run build

Run server in production mode:
npm run start

## API Overview

Auth:
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/users (admin)
- GET /api/auth/users (admin)
- DELETE /api/auth/users/:id (admin)

NGOs:
- GET /api/ngos
- POST /api/ngos (admin)
- DELETE /api/ngos/:id (admin)

Cases:
- POST /api/cases
- GET /api/cases (admin, volunteer)
- GET /api/cases/track/:token
- PATCH /api/cases/:id/status (admin, volunteer)

First Aid:
- GET /api/first-aid

Lost and Found:
- GET /api/lost-found
- POST /api/lost-found
- PATCH /api/lost-found/:id/status (admin, volunteer)

Search:
- POST /api/search

Ops:
- GET /api/healthz

## Deployment Notes

Current deployment pattern:
- Frontend hosted on Netlify
- API hosted on Render
- Database hosted on Neon

The frontend forwards /api requests to Render via [netlify.toml](netlify.toml).

## Warm Startup for Emergency Traffic

To reduce first-request latency and keep the backend continuously available, this project uses multiple warming mechanisms:

### 1. GitHub Actions Scheduled Ping (Primary)

A GitHub Actions workflow automatically pings the backend health endpoint every 5 minutes:
- **File:** [.github/workflows/keepalive.yml](.github/workflows/keepalive.yml)
- **Frequency:** Every 5 minutes (`*/5 * * * *`)
- **Target:** `https://rescuenet-az60.onrender.com/api/healthz`
- **Features:**
  - 4 retry attempts with exponential backoff (15s, 30s, 45s, 60s)
  - Handles Render/Neon cold-start delays gracefully
  - Can be manually triggered via GitHub Actions UI

### 2. Database Keep-Alive (Built-in)

The server includes an internal database ping mechanism to keep Neon compute warm:
- **Implementation:** `server.ts` lines 50-68
- **How it works:** Runs `SELECT 1` queries at regular intervals
- **Configuration:**
  ```bash
  KEEP_DB_AWAKE="true"                    # Enable database keep-alive
  KEEP_DB_AWAKE_INTERVAL_MS="55000"      # Ping every 55 seconds (recommended)
  ```
- **Benefits:** Keeps database connections active even when no API requests are made

### 3. Database Connection Pool Optimization

The PostgreSQL connection pool is configured to maintain warm connections:
- **Min connections:** 1 (always maintains at least 1 open connection)
- **Max connections:** 10 (allows burst traffic)
- **Idle timeout:** 30 seconds (closes inactive connections to save resources)
- **Connection timeout:** 10 seconds (fail fast if database is unavailable)

### 4. External Monitoring Services (Optional)

For additional redundancy, you can use free uptime monitoring services:

**Recommended Options:**
- **UptimeRobot** (https://uptimerobot.com)
  - Free tier: 50 monitors, 5-minute checks
  - Setup: Add monitor for `https://rescuenet-az60.onrender.com/api/healthz`
  - Benefits: Email/SMS alerts, public status page

- **Better Stack** (https://betterstack.com)
  - Free tier: 10 monitors, 3-minute checks
  - Advanced features: Incident management, on-call scheduling

- **Cron-Job.org** (https://cron-job.org)
  - Free tier: Unlimited jobs, 1-minute checks
  - Simple HTTP GET requests to keep service alive

### 5. Render Configuration (render.yaml)

The `render.yaml` file configures Render-specific settings:
- Health check endpoint: `/api/healthz`
- Environment variables: Pre-configured keep-alive settings
- **Note:** Free tier auto-sleeps after 15 minutes of inactivity (cannot be disabled)
- **Upgrade option:** Paid plans can use "Always On" feature to prevent sleep entirely

### How to Verify Backend is Staying Warm

1. **Check GitHub Actions:**
   - Visit: https://github.com/veersanghvi/rescuenet/actions
   - Look for "Keep Backend Warm" workflow runs
   - Should show successful runs every 5 minutes

2. **Monitor health endpoint:**
   ```bash
   curl https://rescuenet-az60.onrender.com/api/healthz
   # Expected response: {"ok":true,"db":"up"}
   ```

3. **Check response times:**
   - Warm backend: < 200ms response time
   - Cold start: 10-30 seconds initial request (then warm)

### Troubleshooting Cold Starts

If the backend still goes to sleep:

1. **Verify environment variables on Render:**
   - Ensure `KEEP_DB_AWAKE=true` is set
   - Check `KEEP_DB_AWAKE_INTERVAL_MS=55000`

2. **Check GitHub Actions workflow:**
   - Ensure workflow is enabled (not paused)
   - Verify no recent failures in Actions tab

3. **Consider adding external monitoring:**
   - UptimeRobot provides additional redundancy
   - Helps identify downtime patterns

4. **Upgrade to paid plan (if needed):**
   - Render paid plans offer "Always On" feature
   - Completely eliminates auto-sleep behavior

### Cost-Free Warming Strategy (Current Setup)

✅ GitHub Actions (free for public repos)
✅ Database keep-alive (built-in, no cost)
✅ Connection pool optimization (built-in, no cost)
✅ External monitoring (free tiers available)

This multi-layered approach ensures maximum uptime without additional costs.

## License

No license file is currently defined in this repository.
