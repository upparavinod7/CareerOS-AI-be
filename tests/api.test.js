const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const app = require("../app");
const { connectDBWithRetry, disconnectDB } = require("../config/db");
const Job = require("../models/Job");
const { mockJobs } = require("../utils/mockJobs");

let server;
let baseUrl;
let authToken = "";
let testUserId = "";
let sampleJobId = "";
let sampleAppId = "";
let sampleRoadmapId = "";
let sampleTaskId = "";

test.before(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_super_secret_key_12345";
    await connectDBWithRetry();

    // Seed mock jobs
    await Job.bulkWrite(
        mockJobs.map(job => ({
            updateOne: {
                filter: { providerId: job.providerId },
                update: { $set: job },
                upsert: true
            }
        }))
    );

    const firstJob = await Job.findOne();
    if (firstJob) {
        sampleJobId = firstJob._id.toString();
    }

    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
    if (server) {
        await new Promise(resolve => server.close(resolve));
    }
    await disconnectDB();
});

test("Health check returns ok and database status", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.database.connected, true);
});

test("User Registration - succeeds with valid data", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "QA Test User",
            email: "qa.tester@example.com",
            password: "password123"
        })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.token);
    assert.strictEqual(body.user.email, "qa.tester@example.com");
    testUserId = body.user.id || body.user._id;
});

test("User Registration - rejects duplicate email", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "Duplicate User",
            email: "qa.tester@example.com",
            password: "password123"
        })
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
});

test("User Registration - rejects invalid inputs", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "",
            email: "not-an-email",
            password: "123"
        })
    });

    assert.strictEqual(res.status, 400);
});

test("User Login - succeeds with valid credentials", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "qa.tester@example.com",
            password: "password123"
        })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.token);
    authToken = body.token;
});

test("User Login - rejects invalid password", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "qa.tester@example.com",
            password: "wrongpassword"
        })
    });

    assert.strictEqual(res.status, 401);
});

test("Protected route rejects unauthorized request", async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/me`);
    assert.strictEqual(res.status, 401);
});

test("User Profile - retrieves current profile with token", async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.email, "qa.tester@example.com");
    assert.ok(body.user.profileCompletion >= 0);
});

test("User Profile - updates profile preferences and skills", async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            headline: "Senior Full Stack Architect",
            targetRole: "Full Stack Developer",
            skills: ["react", "node", "typescript", "mongodb"],
            experienceYears: 4,
            preferredWorkType: "Remote"
        })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.headline, "Senior Full Stack Architect");
    assert.strictEqual(body.user.experienceYears, 4);
    assert.ok(body.user.skills.includes("react"));
});

test("Job Search - retrieves jobs and filters by role/query", async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs?q=engineer&limit=5`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.items.length > 0);
    assert.ok(body.total >= 1);
});

test("Job Save and Unsave - saves job to user list and removes it", async () => {
    assert.ok(sampleJobId, "A seeded job must exist");

    // Save job
    const saveRes = await fetch(`${baseUrl}/api/v1/jobs/${sampleJobId}/save`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.strictEqual(saveRes.status, 200);

    // Get saved jobs
    const getRes = await fetch(`${baseUrl}/api/v1/jobs/saved`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.strictEqual(getRes.status, 200);
    const getBody = await getRes.json();
    assert.ok(getBody.items.some(j => (j._id || j.id) === sampleJobId));

    // Unsave job
    const unsaveRes = await fetch(`${baseUrl}/api/v1/jobs/${sampleJobId}/save`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.strictEqual(unsaveRes.status, 200);
});

test("AI Job Fit Analyzer - evaluates job fit and saves analysis", async () => {
    assert.ok(sampleJobId);
    const res = await fetch(`${baseUrl}/api/v1/ai/fit`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            jobId: sampleJobId,
            skills: ["node", "sql", "react"],
            resumeText: "Experienced engineer building scalable cloud systems.",
            experienceYears: 3
        })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.matchPercentage > 0);
    assert.ok(body.categories.length > 0);
    assert.ok(body.suggestions.length > 0);
});

test("AI Role Fit Analyzer - evaluates generic role fit", async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/fit-role`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            role: "Backend Developer",
            skills: ["node", "express", "sql"],
            experienceYears: 2
        })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.matchPercentage > 0);
    assert.strictEqual(body.resolvedRole, "Backend Developer");
});

test("AI Career Predictor - returns strategic role recommendations", async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/career-predict`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            skills: ["python", "pytorch", "sql"],
            experienceYears: 2,
            interests: ["ai engineer", "machine learning"],
            targetAreas: ["AI & ML"]
        })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.topRecommendations.length > 0);
    assert.ok(body.topRecommendations[0].suitabilityScore > 0);
});

