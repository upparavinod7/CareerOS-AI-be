const Job = require("../models/Job");
const { publish } = require("./jobRealtime");

let syncState = {
    running: false,
    lastSyncAt: null,
    lastResult: null
};

const titleRoleMap = [
    { pattern: /data scientist|ml scientist|analytics/i, role: "Data Scientist" },
    { pattern: /machine learning|ai engineer|nlp|computer vision/i, role: "AI/ML Engineer" },
    { pattern: /frontend|react|ui engineer/i, role: "Frontend Developer" },
    { pattern: /devops|site reliability|sre|platform/i, role: "DevOps Engineer" },
    { pattern: /cloud/i, role: "Cloud Engineer" },
    { pattern: /security|cyber/i, role: "Cybersecurity Analyst" },
    { pattern: /backend|node|api|server/i, role: "Backend Developer" }
];

function inferRole(title, description) {
    const text = `${title} ${description}`;
    const match = titleRoleMap.find(item => item.pattern.test(text));
    return match ? match.role : "Backend Developer";
}

function inferExperience(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    if (text.includes("lead")) return "Lead";
    if (text.includes("senior") || text.includes("sr.")) return "Senior";
    if (text.includes("mid")) return "Mid";
    if (text.includes("intern")) return "Intern";
    return "Junior";
}

function inferSkills(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    const dictionary = [
        "node", "react", "typescript", "python", "sql", "aws", "docker",
        "kubernetes", "terraform", "ml", "pytorch", "java", "go", "system_design"
    ];

    return dictionary.filter(skill => text.includes(skill)).slice(0, 8);
}

function clampSalary(raw, fallback) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.round(value);
}

function normalizeRemotive(items) {
    return (items || []).map(item => ({
        providerId: `remotive-${item.id}`,
        title: item.title || "Untitled Role",
        company: item.company_name || "Unknown",
        location: item.candidate_required_location || "Remote",
        role: inferRole(item.title, item.description),
        experienceLevel: inferExperience(item.title, item.description),
        minSalary: clampSalary(item.salary_from, 60000),
        maxSalary: clampSalary(item.salary_to, 120000),
        currency: "USD",
        description: String(item.description || "").slice(0, 4000),
        skills: inferSkills(item.title, item.description),
        sourcePlatform: "remotive",
        sourceLabel: "Remotive",
        sourceUrl: item.url || "",
        demandScore: 70,
        postedAt: item.publication_date ? new Date(item.publication_date) : new Date(),
        syncedAt: new Date()
    }));
}

function normalizeArbeitnow(items) {
    return (items || []).map(item => ({
        providerId: `arbeitnow-${item.slug}`,
        title: item.title || "Untitled Role",
        company: item.company_name || "Unknown",
        location: Array.isArray(item.location) ? item.location.join(", ") : String(item.location || "Remote"),
        role: inferRole(item.title, item.description),
        experienceLevel: inferExperience(item.title, item.description),
        minSalary: 65000,
        maxSalary: 130000,
        currency: "USD",
        description: String(item.description || "").slice(0, 4000),
        skills: inferSkills(item.title, item.description),
        sourcePlatform: "arbeitnow",
        sourceLabel: "Arbeitnow",
        sourceUrl: item.url || "",
        demandScore: 68,
        postedAt: item.created_at ? new Date(item.created_at * 1000) : new Date(),
        syncedAt: new Date()
    }));
}

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: { "User-Agent": "CareerOS-AI/1.0" }
    });

    if (!response.ok) {
        throw new Error(`Feed request failed: ${response.status}`);
    }

    return response.json();
}

async function collectPublicJobs(limitPerSource = 30) {
    const result = [];
    const failures = [];

    try {
        const remotive = await fetchJson("https://remotive.com/api/remote-jobs");
        result.push(...normalizeRemotive(remotive.jobs).slice(0, limitPerSource));
    } catch (error) {
        failures.push({ source: "remotive", message: error.message });
    }

    try {
        const arbeitnow = await fetchJson("https://www.arbeitnow.com/api/job-board-api");
        result.push(...normalizeArbeitnow(arbeitnow.data).slice(0, limitPerSource));
    } catch (error) {
        failures.push({ source: "arbeitnow", message: error.message });
    }

    return { jobs: result, failures };
}

async function upsertJobs(jobs) {
    if (!jobs.length) return { inserted: 0, updated: 0 };

    const operations = jobs.map(job => ({
        updateOne: {
            filter: { providerId: job.providerId },
            update: { $set: job, $setOnInsert: { createdAt: new Date() } },
            upsert: true
        }
    }));

    const response = await Job.bulkWrite(operations);
    return {
        inserted: response.upsertedCount || 0,
        updated: response.modifiedCount || 0
    };
}

async function syncPublicJobs() {
    if (syncState.running) {
        return syncState.lastResult || { message: "Sync already in progress" };
    }

    syncState.running = true;
    const startedAt = Date.now();

    try {
        const { jobs, failures } = await collectPublicJobs(Number(process.env.JOB_SYNC_LIMIT || 30));
        const writeStats = await upsertJobs(jobs);
        const totalActive = await Job.countDocuments({ isActive: true });

        const result = {
            fetched: jobs.length,
            failures,
            ...writeStats,
            totalActive,
            durationMs: Date.now() - startedAt
        };

        syncState.lastSyncAt = new Date().toISOString();
        syncState.lastResult = result;

        publish("jobs_sync", {
            ...result,
            lastSyncAt: syncState.lastSyncAt
        });

        return result;
    } finally {
        syncState.running = false;
    }
}

function getSyncState() {
    return {
        ...syncState,
        running: Boolean(syncState.running)
    };
}

function startJobsSyncScheduler() {
    const intervalMs = Math.max(30000, Number(process.env.JOB_SYNC_INTERVAL_MS || 300000));

    setTimeout(() => {
        syncPublicJobs().catch(error => {
            publish("jobs_sync_error", { message: error.message });
        });
    }, 1500);

    setInterval(() => {
        syncPublicJobs().catch(error => {
            publish("jobs_sync_error", { message: error.message });
        });
    }, intervalMs);
}

module.exports = {
    syncPublicJobs,
    getSyncState,
    startJobsSyncScheduler
};
