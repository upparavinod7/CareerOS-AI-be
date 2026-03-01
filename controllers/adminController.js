const Job = require("../models/Job");
const { mockJobs } = require("../utils/mockJobs");

exports.seedMockJobs = async (req, res, next) => {
    try {
        const operations = mockJobs.map(job => ({
            updateOne: {
                filter: { providerId: job.providerId },
                update: { $set: job },
                upsert: true
            }
        }));

        await Job.bulkWrite(operations);

        res.json({ message: "Mock jobs synced", count: mockJobs.length });
    } catch (error) {
        next(error);
    }
};
