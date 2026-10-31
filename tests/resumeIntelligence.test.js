const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const { connectDBWithRetry, disconnectDB } = require("../config/db");
const app = require("../app");
const User = require("../models/User");
const ResumeIntelligence = require("../models/ResumeIntelligence");

let server;
let baseUrl;
let token;
let user;

function request(method, path, body = null, authToken = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const headers = {
            "Content-Type": "application/json",
            "Connection": "close"
        };
        if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
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

describe("Resume Intelligence Test Suite", () => {
    before(async () => {
        await connectDBWithRetry();

        user = await User.create({
            name: "Dev Candidate " + Date.now(),
            email: `candidate_${Date.now()}@careeros.ai`,
            password: "Password123!",
            skills: ["React", "Node.js", "Python"]
        });
        token = jwt.sign({ sub: user._id }, process.env.JWT_SECRET || "dev_secret_change_me");

        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
    });

    test("POST /api/v1/ai/resume/parse validates missing payload", async () => {
        const res = await request("POST", "/api/v1/ai/resume/parse", {}, token);
        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
    });

    test("POST /api/v1/ai/resume/quality-check validates missing resume", async () => {
        const res = await request("POST", "/api/v1/ai/resume/quality-check", {}, token);
        assert.equal(res.status, 400);
    });

    test("POST /api/v1/ai/resume/ats-score validates missing resume and JD", async () => {
        const res = await request("POST", "/api/v1/ai/resume/ats-score", {}, token);
        assert.equal(res.status, 400);
    });

    test("GET /api/v1/ai/resume/saved returns saved items", async () => {
        await ResumeIntelligence.create({
            user: user._id,
            title: "Test Resume",
            filename: "test.pdf",
            structuredResume: { professional_summary: "Test summary" }
        });

        const res = await request("GET", "/api/v1/ai/resume/saved", null, token);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(Array.isArray(res.body.items), true);
        assert.ok(res.body.items.length >= 1);
    });

    after(async () => {
        if (server) {
            server.closeAllConnections?.();
            await new Promise((resolve) => server.close(resolve));
        }
        await disconnectDB();
    });
});
