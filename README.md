# CareerOS AI � Setup Guide

Full-stack AI-powered career platform (Node/Express/MongoDB + Vite/React/TS + Tailwind + Recharts/Framer Motion).

## Monorepo layout
- `server/` � Express API (auth, jobs, AI analyzers, roadmap, dashboard).
- `AI SKILL AND ROLE PREDICT/` � Vite + React + TypeScript frontend.

## Prerequisites
- Node.js 18+ (tested with 18/20/22/24)
- npm 8+ (comes with Node)
- MongoDB 6/7 running locally, or Docker to run `mongo` container
- Git (optional) for cloning

## Quick start
### 1) Clone or copy the project
```bash
# on target PC
# if you have a repo URL, replace below
# git clone <repo-url>
# cd into the project root where you see /server and /AI SKILL AND ROLE PREDICT
```

### 2) Backend setup (`server`)
```bash
cd server
npm install
```
Create `.env` (you can copy `.env.example` and adjust):
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/careeros_ai
MONGO_DB_NAME=careeros_ai
JWT_SECRET=change_this_in_production
CLIENT_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
JOB_SYNC_INTERVAL_MS=300000
JOB_SYNC_LIMIT=30
```
Start MongoDB:
- Local service: `mongod --dbpath C:/data/db` (create folder first)
- or Docker: `docker run -d --name mongo -p 27017:27017 -v %cd%/mongo-data:/data/db mongo:7`

Run backend:
```bash
npm run dev   # with nodemon
# or
npm start     # plain node
```
API runs at `http://localhost:5001/api/v1`.

### 3) Frontend setup (`AI SKILL AND ROLE PREDICT`)
```bash
cd "AI SKILL AND ROLE PREDICT"
npm install
```
Create `.env` (or `.env.local`):
```
VITE_API_BASE_URL=http://localhost:5001/api/v1
```
Run dev server:
```bash
npm run dev
```
Open http://localhost:5173

### 4) Seed jobs (optional sample feed)
```bash
cd server
npm run seed:jobs
```

## Common commands
- Backend lint/tests: (not configured) � placeholder.
- Frontend build: `npm run build` inside frontend directory.

## Troubleshooting
- "Invalid credentials" after restart: ensure Mongo is running; the API falls back to in-memory DB which resets on restart.
- CORS issues: check `CLIENT_ORIGINS` in server `.env` matches your frontend URL.
- Port in use: adjust `PORT` in server `.env` and `VITE_API_BASE_URL` accordingly.
- Mongo connection refused: verify `MONGO_URI` host/port and that the service/container is running.

## Deployment hints
- Set strong `JWT_SECRET`.
- Use a managed Mongo service or persistent volume.
- Run `npm run build` in frontend, then serve `dist/` via a static host or reverse proxy.
- Behind HTTPS, update `CLIENT_ORIGINS` and `VITE_API_BASE_URL` to the deployed domains.

## Key API routes (prefix `/api/v1`)
- `POST /auth/register`, `POST /auth/login`
- `GET /jobs` (filters + pagination)
- `POST /jobs/sync` (admin/trigger)
- `POST /ai/fit`, `POST /ai/fit-role`, `POST /ai/roadmap`, `POST /ai/resume-optimize`, `POST /ai/interview-guidance`
- `GET /dashboard`
- `GET/POST/PATCH /applications`

## Frontend credentials storage
- JWT is stored in `localStorage` under `careeros_token`. Use the app�s Login/Register to obtain a token after backend is running.

Enjoy building on CareerOS AI.
