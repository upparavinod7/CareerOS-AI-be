# CareerOS AI — Backend API Server

Production-ready Node.js/Express REST API and AI Service Engine powering CareerOS AI — Your Career Command Center.

## 1. Project Overview & Architecture

CareerOS AI backend provides secure authentication, job ingestion & synchronization, AI fit evaluation, career role prediction, personalized learning roadmaps, resume ATS optimization, cover letter generation, interview preparation, and full candidate pipeline tracking.

```
CareerOs-AI-be/
├── config/
│   └── db.js                 # MongoDB connection with in-memory dev fallback & prod guardrails
├── controllers/
│   ├── aiController.js       # AI fit, roadmap, prediction, ATS, interview, & cover letter
│   ├── applicationController.js # Kanban & table application tracker CRUD
│   ├── authController.js     # User registration, bcrypt password hashing, JWT generation
│   ├── dashboardController.js# Real-time analytics, pipeline velocity, & activity timeline
│   ├── jobController.js      # Job search, filtering, bookmark saving, & sync triggers
│   └── userController.js     # User profile, skills, education, & career preferences
├── middleware/
│   ├── auth.js               # JWT bearer token verification & session validation
│   ├── errorHandlers.js      # Centralized error handling & 404 routing
│   └── security.js           # CSP, X-Frame, XSS headers, & IP rate limiting
├── models/
│   ├── Application.js        # Tracked job applications & interview schedules
│   ├── CoverLetter.js        # Saved tailored cover letters
│   ├── FitAnalysis.js        # Persistent AI job-fit match scores & competency breakdowns
│   ├── InterviewPrep.js      # Interview questions & mock chat transcripts
│   ├── Job.js                # Ingested jobs with skills, compensation, & work type
│   ├── Roadmap.js            # Multi-week structured learning roadmaps with completion state
│   └── User.js               # User accounts, skills, resume context, & profile readiness
├── routes/                   # Mounted under /api/v1/*
├── tests/
│   └── api.test.js           # Automated end-to-end integration test suite (24 tests)
├── utils/
│   ├── aiEngine.js           # Explainable scoring, role predictor, roadmap, ATS, & mock AI
│   ├── jobFeedService.js     # External job feed synchronization (Remotive, Arbeitnow)
│   ├── jobRealtime.js        # Server-Sent Events (SSE) live updates
│   └── mockJobs.js           # Verified fallback job seed data
├── app.js                    # Express app configuration & middleware pipeline
├── index.js                  # Server entrypoint & DB bootstrap
└── package.json
```

---

## 2. Prerequisites & Technology Stack

- **Runtime**: Node.js 18.x, 20.x, or 22.x
- **Framework**: Express.js 5.x
- **Database**: MongoDB 6+ (local mongod, MongoDB Atlas, or automated development in-memory fallback)
- **Security**: JWT (`jsonwebtoken`), bcryptjs, custom security headers, rate limiting
- **Test Runner**: Node.js built-in native test runner (`node --test`)

---

## 3. Environment Variables Configuration

Create a `.env` file in the root of `CareerOs-AI-be/` based on `.env.example`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=careeros_ai
JWT_SECRET=your_production_secret_key_min_32_chars
CLIENT_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
JOB_SYNC_INTERVAL_MS=300000
JOB_SYNC_LIMIT=30
```

> **Note on MongoDB**: In development, if an external MongoDB instance is not reachable, the server automatically starts an in-memory MongoDB instance with clear warning logs. In production (`NODE_ENV=production`), in-memory fallback is disabled to guarantee persistence.

---

## 4. Local Setup & Execution

### Install Dependencies
```bash
npm install
```

### Seed Initial Jobs
```bash
npm run seed:jobs
```

### Run Server in Development Mode
```bash
npm run dev
```

### Run Server in Production Mode
```bash
npm start
```

### Execute Automated Test Suite
```bash
npm test
```
*Executes 24 automated integration tests verifying health, auth, protected routes, job saving, AI fit, roadmap milestone completion, cover letters, mock interview evaluation, and application tracker CRUD.*

---

## 5. API Endpoint Documentation

Base path: `/api/v1`

### Authentication (`/auth`)
- `POST /auth/register` — Register a new account (`name`, `email`, `password`)
- `POST /auth/login` — Sign in and receive JWT token (`email`, `password`)

### User Profile (`/users`)
- `GET /users/me` — Retrieve authenticated user profile with readiness score
- `PATCH /users/me` — Update headline, skills, target role, resume, experience, education
- `POST /users/change-password` — Change password (`currentPassword`, `newPassword`)

### Job Search & Bookmarks (`/jobs`)
- `GET /jobs` — Search jobs (`q`, `role`, `location`, `workType`, `experience`, `minSalary`, `maxSalary`, `sort`, `page`, `limit`)
- `GET /jobs/:id` — Retrieve specific job details and extracted keywords
- `GET /jobs/saved` — Get all saved bookmarks for the authenticated user
- `POST /jobs/:id/save` — Save job to bookmarks
- `DELETE /jobs/:id/save` — Remove job from bookmarks
- `POST /jobs/sync` — Force sync external public job feeds
- `GET /jobs/sync/status` — Get current synchronization statistics
- `GET /jobs/stream` — SSE real-time sync event stream

### AI Intelligence Services (`/ai`)
- `POST /ai/fit` — Analyze compatibility against a specific job ID
- `POST /ai/fit-role` — Analyze compatibility against any role title
- `GET /ai/fit-history` — Retrieve past fit analyses
- `POST /ai/career-predict` — Predict recommended roles and learning pathways
- `POST /ai/roadmap` — Generate personalized weekly learning roadmap
- `GET /ai/roadmaps` — Retrieve saved roadmaps
- `PATCH /ai/roadmaps/:roadmapId/tasks/:taskId` — Toggle roadmap milestone completed
- `POST /ai/resume-optimize` — Run ATS keyword scan and get bullet rewrites
- `POST /ai/cover-letter` — Draft tailored cover letter with chosen tone
- `GET /ai/cover-letters` — Retrieve saved cover letters
- `POST /ai/interview-guidance` — Get technical, behavioral, and prep plan
- `POST /ai/chat-mock-interview` — Simulated mock interview evaluation with scoring

### Application Tracker (`/applications`)
- `GET /applications` — List user's tracked applications (`status`, `q`, `sort`)
- `POST /applications` — Add custom or feed-linked application
- `PATCH /applications/:id` — Update stage, notes, or interview dates
- `DELETE /applications/:id` — Remove application from pipeline

### Dashboard Analytics (`/dashboard`)
- `GET /dashboard` — Aggregated KPI metrics, pipeline velocity, recent activities, and skill gaps
