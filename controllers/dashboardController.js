const FitAnalysis = require("../models/FitAnalysis");
const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");
const Roadmap = require("../models/Roadmap");

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
        const userId = req.user._id;

        const [user, fitHistory, applications, topDemand, totalJobsCount, roadmaps] = await Promise.all([
            User.findById(userId).select("-password"),
            FitAnalysis.find({ user: userId }).sort({ createdAt: -1 }).limit(15),
            Application.find({ user: userId }).sort({ updatedAt: -1 }).populate("job"),
            Job.find({ isActive: true }).sort({ demandScore: -1 }).limit(6).select("title company role demandScore location minSalary maxSalary currency"),
            Job.countDocuments({ isActive: true }),
            Roadmap.find({ user: userId }).sort({ updatedAt: -1 }).limit(5)
        ]);

        const statusBreakdown = {
            Interested: 0,
            Applied: 0,
            Assessment: 0,
            Interview: 0,
            Offer: 0,
            Rejected: 0,
            Withdrawn: 0
        };

        applications.forEach(app => {
            if (statusBreakdown[app.status] !== undefined) {
                statusBreakdown[app.status] += 1;
            } else {
                statusBreakdown[app.status] = 1;
            }
        });

        const fitScores = fitHistory.map(item => item.fitScore);
        const fitSummary = {
            last: fitScores[0] || 0,
            best: fitScores.length ? Math.max(...fitScores) : 0,
            average: fitScores.length ? Math.round(fitScores.reduce((a, b) => a + b, 0) / fitScores.length) : 0
        };

        // Unique top missing skills aggregated from recent analyses
        const missingSkillSet = new Set();
        fitHistory.forEach(analysis => {
            (analysis.missingSkills || []).forEach(s => missingSkillSet.add(s));
        });
        const topMissingSkills = Array.from(missingSkillSet).slice(0, 6);

        const pipelineVelocity = computePipelineVelocity(applications);

        const recentApplications = applications.slice(0, 5).map(app => ({
            id: app._id,
            _id: app._id,
            status: app.status,
            appliedAt: app.appliedAt,
            notes: app.notes,
            jobTitle: app.jobTitle || app.job?.title || "Job Title",
            company: app.company || app.job?.company || "Company",
            location: app.location || app.job?.location || "Remote",
            job: app.job ? {
                id: app.job._id,
                _id: app.job._id,
                title: app.job.title,
                company: app.job.company,
                role: app.job.role,
                location: app.job.location,
                sourcePlatform: app.job.sourcePlatform || "CareerOS"
            } : null
        }));

        // Build chronological recent activity timeline
        const recentActivities = [];

        applications.slice(0, 4).forEach(app => {
            recentActivities.push({
                id: `app-${app._id}`,
                type: "application",
                title: app.status === "Interview" ? "Interview Scheduled" : `Application - ${app.status}`,
                description: `${app.jobTitle || app.job?.title || "Role"} at ${app.company || app.job?.company || "Company"}`,
                date: app.updatedAt || app.appliedAt,
                badgeColor: app.status === "Offer" ? "emerald" : app.status === "Interview" ? "indigo" : "blue"
            });
        });

        fitHistory.slice(0, 3).forEach(fit => {
            recentActivities.push({
                id: `fit-${fit._id}`,
                type: "analysis",
                title: "AI Skill Match Analyzed",
                description: `Match score ${fit.fitScore}% for ${fit.role}`,
                date: fit.createdAt,
                badgeColor: fit.fitScore >= 75 ? "emerald" : "amber"
            });
        });

        roadmaps.slice(0, 2).forEach(rm => {
            recentActivities.push({
                id: `rm-${rm._id}`,
                type: "roadmap",
                title: "Learning Roadmap Progress",
                description: `${rm.title} (${rm.progressPercentage || 0}% completed)`,
                date: rm.updatedAt,
                badgeColor: "indigo"
            });
        });

        recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));

        const savedJobsCount = (user?.savedJobs || []).length;
        const profileCompletion = user ? user.getProfileCompletion() : 0;

        res.json({
            success: true,
            user: {
                id: user?._id,
                name: user?.name || "User",
                email: user?.email || "",
                targetRole: user?.targetRole || "",
                headline: user?.headline || "",
                profileCompletion
            },
            totalJobsCount,
            savedJobsCount,
            applicationsCount: applications.length,
            statusBreakdown,
            fitSummary,
            fitHistory,
            recentApplications,
            recentActivities: recentActivities.slice(0, 6),
            pipelineVelocity,
            topMissingSkills,
            marketDemand: topDemand,
            activeRoadmaps: roadmaps
        });
    } catch (error) {
        next(error);
    }
};
