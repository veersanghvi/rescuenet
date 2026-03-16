<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b96c525b-0dde-4105-a61d-16fa10023c83

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Persistence (Render)

This app uses SQLite and supports configurable DB paths.

1. Create a persistent disk in Render and mount it at `/var/data`
2. Set environment variable `DB_PATH=/var/data/rescue.db`
3. Set environment variable `UPLOAD_DIR=/var/data/uploads`
3. Redeploy your Render service

Without a mounted disk, data resets when the instance is recycled.

## New Features

- `Until Help Arrives` page with practical species-specific first-aid steps
- `Lost & Found` board for community reunion reports
- Optional photo uploads for rescue cases and lost/found posts (500KB max)
- NGO create/delete is restricted to admin users
- SEO assets: metadata, `robots.txt`, and `sitemap.xml`

## Keep Backend + DB Warm (Emergency Setup)

For low-latency emergency reports, keep both Render and Neon warm:

1. In Render environment variables, set:
   - `KEEP_DB_AWAKE=true`
   - `KEEP_DB_AWAKE_INTERVAL_MS=55000`
2. Ensure your Render service does not sleep (plan/config dependent).
3. Use an uptime monitor to hit `https://rescuenet-az60.onrender.com/api/healthz` every minute.
4. Optional: this repo includes a GitHub Actions cron workflow in `.github/workflows/keepalive.yml` that pings the same health endpoint every minute.

This setup minimizes cold starts from both app host and Neon autosuspend.
