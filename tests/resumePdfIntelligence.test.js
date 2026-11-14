const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../app");
const { connectDBWithRetry, disconnectDB } = require("../config/db");
const User = require("../models/User");
const AIServiceClient = require("../services/aiServiceClient");

let server;
let baseUrl;
let authToken;
let testUserId;

test.before(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_jwt_secret_careeros_2026";
    await connectDBWithRetry();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // Create user and get token
    const res = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "Alex Rivera",
            email: `alex.rivera.${Date.now()}@example.com`,
            password: "password123",
            targetRole: "Full Stack Engineer"
        })
    });
    const data = await res.json();
    assert.equal(data.success, true);
    authToken = data.token;
    testUserId = data.user._id;
});

test.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
});

test("PDF Resume Ingestion & LLM Tailoring Suite", async (t) => {
    let uploadedVersionId = null;

    await t.test("1. Generate valid ATS PDF and upload to POST /users/resumes/upload-pdf", async () => {
        // Generate a sample PDF via AIServiceClient
        const sampleResume = {
            personal_information: {
                full_name: "Alex Rivera",
                email: "alex.rivera@example.com",
                phone: "+1-555-0199",
                location: "San Francisco, CA",
                linkedin: "linkedin.com/in/alexrivera"
            },
            skills: {
                programming_languages: ["JavaScript", "TypeScript", "Python"],
                frameworks: ["React", "Node.js", "Express"],
                databases: ["MongoDB", "PostgreSQL"],
                cloud_tools: ["Docker", "AWS"]
            },
            experience: [
                {
                    title: "Software Engineer",
                    company: "Apex Innovations",
                    start_date: "2023",
                    end_date: "Present",
                    is_current: true,
                    highlights: [
                        "responsible for customer portal backend and optimized queries",
                        "helped team build rest apis for payment services"
                    ],
                    technologies_used: ["Node.js", "MongoDB", "Docker"]
                }
            ],
            projects: [
                {
                    name: "Cloud Fleet Monitor",
                    description: "Real-time telemetry pipeline for container clusters.",
                    technologies: ["Python", "Docker", "AWS"],
                    highlights: ["Processed streaming telemetry with sub-second latency"]
                }
            ],
            education: [
                {
                    degree: "Bachelor of Science",
                    field: "Computer Science",
                    institution: "University of California",
                    graduation_year: "2023"
                }
            ]
        };

        const pdfBuffer = await AIServiceClient.generatePDF(sampleResume);
        assert.ok(pdfBuffer.length > 500, "PDF buffer must be generated");

        const uploadRes = await fetch(`${baseUrl}/users/resumes/upload-pdf`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({
                fileBase64: pdfBuffer.toString("base64"),
                fileName: "Alex_Rivera_Master.pdf",
                setAsMaster: true,
                createVersion: true,
                title: "Master Software Engineer Resume",
                targetRole: "Full Stack Engineer"
            })
        });

        const uploadData = await uploadRes.json();
        assert.equal(uploadData.success, true);
        assert.ok(uploadData.data, "Structured resume must be returned");
        assert.ok(uploadData.rawText.length > 50, "Extracted raw text must be populated");
        assert.ok(uploadData.atsScore >= 60, "ATS score must be calculated");

        // Verify user profile in database was updated with master resume and skills
        const updatedUser = await User.findById(testUserId);
        assert.ok(updatedUser.resumeText.length > 50);
        assert.equal(updatedUser.resumeFileName, "Alex_Rivera_Master.pdf");
        assert.ok(updatedUser.resumeFileBase64.length > 0);
        assert.equal(updatedUser.resumes.length, 1);

        uploadedVersionId = updatedUser.resumes[0]._id.toString();
        assert.ok(uploadedVersionId, "Version ID must exist");
    });

    await t.test("2. Tailor resume version with LLM for target AI role", async () => {
        const tailorRes = await fetch(`${baseUrl}/users/resumes/${uploadedVersionId}/tailor`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({
                targetRole: "Senior AI Engineer",
                jobDescription: "Looking for a Senior AI Engineer experienced in Python, LLMs, RAG, and scalable microservices.",
                targetSkills: ["Python", "PyTorch", "LangChain", "FastAPI", "Docker"],
                saveAsNewVersion: true,
                newVersionTitle: "AI & ML Specialist Resume"
            })
        });

        const tailorData = await tailorRes.json();
        assert.equal(tailorData.success, true);
        assert.ok(tailorData.report, "Optimization report must be returned");
        assert.ok(tailorData.report.diffs.length > 0, "Bullet diffs must be produced");
        assert.ok(tailorData.pdfBase64.length > 500, "Tailored PDF base64 must be returned");
        assert.ok(tailorData.atsScore > 0, "Tailored ATS score must be returned");

        // Verify new tailored version was persisted in DB
        const user = await User.findById(testUserId);
        assert.equal(user.resumes.length, 2);
        const tailoredVer = user.resumes.find(r => r.title === "AI & ML Specialist Resume");
        assert.ok(tailoredVer, "Tailored version must be saved");
        assert.equal(tailoredVer.tailoredWithAI, true);
        assert.equal(tailoredVer.targetRole, "Senior AI Engineer");
        assert.ok(tailoredVer.bulletDiffs.length > 0);
    });

    await t.test("3. Download ATS-compliant PDF for tailored resume version", async () => {
        const user = await User.findById(testUserId);
        const tailoredVer = user.resumes.find(r => r.tailoredWithAI);

        const downloadRes = await fetch(`${baseUrl}/users/resumes/${tailoredVer._id}/download-pdf`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });

        assert.equal(downloadRes.status, 200);
        assert.equal(downloadRes.headers.get("content-type"), "application/pdf");
        const blob = await downloadRes.arrayBuffer();
        assert.ok(blob.byteLength > 500, "Downloaded PDF bytes must be non-empty");

        // Verify PDF magic header %PDF
        const header = Buffer.from(blob.slice(0, 4)).toString("utf-8");
        assert.equal(header, "%PDF");
    });

    await t.test("4. Download Master Resume PDF", async () => {
        const downloadRes = await fetch(`${baseUrl}/users/resumes/master/download-pdf`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });

        assert.equal(downloadRes.status, 200);
        assert.equal(downloadRes.headers.get("content-type"), "application/pdf");
        const blob = await downloadRes.arrayBuffer();
        assert.ok(blob.byteLength > 500);
        const header = Buffer.from(blob.slice(0, 4)).toString("utf-8");
        assert.equal(header, "%PDF");
    });
});
