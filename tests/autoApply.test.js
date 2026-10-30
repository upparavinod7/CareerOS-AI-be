const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const app = require("../app");
const { connectDBWithRetry, disconnectDB } = require("../config/db");
const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");
const ConnectedAccount = require("../models/ConnectedAccount");
const AutoApplySettings = require("../models/AutoApplySettings");
const { encrypt, decrypt } = require("../utils/crypto");

let server;
let baseUrl;
let user1Token;
let user1Id;
let user2Token;
let user2Id;
let testJob1;
let testJob2;

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const headers = { "Content-Type": "application/json" };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const req = http.request(
            url,
            { method, headers },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(data);
                    } catch {
                        parsed = data;
                    }
                    resolve({ status: res.statusCode, headers: res.headers, body: parsed });
                });
            }
        );

        req.on("error", reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

describe("CareerOS Auto Apply & Integration Engine Test Suite", () => {
    before(async () => {
        process.env.JWT_SECRET = "test_auto_apply_secret_key_123456";
        await connectDBWithRetry();

        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;

        // Seed User 1
        const reg1 = await request("POST", "/api/v1/auth/register", {
            name: "Alex Dev",
            email: "alex.dev@testcareer.org",
            password: "password123",
            targetRole: "Full Stack Engineer"
        });
        user1Token = reg1.body.token;
        user1Id = reg1.body.user.id;

        await User.findByIdAndUpdate(user1Id, {
            skills: ["Node.js", "React", "TypeScript", "AWS", "Docker", "Kubernetes"],
            experienceYears: 4,
            phone: "+1-555-0199",
            location: "San Francisco, CA"
        });

        // Seed User 2
        const reg2 = await request("POST", "/api/v1/auth/register", {
            name: "Bob Dev",
            email: "bob.dev@testcareer.org",
            password: "password123",
            targetRole: "DevOps Engineer"
        });
        user2Token = reg2.body.token;
        user2Id = reg2.body.user.id;

        // Seed 2 Jobs
        testJob1 = await Job.create({
            title: "Senior Full Stack Engineer",
            role: "Full Stack Developer",
            company: "TechNova Corp",
            location: "San Francisco, CA",
            workType: "Remote",
            source: "greenhouse",
            sourceUrl: "https://boards.greenhouse.io/technova/jobs/101",
            description: "Seeking skilled full stack engineer experienced in Node.js, React, and AWS cloud architectures.",
            skills: ["node", "react", "typescript", "aws"],
            requirements: ["Node.js", "React", "TypeScript", "AWS"],
            tags: ["Full Stack", "React", "Node"]
        });

        testJob2 = await Job.create({
            title: "Cloud Infrastructure Specialist",
            role: "DevOps Engineer",
            company: "Apex Cloud",
            location: "Austin, TX",
            workType: "Remote",
            source: "linkedin",
            sourceUrl: "https://www.linkedin.com/jobs/view/202",
            description: "Lead DevOps and cloud infrastructure with Docker, Kubernetes, and Terraform.",
            skills: ["docker", "kubernetes", "aws", "terraform"],
            requirements: ["Docker", "Kubernetes", "AWS", "Terraform"],
            tags: ["DevOps", "Cloud"]
        });
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        await disconnectDB();
    });

    // 1. Crypto & Token Security
    test("Crypto: AES-256-GCM securely encrypts and decrypts OAuth tokens", () => {
        const rawToken = "gh_oauth_candidate_secret_token_abcdef123456";
        const encrypted = encrypt(rawToken);
        assert.notEqual(encrypted, rawToken);
        assert.ok(encrypted.includes(":"), "Format should be iv:tag:ciphertext");

        const decrypted = decrypt(encrypted);
        assert.equal(decrypted, rawToken);
    });

    // 2. Provider Capability Registry
    test("Integrations: GET /api/v1/integrations exposes accurate capability registry", async () => {
        const res = await request("GET", "/api/v1/integrations", null, user1Token);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.data));

        const linkedin = res.body.data.find(p => p.providerId === "linkedin");
        assert.ok(linkedin);
        assert.equal(linkedin.applicationSubmission, false, "LinkedIn must explicitly declare applicationSubmission as false");
        assert.equal(linkedin.submissionMethod, "guided");

        const greenhouse = res.body.data.find(p => p.providerId === "greenhouse");
        assert.ok(greenhouse);
        assert.equal(greenhouse.applicationSubmission, true);
        assert.equal(greenhouse.submissionMethod, "direct");
    });

    // 3. OAuth Connect & CSRF Protection
    test("Integrations: GET /:provider/connect generates secure CSRF state token", async () => {
        const res = await request("GET", "/api/v1/integrations/linkedin/connect", null, user1Token);
        assert.equal(res.status, 200);
        assert.ok(res.body.data.authUrl);
        assert.ok(res.body.data.stateToken);
        assert.ok(res.body.data.authUrl.includes(res.body.data.stateToken));
    });

    test("Integrations: POST /:provider/callback rejects mismatched CSRF state", async () => {
        const res = await request("POST", "/api/v1/integrations/linkedin/callback", {
            code: "valid_code",
            state: "tampered_or_expired_state_token"
        }, user1Token);
        assert.equal(res.status, 400);
        assert.ok(res.body.message.includes("state"));
    });

    test("Integrations: Connects account and stores encrypted token", async () => {
        // Connect Greenhouse with employer credentials
        const res = await request("POST", "/api/v1/integrations/greenhouse/callback", {
            boardToken: "technova",
            apiKey: "gh_test_api_key_secure_123"
        }, user1Token);

        assert.equal(res.status, 200);
        assert.equal(res.body.data.provider, "greenhouse");
        assert.equal(res.body.data.hasAccessToken, true);

        // Verify token is encrypted in DB
        const savedAccount = await ConnectedAccount.findOne({ user: user1Id, provider: "greenhouse" });
        assert.ok(savedAccount.encryptedAccessToken);
        assert.notEqual(savedAccount.encryptedAccessToken, "gh_test_api_key_secure_123");
        assert.equal(savedAccount.getAccessToken(), "gh_test_api_key_secure_123");
    });

    test("Integrations: GET /accounts returns connected accounts with tokens masked", async () => {
        const res = await request("GET", "/api/v1/integrations/accounts", null, user1Token);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.length, 1);
        assert.equal(res.body.data[0].provider, "greenhouse");
        assert.equal(res.body.data[0].encryptedAccessToken, undefined);
    });

    // 4. Multi-Resume Version Management
    test("Resumes: Uploads multiple tailored resumes and changes default", async () => {
        // Add Resume 1
        const r1 = await request("POST", "/api/v1/users/resumes", {
            title: "Full Stack Web Focus",
            targetRole: "Full Stack Engineer",
            resumeText: "Experienced in Node, React, PostgreSQL, REST APIs",
            skills: ["Node.js", "React", "PostgreSQL"],
            isDefault: true
        }, user1Token);
        assert.equal(r1.status, 201);
        assert.equal(r1.body.data.title, "Full Stack Web Focus");
        const r1Id = r1.body.data._id;

        // Add Resume 2
        const r2 = await request("POST", "/api/v1/users/resumes", {
            title: "Cloud & DevOps Focus",
            targetRole: "DevOps Engineer",
            resumeText: "Specialized in AWS, Docker, Kubernetes, CI/CD",
            skills: ["AWS", "Docker", "Kubernetes"],
            isDefault: false
        }, user1Token);
        assert.equal(r2.status, 201);
        const r2Id = r2.body.data._id;

        // List resumes
        const list = await request("GET", "/api/v1/users/resumes", null, user1Token);
        assert.equal(list.status, 200);
        assert.equal(list.body.data.length, 2);

        // Set Resume 2 as default
        const defRes = await request("PATCH", `/api/v1/users/resumes/${r2Id}/default`, null, user1Token);
        assert.equal(defRes.status, 200);

        const updatedUser = await User.findById(user1Id);
        const activeDef = updatedUser.resumes.find(r => r.isDefault);
        assert.equal(String(activeDef._id), r2Id);
    });

    // 5. Matching Jobs Feed
    test("Auto Apply: GET /jobs returns opportunities with match scores and duplicate status", async () => {
        const res = await request("GET", "/api/v1/auto-apply/jobs", null, user1Token);
        assert.equal(res.status, 200);
        assert.ok(res.body.data.length >= 2);
        assert.ok(typeof res.body.data[0].matchScore === "number");
        assert.equal(res.body.data[0].hasApplied, false);
    });

    // 6. Application Preparation Engine
    test("Auto Apply: POST /prepare crafts tailored application draft and selects best resume", async () => {
        const res = await request("POST", "/api/v1/auto-apply/prepare", {
            jobId: String(testJob1._id)
        }, user1Token);

        assert.equal(res.status, 201);
        assert.equal(res.body.data.status, "Awaiting Approval");
        assert.equal(res.body.data.company, "TechNova Corp");
        assert.ok(res.body.data.coverLetter.length > 50);
        assert.ok(res.body.data.questionAnswers.length >= 4);
        assert.equal(res.body.data.approvalRecord.approved, false);
    });

    test("Auto Apply: POST /prepare enforces duplicate prevention", async () => {
        const res = await request("POST", "/api/v1/auto-apply/prepare", {
            jobId: String(testJob1._id)
        }, user1Token);

        assert.equal(res.status, 409, "Should reject duplicate application for same job vacancy");
        assert.ok(res.body.message.includes("already have an active application"));
    });

    // 7. Approval System & Submission Execution
    test("Auto Apply: Approval workflow transitions status and executes direct submission", async () => {
        const queueRes = await request("GET", "/api/v1/auto-apply/queue", null, user1Token);
        assert.equal(queueRes.status, 200);
        const appToApprove = queueRes.body.data[0];
        assert.ok(appToApprove);

        // Cannot submit before approval when requireApproval is true
        const prematureSubmit = await request("POST", `/api/v1/auto-apply/${appToApprove._id}/submit`, null, user1Token);
        assert.equal(prematureSubmit.status, 400);

        // Approve application
        const approveRes = await request("POST", `/api/v1/auto-apply/${appToApprove._id}/approve`, {
            notes: "Candidate approved tailored answers."
        }, user1Token);
        assert.equal(approveRes.status, 200);
        assert.equal(approveRes.body.data.status, "Ready to Submit");
        assert.equal(approveRes.body.data.approvalRecord.approved, true);

        // Execute direct submission
        const submitRes = await request("POST", `/api/v1/auto-apply/${appToApprove._id}/submit`, null, user1Token);
        assert.equal(submitRes.status, 200);
        assert.equal(submitRes.body.submissionMethod, "direct");
        assert.equal(submitRes.body.data.status, "Submitted");
        assert.ok(submitRes.body.data.providerConfirmation.confirmationId);
    });

    // 8. Guided Application Workflow (e.g. LinkedIn)
    test("Auto Apply: Guided workflow assists candidate with external submission and confirmation", async () => {
        // Prepare Job 2 (LinkedIn)
        const prep = await request("POST", "/api/v1/auto-apply/prepare", {
            jobId: String(testJob2._id)
        }, user1Token);
        assert.equal(prep.status, 201);
        const appId = prep.body.data._id;

        // Approve it
        await request("POST", `/api/v1/auto-apply/${appId}/approve`, {}, user1Token);

        // Trigger submit -> returns guided package
        const submitRes = await request("POST", `/api/v1/auto-apply/${appId}/submit`, null, user1Token);
        assert.equal(submitRes.status, 200);
        assert.equal(submitRes.body.submissionMethod, "guided");
        assert.ok(submitRes.body.data.guidedPackage.destinationUrl);
        assert.ok(submitRes.body.data.guidedPackage.preparedAnswers.length > 0);

        // Candidate confirms external submission
        const confirmRes = await request("POST", `/api/v1/auto-apply/${appId}/confirm-guided`, {
            confirmationId: "LI-EXT-987654",
            notes: "Submitted via LinkedIn Easy Apply with attached resume"
        }, user1Token);

        assert.equal(confirmRes.status, 200);
        assert.equal(confirmRes.body.data.status, "Submitted");
        assert.equal(confirmRes.body.data.providerConfirmation.confirmationId, "LI-EXT-987654");
    });

    // 9. Overview Analytics & Daily Quota
    test("Auto Apply: GET /overview displays real aggregation metrics", async () => {
        const res = await request("GET", "/api/v1/auto-apply/overview", null, user1Token);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.submitted, 2);
        assert.equal(res.body.data.dailyProgress.submittedToday, 2);
        assert.equal(res.body.data.dailyProgress.dailyTarget, 10);
    });

    // 10. User Isolation
    test("Security: User 2 cannot access or submit User 1's applications", async () => {
        const u1Apps = await Application.find({ user: user1Id });
        assert.ok(u1Apps.length > 0);
        const targetId = u1Apps[0]._id;

        const res = await request("POST", `/api/v1/auto-apply/${targetId}/submit`, null, user2Token);
        assert.equal(res.status, 404, "User 2 should receive 404 for User 1's application");
    });

    // 11. Live Feed Synchronization Trigger
    test("Auto Apply: POST /sync triggers live job feed synchronization", async () => {
        const res = await request("POST", "/api/v1/auto-apply/sync", {}, user1Token);
        assert.equal(res.status, 200);
        assert.ok(res.body.data);
    });

    // 12. Auto-Run Automation Engine
    test("Auto Apply: POST /auto-run automatically matches and processes applications", async () => {
        // Give User 2 relevant skills
        await User.findByIdAndUpdate(user2Id, {
            skills: ["aws", "docker", "kubernetes", "terraform"],
            experienceYears: 3
        });

        // Create an unapplied job that matches user2
        const jobForUser2 = await Job.create({
            title: "DevOps Platform Engineer",
            role: "DevOps Engineer",
            company: "CloudScale Systems",
            location: "Remote",
            workType: "Remote",
            source: "greenhouse",
            sourceUrl: "https://boards.greenhouse.io/cloudscale/jobs/505",
            description: "Deploy and scale Kubernetes and AWS cloud infrastructure.",
            skills: ["aws", "docker", "kubernetes", "terraform"],
            requirements: ["AWS", "Kubernetes"]
        });

        // Set requireApproval=false on user2 for automatic submission
        await request("PATCH", "/api/v1/auto-apply/settings", {
            requireApproval: false,
            minMatchScore: 50
        }, user2Token);

        const runRes = await request("POST", "/api/v1/auto-apply/auto-run", {}, user2Token);
        assert.equal(runRes.status, 200);
        assert.ok(runRes.body.data.processedCount >= 1);
    });
});
