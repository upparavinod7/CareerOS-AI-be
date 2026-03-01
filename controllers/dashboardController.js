const FitAnalysis = require("../models/FitAnalysis");
const Application = require("../models/Application");
const Job = require("../models/Job");

function computePipelineVelocity(applications) {
    const weeks = Array.from({ length: 6 }).map((_, idx) => {
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() - idx * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        return { start, end, label: `W${6 - idx}` };
    }).reverse();

    return weeks.map((bucket) => {
        const count = applications.filter((app) => {
            const d = new Date(app.appliedAt || app.createdAt || Date.now());
            return d >= bucket.start && d <= bucket.end;
        }).length;
        return { label: bucket.label, count };
    });
}

exports.getDashboard = async (req, res, next) => {
    try {
        const [fitHistory, applications, topDemand] = await Promise.all([
            FitAnalysis.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20),
            Application.find({ user: req.user._id }).sort({ appliedAt: -1 }).populate("job", "title company location role sourcePlatform sourceLabel"),
            Job.find({ isActive: true }).sort({ demandScore: -1 }).limit(8).select("title role demandScore location")
        ]);

        const statusBreakdown = applications.reduce(
            (acc, item) => {
                acc[item.status] = (acc[item.status] || 0) + 1;
                return acc;
            },
            {}
        );

        const fitScores = fitHistory.map(item => item.fitScore);
        const fitSummary = {
            last: fitScores[0] || 0,
            best: fitScores.length ? Math.max(...fitScores) : 0,
            average: fitScores.length ? Math.round(fitScores.reduce((a, b) => a + b, 0) / fitScores.length) : 0
        };

        const topMissingSkills = fitHistory[0]?.missingSkills?.slice(0, 5) || [];
        const pipelineVelocity = computePipelineVelocity(applications);

        const recentApplications = applications.slice(0, 6).map(app => ({
            id: app._id,
            status: app.status,
            appliedAt: app.appliedAt,
            job: app.job ? {
                id: app.job._id,
                title: app.job.title,
                company: app.job.company,
                role: app.job.role,
                location: app.job.location,
                sourcePlatform: app.job.sourcePlatform || app.job.sourceLabel || "Job"
            } : null
        }));

        res.json({
            fitHistory,
            fitSummary,
            applicationsCount: applications.length,
            statusBreakdown,
            recentApplications,
            pipelineVelocity,
            topMissingSkills,
            marketDemand: topDemand
        });
    } catch (error) {
        next(error);
    }
};
