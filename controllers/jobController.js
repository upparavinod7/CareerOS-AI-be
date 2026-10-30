const Job = require("../models/Job");
const User = require("../models/User");
const { extractKeywords } = require("../utils/aiEngine");
const { stream, connectedClients } = require("../utils/jobRealtime");
const { syncPublicJobs, getSyncState } = require("../utils/jobFeedService");

exports.searchJobs = async (req, res, next) => {
    try {
        const {
            role,
            location,
            workType,
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
        if (workType) filter.workType = new RegExp(String(workType), "i");
        if (experience) filter.experienceLevel = String(experience);
        if (source) filter.sourcePlatform = String(source).toLowerCase();
        if (minSalary) filter.maxSalary = { $gte: Number(minSalary) };
        if (maxSalary) filter.minSalary = { ...(filter.minSalary || {}), $lte: Number(maxSalary) };

        if (q) {
            const queryStr = String(q).trim();
            filter.$or = [
                { title: new RegExp(queryStr, "i") },
                { company: new RegExp(queryStr, "i") },
                { role: new RegExp(queryStr, "i") },
                { skills: new RegExp(queryStr, "i") },
                { location: new RegExp(queryStr, "i") }
            ];
        }

        const pageNum = Math.max(1, Number(page));
        const perPage = Math.max(1, Math.min(50, Number(limit)));

        let sortBy = { postedAt: -1, demandScore: -1 };
        if (sort === "demand") {
            sortBy = { demandScore: -1, postedAt: -1 };
        } else if (sort === "salary") {
            sortBy = { maxSalary: -1, minSalary: -1, postedAt: -1 };
        }

        const [items, total] = await Promise.all([
            Job.find(filter)
                .sort(sortBy)
                .skip((pageNum - 1) * perPage)
                .limit(perPage),
            Job.countDocuments(filter)
        ]);

        res.json({
            success: true,
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
            return res.status(404).json({ success: false, error: "Job not found" });
        }

        const keywords = extractKeywords(job.description);
        res.json({
            success: true,
            job: { ...job.toObject(), keywords }
        });
    } catch (error) {
        next(error);
    }
};

exports.saveJob = async (req, res, next) => {
    try {
        const jobId = req.params.id;
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ success: false, error: "Job not found" });
        }

        const user = await User.findById(req.user._id);
        if (!user.savedJobs) {
            user.savedJobs = [];
        }

        const alreadySaved = user.savedJobs.some(id => id.toString() === jobId);
        if (!alreadySaved) {
            user.savedJobs.push(jobId);
            await user.save();
        }

        res.json({
            success: true,
            message: "Job saved successfully",
            savedJobs: user.savedJobs
        });
    } catch (error) {
        next(error);
    }
};

exports.unsaveJob = async (req, res, next) => {
    try {
        const jobId = req.params.id;
        const user = await User.findById(req.user._id);
        if (user.savedJobs) {
            user.savedJobs = user.savedJobs.filter(id => id.toString() !== jobId);
            await user.save();
        }

        res.json({
            success: true,
            message: "Job removed from saved jobs",
            savedJobs: user.savedJobs || []
        });
    } catch (error) {
        next(error);
    }
};

exports.getSavedJobs = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: "savedJobs",
            match: { isActive: true }
        });

        res.json({
            success: true,
            items: user.savedJobs || [],
            total: (user.savedJobs || []).length
        });
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
        res.json({
            success: true,
            message: "Job sync completed",
            ...result
        });
    } catch (error) {
        next(error);
    }
};

exports.getSyncStatus = async (req, res) => {
    const total = await Job.countDocuments({ isActive: true });
    res.json({
        success: true,
        totalActiveJobs: total,
        ...getSyncState(),
        connectedClients: connectedClients()
    });
};
