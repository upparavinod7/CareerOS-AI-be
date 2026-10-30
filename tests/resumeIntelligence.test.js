const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");
const User = require("../models/User");
const ResumeIntelligence = require("../models/ResumeIntelligence");

let mongod;
let server;
let baseUrl;
let token;
let user;

test.before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    user = await User.create({
        name: "Dev Candidate",
        email: "candidate@careeros.ai",
        password: "Password123!",
        skills: ["React", "Node.js", "Python"]
    });
    token = jwt.sign({ sub: user._id }, process.env.JWT_SECRET || "dev_secret_change_me");

    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
    if (server) await new Promise(resolve => server.close(resolve));
});

test("POST /api/v1/ai/resume/parse validates missing payload", async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/resume/parse`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
});

test("POST /api/v1/ai/resume/quality-check validates missing resume", async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/resume/quality-check`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
});

test("POST /api/v1/ai/resume/ats-score validates missing resume and JD", async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/resume/ats-score`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
});

test("GET /api/v1/ai/resume/saved returns saved items", async () => {
    await ResumeIntelligence.create({
        user: user._id,
        title: "Test Resume",
        filename: "test.pdf",
        structuredResume: { professional_summary: "Test summary" }
    });

    const res = await fetch(`${baseUrl}/api/v1/ai/resume/saved`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(Array.isArray(data.items), true);
    assert.ok(data.items.length >= 1);
});
