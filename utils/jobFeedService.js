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
    { pattern: /devops|site reliability|sre|platform|cloud/i, role: "DevOps Engineer" },
    { pattern: /security|cyber/i, role: "Cybersecurity Analyst" },
    { pattern: /full stack|fullstack/i, role: "Full Stack Developer" },
    { pattern: /backend|node|api|server|python|java|golang/i, role: "Backend Developer" }
];

function inferRole(title, description) {
    const text = `${title} ${description}`;
    const match = titleRoleMap.find(item => item.pattern.test(text));
    return match ? match.role : "Full Stack Developer";
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
        "node", "react", "typescript", "javascript", "python", "sql", "aws", "docker",
        "kubernetes", "terraform", "ml", "pytorch", "java", "golang", "graphql", "mongodb",
        "postgresql", "redis", "next.js", "express", "ci/cd"
    ];

    const detected = dictionary.filter(skill => text.includes(skill));
    return detected.length > 0 ? detected.slice(0, 8) : ["javascript", "node", "react", "git"];
}

function clampSalary(raw, fallback) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.round(value);
}

function normalizeRemotive(items) {
    return (items || []).map(item => ({
        providerId: `remotive-${item.id}`,
        title: item.title || "Software Engineer",
        company: item.company_name || "Innovative Tech",
        location: item.candidate_required_location || "Remote",
        workType: "Remote",
        role: inferRole(item.title, item.description),
        experienceLevel: inferExperience(item.title, item.description),
        minSalary: clampSalary(item.salary_from, 70000),
        maxSalary: clampSalary(item.salary_to, 130000),
        currency: "USD",
        description: String(item.description || item.title).slice(0, 4000),
        skills: inferSkills(item.title, item.description),
        sourcePlatform: "remotive",
        sourceLabel: "Remotive",
        sourceUrl: item.url || "",
        demandScore: 78,
        postedAt: item.publication_date ? new Date(item.publication_date) : new Date(),
        syncedAt: new Date()
    }));
}

function normalizeAdzuna(items, country = "in") {
    const currencyMap = { in: "INR", gb: "GBP", uk: "GBP", us: "USD", ca: "CAD", au: "AUD" };
    const currency = currencyMap[country.toLowerCase()] || "USD";

    return (items || []).map(item => {
        const title = item.title ? item.title.replace(/<\/?[^>]+(>|$)/g, "") : "Software Engineer";
        const description = item.description ? item.description.replace(/<\/?[^>]+(>|$)/g, "") : title;
        const locName = item.location?.display_name || (country === "in" ? "India" : "Remote");
        const isRemote = /remote|work from home|telecommute/i.test(`${title} ${description} ${locName}`);

        return {
            providerId: `adzuna-${item.id}`,
            title: title.slice(0, 120),
            company: item.company?.display_name || "Enterprise Employer",
            location: locName,
            workType: isRemote ? "Remote" : "On-site",
            role: inferRole(title, description),
            experienceLevel: inferExperience(title, description),
            minSalary: clampSalary(item.salary_min, country === "in" ? 600000 : 70000),
            maxSalary: clampSalary(item.salary_max, country === "in" ? 1800000 : 130000),
            currency: currency,
            description: description.slice(0, 4000),
            skills: inferSkills(title, description),
            sourcePlatform: "adzuna",
            sourceLabel: "Adzuna Jobs",
            sourceUrl: item.redirect_url || "",
            demandScore: 80,
            postedAt: item.created ? new Date(item.created) : new Date(),
            syncedAt: new Date()
        };
    });
}

function normalizeJSearch(items) {
    return (items || []).map(item => {
        const title = item.job_title || "Software Engineer";
        const description = item.job_description || title;
        const loc = item.job_city
            ? `${item.job_city}, ${item.job_state || item.job_country || ""}`
            : (item.job_country || "Remote");

        return {
            providerId: `jsearch-${item.job_id}`,
            title: title.slice(0, 120),
            company: item.employer_name || "Tech Employer",
            location: loc,
            workType: item.job_is_remote ? "Remote" : "Hybrid",
            role: inferRole(title, description),
            experienceLevel: inferExperience(title, description),
            minSalary: clampSalary(item.job_min_salary, 75000),
            maxSalary: clampSalary(item.job_max_salary, 140000),
            currency: item.job_salary_currency || "USD",
            description: description.slice(0, 4000),
            skills: inferSkills(title, description),
            sourcePlatform: "jsearch",
            sourceLabel: "JSearch",
            sourceUrl: item.job_apply_link || item.job_google_link || "",
            demandScore: 85,
            postedAt: item.job_posted_at_timestamp ? new Date(item.job_posted_at_timestamp * 1000) : new Date(),
            syncedAt: new Date()
        };
    });
}

