const Job = require("../models/Job");
const { extractKeywords } = require("../utils/aiEngine");
const { stream, connectedClients } = require("../utils/jobRealtime");
const { syncPublicJobs, getSyncState } = require("../utils/jobFeedService");

exports.searchJobs = async (req, res, next) => {
    try {
        const {
            role,
            location,
            experience,
            minSalary,
            maxSalary,
            source,
            page = 1,
            limit = 12,
            q,
            sort = "recent"
        } = req.query;

        const filter = { isActive: true };

        if (role) filter.role = new RegExp(String(role), "i");
        if (location) filter.location = new RegExp(String(location), "i");
        if (experience) filter.experienceLevel = String(experience);
        if (source) filter.sourcePlatform = String(source).toLowerCase();
        if (minSalary) filter.maxSalary = { $gte: Number(minSalary) };
        if (maxSalary) filter.minSalary = { ...(filter.minSalary || {}), $lte: Number(maxSalary) };

        if (q) {
            filter.$text = { $search: String(q) };
        }

        const pageNum = Math.max(1, Number(page));
        const perPage = Math.max(1, Math.min(50, Number(limit)));

        const sortBy = sort === "demand"
            ? { demandScore: -1, postedAt: -1 }
            : { postedAt: -1, demandScore: -1 };

        const [items, total] = await Promise.all([
            Job.find(filter)
                .sort(sortBy)
                .skip((pageNum - 1) * perPage)
                .limit(perPage),
            Job.countDocuments(filter)
        ]);

        res.json({
            page: pageNum,
            limit: perPage,
            total,
            totalPages: Math.ceil(total / perPage),
            items,
            realtime: {
                connectedClients: connectedClients(),
                sync: getSyncState()
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getJobById = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        const keywords = extractKeywords(job.description);
        res.json({ ...job.toObject(), keywords });
    } catch (error) {
        next(error);
    }
};

exports.streamJobs = (req, res) => {
    stream(req, res);
};

exports.syncJobs = async (req, res, next) => {
    try {
        const result = await syncPublicJobs();
        res.json(result);
    } catch (error) {
        next(error);
    }
};

exports.getSyncStatus = async (req, res) => {
    const total = await Job.countDocuments({ isActive: true });
    res.json({
        totalActiveJobs: total,
        ...getSyncState(),
        connectedClients: connectedClients()
    });
};
