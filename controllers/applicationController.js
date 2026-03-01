const Application = require("../models/Application");
const Job = require("../models/Job");

exports.createApplication = async (req, res, next) => {
    try {
        const { jobId, notes = "" } = req.body;

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        const application = await Application.create({
            user: req.user._id,
            job: job._id,
            notes
        });

        const populated = await application.populate("job");
        res.status(201).json(populated);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "Application already exists for this job" });
        }
        next(error);
    }
};

exports.listApplications = async (req, res, next) => {
    try {
        const items = await Application.find({ user: req.user._id })
            .populate("job")
            .sort({ updatedAt: -1 });

        res.json(items);
    } catch (error) {
        next(error);
    }
};

exports.updateApplication = async (req, res, next) => {
    try {
        const { status, notes } = req.body;

        const item = await Application.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { status, notes },
            { new: true, runValidators: true }
        ).populate("job");

        if (!item) {
            return res.status(404).json({ error: "Application not found" });
        }

        res.json(item);
    } catch (error) {
        next(error);
    }
};
