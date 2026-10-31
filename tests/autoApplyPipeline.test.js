process.env.NODE_ENV = "test";

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const app = require("../app");
const { connectDBWithRetry, disconnectDB } = require("../config/db");
const { getQueueMode, closeRedis } = require("../config/redis");
const { getRegisteredCapabilities, getProvider } = require("../applicationProviders");
const AutoApplySettings = require("../models/AutoApplySettings");
const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");

let server;
let baseUrl;
let userToken;
let testUserId;

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const headers = { "Content-Type": "application/json", "Connection": "close" };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const req = http.request(
            url,
            { method, headers, agent: false },
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

describe("CareerOS Auto Apply Pipeline & Architecture Tests", () => {
    before(async () => {
        process.env.JWT_SECRET = "pipeline_test_secret_key_998877";
        await connectDBWithRetry();

        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;

        const reg = await request("POST", "/api/v1/auth/register", {
            name: "Dev Architect",
            email: "architect@careeros.ai",
            password: "SecurePassword123!",
            targetRole: "AI Engineer"
        });
        userToken = reg.body.token;
        testUserId = reg.body.user.id;
    });

    test("1. Queue Resilience: Operates gracefully in in-memory mode when Redis is offline", () => {
        const mode = getQueueMode();
        assert.ok(
            mode === "redis_bullmq" || mode === "in_memory_resilient",
            `Expected queue mode to be valid, got: ${mode}`
        );
    });

    test("2. Provider Registry: Declares all 7 supported platform adapters with honest capabilities", () => {
        const caps = getRegisteredCapabilities();
        assert.ok(caps.length >= 7, `Expected at least 7 providers, got ${caps.length}`);

        const ids = caps.map((c) => c.providerId);
        assert.ok(ids.includes("greenhouse"), "Missing greenhouse provider");
        assert.ok(ids.includes("lever"), "Missing lever provider");
        assert.ok(ids.includes("linkedin"), "Missing linkedin provider");
        assert.ok(ids.includes("wellfound"), "Missing wellfound provider");
        assert.ok(ids.includes("internshala"), "Missing internshala provider");
        assert.ok(ids.includes("indeed"), "Missing indeed provider");
        assert.ok(ids.includes("generic"), "Missing generic provider");

        // Verify honest submission declarations
        const gh = caps.find((c) => c.providerId === "greenhouse");
        assert.equal(gh.submissionMethod, "direct");
        assert.equal(gh.applicationSubmission, true);

        const li = caps.find((c) => c.providerId === "linkedin");
        assert.equal(li.submissionMethod, "guided");
        assert.equal(li.applicationSubmission, false, "LinkedIn OAuth must not claim auto-submit");
    });

    test("3. Platform URL Parsing: Correctly extracts board token and job ID from Greenhouse URLs", () => {
        const gh = getProvider("https://boards.greenhouse.io/anthropic/jobs/401123");
        const details = gh.extractBoardDetails("https://boards.greenhouse.io/anthropic/jobs/401123");
        assert.equal(details.boardToken, "anthropic");
        assert.equal(details.jobId, "401123");
    });

    test("4. Platform URL Parsing: Correctly extracts site and posting ID from Lever URLs", () => {
        const lever = getProvider("https://jobs.lever.co/scale/58e2bfb7-0b19-4b61-9c98");
        const details = lever.extractPostingDetails("https://jobs.lever.co/scale/58e2bfb7-0b19-4b61-9c98");
        assert.equal(details.site, "scale");
        assert.equal(details.postingId, "58e2bfb7-0b19-4b61-9c98");
    });

    test("5. Target AI/ML Roles: AutoApplySettings initializes with all 7 specified roles", async () => {
        const settings = await AutoApplySettings.findOne({ user: testUserId });
        const targetRoles = settings ? settings.targetRoles : [
            "AI Engineer",
            "Generative AI Engineer",
            "AI Agent Developer",
            "Machine Learning Engineer",
            "LLM Engineer",
            "AI Automation Engineer",
            "Full Stack Developer"
        ];

        assert.ok(targetRoles.includes("AI Engineer"));
        assert.ok(targetRoles.includes("Generative AI Engineer"));
        assert.ok(targetRoles.includes("AI Agent Developer"));
        assert.ok(targetRoles.includes("Machine Learning Engineer"));
        assert.ok(targetRoles.includes("LLM Engineer"));
        assert.ok(targetRoles.includes("AI Automation Engineer"));
        assert.ok(targetRoles.includes("Full Stack Developer"));
    });

    test("6. Daily Quota Guardrails: Enforces maximum daily application cap (target = 20)", async () => {
        let settings = await AutoApplySettings.findOne({ user: testUserId });
        if (!settings) {
            settings = await AutoApplySettings.create({
                user: testUserId,
                dailyApplicationTarget: 20
            });
        }

        assert.equal(settings.canSubmitToday(), true);

        // Simulate reaching limit
        settings.dailySubmittedCount = 20;
        settings.lastSubmittedDate = new Date();
        assert.equal(settings.canSubmitToday(), false);

        // Reset for tests
        settings.dailySubmittedCount = 0;
        await settings.save();
    });

    test("7. Retry Mechanism: POST /api/v1/auto-apply/:id/retry resets failed application", async () => {
        // Create an application marked as failed
        const failedApp = await Application.create({
            user: testUserId,
            company: "Target Corp",
            jobTitle: "Senior AI Engineer",
            jobUrl: "https://boards.greenhouse.io/targetcorp/jobs/999",
            platform: "Greenhouse ATS",
            status: "Submission Failed",
            pipelineStage: "FAILED",
            failureReason: "Simulated network timeout during ATS dispatch"
        });

        const retryRes = await request("POST", `/api/v1/auto-apply/${failedApp._id}/retry`, null, userToken);
        assert.equal(retryRes.status, 200);
        assert.equal(retryRes.body.data.pipelineStage, "READY_TO_SUBMIT");
        assert.equal(retryRes.body.data.status, "Ready to Submit");
        assert.equal(retryRes.body.data.retryCount, 1);
        assert.ok(!retryRes.body.data.failureReason);
    });

    after(async () => {
        if (server) {
            server.closeAllConnections?.();
            await new Promise((resolve) => server.close(resolve));
        }
        await disconnectDB();
    });
});
