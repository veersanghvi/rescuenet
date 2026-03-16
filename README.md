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

To reduce first-request latency:

1. Set backend env variables on Render:
   - KEEP_DB_AWAKE=true
   - KEEP_DB_AWAKE_INTERVAL_MS=55000
2. Ensure Render service does not sleep.
3. Keep Neon compute warm with periodic traffic.

This repository includes a scheduled GitHub Actions ping job at [.github/workflows/keepalive.yml](.github/workflows/keepalive.yml).

## License

No license file is currently defined in this repository.
