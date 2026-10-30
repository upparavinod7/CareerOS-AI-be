const Job = require("../models/Job");
const User = require("../models/User");
const Application = require("../models/Application");
const AutoApplySettings = require("../models/AutoApplySettings");
const { evaluateJobFit } = require("../utils/aiEngine");
const { prepareApplicationPackage } = require("../utils/applicationPreparer");
const { getProvider } = require("../applicationProviders");

/**
 * Helper to retrieve or create default auto-apply settings
 */
async function getOrCreateSettings(userId) {
    let settings = await AutoApplySettings.findOne({ user: userId });
    if (!settings) {
        settings = new AutoApplySettings({ user: userId });
        await settings.save();
    }
    return settings;
}

/**
 * GET /api/v1/auto-apply/overview
 * Real-time dashboard analytics
 */
async function getOverview(req, res, next) {
    try {
        const userId = req.user._id;
        const settings = await getOrCreateSettings(userId);

        // Aggregate actual status counts from database
        const counts = await Application.aggregate([
            { $match: { user: userId } },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        const statusMap = {};
        counts.forEach(c => {
            statusMap[c._id] = c.count;
        });

        // Total matching jobs discovered
        const totalDiscovered = await Job.countDocuments();

        const data = {
            totalDiscovered,
            shortlisted: statusMap["Shortlisted"] || 0,
            preparing: statusMap["Preparing"] || 0,
            awaitingApproval: statusMap["Awaiting Approval"] || 0,
            readyToSubmit: statusMap["Ready to Submit"] || 0,
            submitted: statusMap["Submitted"] || statusMap["Applied"] || 0,
            failed: statusMap["Submission Failed"] || 0,
            interviews: statusMap["Interview"] || 0,
            offers: statusMap["Offer"] || 0,
            dailyProgress: {
                submittedToday: settings.dailySubmittedCount,
                dailyTarget: settings.dailyApplicationTarget,
                canSubmitMore: settings.canSubmitToday(),
                isPaused: settings.isPaused
            },
            settings: {
                minMatchScore: settings.minMatchScore,
                remoteOnly: settings.remoteOnly,
                targetRoles: settings.targetRoles,
                requireApproval: settings.requireApproval
            }
        };

        return res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/auto-apply/jobs
 * Retrieves jobs ranked by match score with duplicate prevention status
 */
async function getMatchingJobs(req, res, next) {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        const settings = await getOrCreateSettings(userId);

        // Fetch existing applications to flag duplicates
        const existingApps = await Application.find({ user: userId }).select("job status appliedAt");
        const existingJobMap = new Map();
        existingApps.forEach(app => {
            if (app.job) existingJobMap.set(String(app.job), app);
        });

        const query = {};
        if (settings.remoteOnly) {
            query.workType = "Remote";
        }

        const jobs = await Job.find(query).limit(100).lean();

        // Calculate explainable fit scores
        const matched = [];
        for (const job of jobs) {
            // Exclude companies user excluded
            if (settings.excludedCompanies && settings.excludedCompanies.length > 0) {
                const isExcluded = settings.excludedCompanies.some(c =>
                    c.toLowerCase() === (job.company || "").toLowerCase()
                );
                if (isExcluded) continue;
            }

            const fit = evaluateJobFit(user, job);
            const isExisting = existingJobMap.has(String(job._id));
            const existingApp = existingJobMap.get(String(job._id));

            if (fit.score >= (settings.minMatchScore || 60)) {
                matched.push({
                    ...job,
                    matchScore: fit.score,
                    matchingSkills: fit.matchingSkills || [],
                    missingSkills: fit.missingSkills || [],
                    eligibilityConcerns: fit.score < 75 ? ["Moderate match: review requirements carefully."] : [],
                    hasApplied: isExisting,
                    applicationStatus: existingApp ? existingApp.status : null,
                    applicationId: existingApp ? existingApp._id : null
                });
            }
        }

        // Sort by match score descending
        matched.sort((a, b) => b.matchScore - a.matchScore);

        return res.json({
            success: true,
            count: matched.length,
            data: matched.slice(0, 50)
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/auto-apply/queue
 * Returns applications in Preparing, Awaiting Approval, or Ready to Submit
 */
async function getQueue(req, res, next) {
    try {
        const items = await Application.find({
            user: req.user._id,
            status: { $in: ["Preparing", "Awaiting Approval", "Ready to Submit", "Shortlisted"] }
        })
            .populate("job")
            .sort({ createdAt: -1 });

        return res.json({ success: true, count: items.length, data: items });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/auto-apply/prepare
 * Prepares a tailored application draft for a selected job
 */
async function prepareApplication(req, res, next) {
    try {
        const { jobId } = req.body;
        if (!jobId) {
            return res.status(400).json({ success: false, message: "jobId is required." });
        }

        // 1. Prevent duplicate applications
        const existing = await Application.findOne({ user: req.user._id, job: jobId });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `You already have an active application (${existing.status}) for this job.`,
                data: existing
            });
        }

        const [user, job] = await Promise.all([
            User.findById(req.user._id),
            Job.findById(jobId)
        ]);

        if (!job) {
            return res.status(404).json({ success: false, message: "Job listing not found." });
        }

        // 2. Prepare tailored package (resume, cover letter, screening answers, fit score)
        const prep = await prepareApplicationPackage(user, job);

        // 3. Resolve destination provider and determine submission method
        const provider = getProvider(job.source || job.sourceUrl || job.title);
        const capabilities = provider.getCapabilities();

        const application = new Application({
            user: req.user._id,
            job: job._id,
            company: job.company,
            jobTitle: job.title,
            location: job.location,
            salary: job.salary ? `${job.salary.min || ""} - ${job.salary.max || ""} ${job.salary.currency || ""}` : "",
            jobUrl: job.sourceUrl || "",
            status: "Awaiting Approval",
            platform: provider.name,
            submissionMethod: capabilities.submissionMethod,
            resumeVersionId: prep.selectedResume.resumeId,
            resumeTitle: prep.selectedResume.title,
            resumeSnapshot: prep.selectedResume.snapshot,
            coverLetter: prep.coverLetter,
            questionAnswers: prep.questionAnswers,
            matchScore: prep.matchScore,
            matchingSkills: prep.matchingSkills,
            missingSkills: prep.missingSkills,
            eligibilityConcerns: prep.eligibilityConcerns,
            approvalRecord: {
                approved: false,
                notes: ""
            }
        });

        await application.save();

        return res.status(201).json({
            success: true,
            message: "Application package successfully prepared and awaiting candidate review.",
            data: application
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/auto-apply/:id/approve
 * Candidate explicitly approves application for submission
 */
async function approveApplication(req, res, next) {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const application = await Application.findOne({ _id: id, user: req.user._id });
        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found." });
        }

        application.approvalRecord = {
            approved: true,
            approvedAt: new Date(),
            notes: notes || "Candidate approved application package."
        };
        application.status = "Ready to Submit";
        await application.save();

        return res.json({
            success: true,
            message: "Application approved and ready for submission.",
            data: application
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/v1/auto-apply/:id/answers
 * Allows editing question answers, cover letter, or selected resume
 */
async function updateApplicationAnswers(req, res, next) {
    try {
        const { id } = req.params;
        const { questionAnswers, coverLetter, resumeTitle, resumeSnapshot } = req.body;

        const application = await Application.findOne({ _id: id, user: req.user._id });
        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found." });
        }

        if (questionAnswers && Array.isArray(questionAnswers)) {
            application.questionAnswers = questionAnswers;
        }
        if (typeof coverLetter === "string") {
            application.coverLetter = coverLetter;
        }
        if (resumeTitle) application.resumeTitle = resumeTitle;
        if (resumeSnapshot) application.resumeSnapshot = resumeSnapshot;

        await application.save();

        return res.json({
            success: true,
            message: "Application updated successfully.",
            data: application
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/auto-apply/:id/submit
 * Executes submission (Direct API if authorized; Guided workflow package if platform restricted)
 */
async function submitApplication(req, res, next) {
    try {
        const { id } = req.params;
        const [application, user, settings] = await Promise.all([
            Application.findOne({ _id: id, user: req.user._id }).populate("job"),
            User.findById(req.user._id),
            getOrCreateSettings(req.user._id)
        ]);

        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found." });
        }

        // Verify user approval was recorded if required
        if (settings.requireApproval && !application.approvalRecord?.approved) {
            return res.status(400).json({
                success: false,
                message: "Application must be reviewed and approved before submission."
            });
        }

        // Verify daily application limit
        if (!settings.canSubmitToday()) {
            return res.status(429).json({
                success: false,
                message: settings.isPaused
                    ? "Auto Apply is currently paused in your settings."
                    : `Daily submission target of ${settings.dailyApplicationTarget} applications reached. Resets tomorrow.`
            });
        }

        const provider = getProvider(application.platform || application.jobUrl);
        const capabilities = provider.getCapabilities();

        // 1. Direct API Submission (Greenhouse, Lever where configured)
        if (capabilities.applicationSubmission && capabilities.submissionMethod === "direct") {
            try {
                const submissionResult = await provider.submitDirect({
                    candidateName: user.name,
                    candidateEmail: user.email,
                    candidatePhone: user.phone,
                    resumeSnapshot: application.resumeSnapshot,
                    coverLetter: application.coverLetter,
                    questionAnswers: application.questionAnswers,
                    jobId: application.job?._id || application.jobTitle
                });

                application.status = "Submitted";
                application.providerConfirmation = {
                    confirmationId: submissionResult.confirmationId,
                    responseMessage: "Direct submission accepted by platform API.",
                    submittedAt: new Date()
                };
                application.appliedAt = new Date();
                await application.save();

                settings.recordSubmission();
                await settings.save();

                return res.json({
                    success: true,
                    submissionMethod: "direct",
                    message: "Application successfully submitted via official integration.",
                    data: application
                });
            } catch (submitErr) {
                application.status = "Submission Failed";
                application.notes = submitErr.message;
                await application.save();

                return res.status(502).json({
                    success: false,
                    submissionMethod: "direct",
                    message: `Platform API submission failed: ${submitErr.message}`
                });
            }
        }

        // 2. Guided Application Workflow (LinkedIn, Indeed, Generic Career Portals)
        const guidedPackage = await provider.generateGuidedPackage({
            jobUrl: application.jobUrl || application.job?.sourceUrl || "https://www.linkedin.com/jobs",
            questionAnswers: application.questionAnswers,
            coverLetter: application.coverLetter,
            resumeName: application.resumeTitle
        });

        return res.json({
            success: true,
            submissionMethod: "guided",
            message: "Guided application ready. Complete the final step on the employer portal and confirm.",
            data: {
                application,
                guidedPackage
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/auto-apply/:id/confirm-guided
 * Candidate confirms they completed submission on external platform
 */
async function confirmGuidedSubmission(req, res, next) {
    try {
        const { id } = req.params;
        const { confirmationId, notes } = req.body;

        const [application, settings] = await Promise.all([
            Application.findOne({ _id: id, user: req.user._id }),
            getOrCreateSettings(req.user._id)
        ]);

        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found." });
        }

        application.status = "Submitted";
        application.providerConfirmation = {
            confirmationId: confirmationId || `CONF-${Date.now().toString().slice(-6)}`,
            responseMessage: notes || "External submission verified and confirmed by candidate.",
            submittedAt: new Date()
        };
        application.appliedAt = new Date();
        await application.save();

        settings.recordSubmission();
        await settings.save();

        return res.json({
            success: true,
            message: "Guided submission confirmed and recorded in your career tracker.",
            data: application
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/auto-apply/:id/reject
 * Candidate dismisses application from queue
 */
async function rejectApplication(req, res, next) {
    try {
        const { id } = req.params;
        const application = await Application.findOne({ _id: id, user: req.user._id });
        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found." });
        }

        application.status = "Rejected";
        application.notes = req.body.reason || "Dismissed from application queue by candidate.";
        await application.save();

        return res.json({
            success: true,
            message: "Application dismissed from queue.",
            data: application
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/auto-apply/history
 * Lists completed / submitted applications
 */
async function getHistory(req, res, next) {
    try {
        const items = await Application.find({
            user: req.user._id,
            status: { $in: ["Submitted", "Assessment", "Interview", "Offer", "Rejected", "Submission Failed", "Withdrawn"] }
        })
            .populate("job")
            .sort({ updatedAt: -1 })
            .limit(100);

        return res.json({ success: true, count: items.length, data: items });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/auto-apply/settings
 * Retrieves user's automation configuration
 */
async function getSettings(req, res, next) {
    try {
        const settings = await getOrCreateSettings(req.user._id);
        return res.json({ success: true, data: settings });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/v1/auto-apply/settings
 * Updates user's automation configuration
 */
async function updateSettings(req, res, next) {
    try {
        const settings = await getOrCreateSettings(req.user._id);
        const {
            targetRoles,
            preferredLocations,
            remoteOnly,
            minMatchScore,
            preferredCompanies,
            excludedCompanies,
            dailyApplicationTarget,
            isPaused,
            requireApproval,
            defaultResumeId
        } = req.body;

        if (Array.isArray(targetRoles)) settings.targetRoles = targetRoles;
        if (Array.isArray(preferredLocations)) settings.preferredLocations = preferredLocations;
        if (typeof remoteOnly === "boolean") settings.remoteOnly = remoteOnly;
        if (typeof minMatchScore === "number") settings.minMatchScore = Math.max(30, Math.min(100, minMatchScore));
        if (Array.isArray(preferredCompanies)) settings.preferredCompanies = preferredCompanies;
        if (Array.isArray(excludedCompanies)) settings.excludedCompanies = excludedCompanies;
        if (typeof dailyApplicationTarget === "number") {
            settings.dailyApplicationTarget = Math.max(1, Math.min(30, dailyApplicationTarget));
        }
        if (typeof isPaused === "boolean") settings.isPaused = isPaused;
        if (typeof requireApproval === "boolean") settings.requireApproval = requireApproval;
        if (defaultResumeId !== undefined) settings.defaultResumeId = defaultResumeId;

        await settings.save();

        return res.json({
            success: true,
            message: "Automation settings updated successfully.",
            data: settings
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getOverview,
    getMatchingJobs,
    getQueue,
    prepareApplication,
    approveApplication,
    updateApplicationAnswers,
    submitApplication,
    confirmGuidedSubmission,
    rejectApplication,
    getHistory,
    getSettings,
    updateSettings
};