test("AI Learning Roadmap - generates and persists multi-week roadmap", async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/roadmap`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            role: "Full Stack Developer",
            hoursPerDay: 2,
            months: 3
        })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.phases.length > 0);
    assert.ok(body.weeklyPlan.length > 0);
    sampleRoadmapId = body._id || body.roadmap?._id;
    sampleTaskId = body.weeklyPlan[0]._id;
});

test("AI Learning Roadmap - toggles weekly task completed status", async () => {
    assert.ok(sampleRoadmapId);
    assert.ok(sampleTaskId);

    const res = await fetch(`${baseUrl}/api/v1/ai/roadmaps/${sampleRoadmapId}/tasks/${sampleTaskId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.task.completed, true);
    assert.ok(body.progressPercentage > 0);
});

test("AI Resume Optimizer - provides ATS score and bullet recommendations", async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/resume-optimize`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            role: "Backend Developer",
            resumeText: "John Doe. Email: john@example.com. Built backend APIs using Node and PostgreSQL. Reduced query time by 30%."
        })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.atsScore > 50);
    assert.ok(body.bulletSuggestions.length > 0);
    assert.strictEqual(body.atsChecklist.hasContactSection, true);
});

test("AI Cover Letter Generator - drafts tailored letter and saves it", async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/cover-letter`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            role: "Senior Full Stack Engineer",
            companyName: "Acme Cloud",
            jobDescription: "Looking for an engineer to architect real-time dashboard systems.",
            resumeText: "Built high-throughput backend services and React frontends.",
            tone: "Confident"
        })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.coverLetter.includes("Acme Cloud"));
    assert.ok(body.coverLetter.includes("Senior Full Stack Engineer"));
});

test("AI Interview Guidance - generates structured questions and prep plan", async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/interview-guidance`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            role: "Full Stack Developer",
            focusSkills: ["react", "node", "system_design"]
        })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.technicalQuestions.length > 0);
    assert.ok(body.behavioralQuestions.length > 0);
});

test("AI Mock Interview Chat - evaluates candidate answer", async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/chat-mock-interview`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            role: "Full Stack Developer",
            messageHistory: [
                { role: "ai", content: "Tell me about a time you optimized application performance." }
            ],
            currentAnswer: "In my previous role, I noticed that our database queries were taking up to 800ms during peak hours. I analyzed the query execution plans, created compound indexes on high-frequency columns, and introduced Redis caching. As a result, average response latency decreased by 65% and API throughput doubled."
        })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.score >= 7);
    assert.ok(body.reply.length > 20);
});

test("Application Tracker - creates custom and job-linked applications", async () => {
    // Custom application
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            company: "Figma",
            jobTitle: "Design Systems Engineer",
            location: "San Francisco, CA (Remote)",
            salary: "$160k - $210k",
            status: "Applied",
            notes: "Referred by design lead. Follow up next Monday."
        })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.company, "Figma");
    assert.strictEqual(body.status, "Applied");
    sampleAppId = body._id || body.id;
});

test("Application Tracker - lists applications and updates status", async () => {
    assert.ok(sampleAppId);

    // List
    const listRes = await fetch(`${baseUrl}/api/v1/applications`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.strictEqual(listRes.status, 200);
    const list = await listRes.json();
    assert.ok(list.length >= 1);

    // Update status to Interview
    const updateRes = await fetch(`${baseUrl}/api/v1/applications/${sampleAppId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            status: "Interview",
            notes: "Technical screening scheduled for Thursday at 2 PM."
        })
    });

    assert.strictEqual(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.strictEqual(updated.status, "Interview");
});

test("Application Tracker - deletes application", async () => {
    assert.ok(sampleAppId);

    const deleteRes = await fetch(`${baseUrl}/api/v1/applications/${sampleAppId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
    });

    assert.strictEqual(deleteRes.status, 200);
    const body = await deleteRes.json();
    assert.strictEqual(body.success, true);
});

test("Career Dashboard - provides full analytics, activity timeline, and metrics", async () => {
    const res = await fetch(`${baseUrl}/api/v1/dashboard`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.user.name);
    assert.ok(typeof body.applicationsCount === "number");
    assert.ok(body.statusBreakdown !== undefined);
    assert.ok(body.fitSummary !== undefined);
    assert.ok(body.pipelineVelocity.length > 0);
});