function normalizeArbeitnow(items) {
    return (items || []).map(item => ({
        providerId: `arbeitnow-${item.slug}`,
        title: item.title || "Software Engineer",
        company: item.company_name || "European Tech",
        location: Array.isArray(item.location) ? item.location.join(", ") : String(item.location || "Remote"),
        workType: "Remote",
        role: inferRole(item.title, item.description),
        experienceLevel: inferExperience(item.title, item.description),
        minSalary: 65000,
        maxSalary: 130000,
        currency: "USD",
        description: String(item.description || item.title).slice(0, 4000),
        skills: inferSkills(item.title, item.description),
        sourcePlatform: "arbeitnow",
        sourceLabel: "Arbeitnow",
        sourceUrl: item.url || "",
        demandScore: 72,
        postedAt: item.created_at ? new Date(item.created_at * 1000) : new Date(),
        syncedAt: new Date()
    }));
}

async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 8000);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                "User-Agent": "CareerOS-AI/1.0",
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            throw new Error(`Feed request failed: ${response.status}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function collectPublicJobs(limitPerSource = 30) {
    const result = [];
    const failures = [];

    // 1. Remotive Remote Jobs Feed
    if (process.env.REMOTIVE_ENABLED !== "false") {
        try {
            const remotive = await fetchJson("https://remotive.com/api/remote-jobs", { timeout: 7000 });
            if (remotive && Array.isArray(remotive.jobs)) {
                result.push(...normalizeRemotive(remotive.jobs).slice(0, limitPerSource));
            }
        } catch (error) {
            failures.push({ source: "remotive", message: error.message });
        }
    }

    // 2. Adzuna Real-time Job API
    const adzunaAppId = process.env.ADZUNA_APP_ID;
    const adzunaAppKey = process.env.ADZUNA_APP_KEY;
    const adzunaCountry = process.env.ADZUNA_COUNTRY || "in";
    if (adzunaAppId && adzunaAppKey && adzunaAppId !== "your_app_id") {
        try {
            const adzunaUrl = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(adzunaCountry)}/search/1?app_id=${encodeURIComponent(adzunaAppId)}&app_key=${encodeURIComponent(adzunaAppKey)}&results_per_page=${limitPerSource}&what=developer%20engineer&content-type=application/json`;
            const adzuna = await fetchJson(adzunaUrl, { timeout: 7000 });
            if (adzuna && Array.isArray(adzuna.results)) {
                result.push(...normalizeAdzuna(adzuna.results, adzunaCountry).slice(0, limitPerSource));
            }
        } catch (error) {
            failures.push({ source: "adzuna", message: error.message });
        }
    }

    // 3. JSearch RapidAPI Feed
    const jsearchKey = process.env.JSEARCH_API_KEY;
    if (jsearchKey && jsearchKey !== "your_rapidapi_key") {
        try {
            const jsearchUrl = `https://jsearch.p.rapidapi.com/search?query=software%20developer%20engineer&page=1&num_pages=1`;
            const jsearch = await fetchJson(jsearchUrl, {
                timeout: 7000,
                headers: {
                    "x-rapidapi-key": jsearchKey,
                    "x-rapidapi-host": "jsearch.p.rapidapi.com"
                }
            });
            if (jsearch && Array.isArray(jsearch.data)) {
                result.push(...normalizeJSearch(jsearch.data).slice(0, limitPerSource));
            }
        } catch (error) {
            failures.push({ source: "jsearch", message: error.message });
        }
    }

    // 4. Arbeitnow API Feed
    try {
        const arbeitnow = await fetchJson("https://www.arbeitnow.com/api/job-board-api", { timeout: 7000 });
        if (arbeitnow && Array.isArray(arbeitnow.data)) {
            result.push(...normalizeArbeitnow(arbeitnow.data).slice(0, limitPerSource));
        }
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
            update: {
                $set: job,
                $setOnInsert: { createdAt: new Date() }
            },
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
    if (process.env.JOB_SYNC_ENABLED === "false") {
        console.log("[JobSync] Background scheduler disabled by JOB_SYNC_ENABLED=false");
        return;
    }

    const intervalMs = Math.max(30000, Number(process.env.JOB_SYNC_INTERVAL_MS || 600000));

    // Initial background sync shortly after boot
    setTimeout(() => {
        syncPublicJobs().catch(error => {
            publish("jobs_sync_error", { message: error.message });
        });
    }, 2000);

    // Periodic interval
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
