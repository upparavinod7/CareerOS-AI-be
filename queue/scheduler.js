/**
 * Auto Apply Scheduler Engine
 * Manages daily scheduled discovery & execution at 09:00 IST (03:30 UTC).
 * Orchestrates multi-queue pipeline with daily application cap enforcement.
 */

const User = require("../models/User");
const AutoApplySettings = require("../models/AutoApplySettings");
const Application = require("../models/Application");
const Job = require("../models/Job");
const { discoveryQueue, preparationQueue, submissionQueue, TARGET_ROLES } = require("./autoApplyQueue");
const { getQueueMode, isRedisConnected } = require("../config/redis");

let schedulerTimer = null;

/**
 * Initializes daily 09:00 IST scheduler loop
 */
function initScheduler() {
    if (schedulerTimer) return;

    // Check every 60 seconds if it is 09:00 IST (03:30 UTC)
    schedulerTimer = setInterval(async () => {
        try {
            const now = new Date();
            const utcHours = now.getUTCHours();
            const utcMinutes = now.getUTCMinutes();

            // 03:30 UTC = 09:00 IST
            if (utcHours === 3 && utcMinutes === 30) {
                console.log("[Scheduler] 09:00 IST reached. Triggering automated application discovery...");
                await runDailyScheduleForAllUsers();
            }
        } catch (err) {
            console.error("[Scheduler] Error in schedule tick:", err.message);
        }
    }, 60000);

    if (schedulerTimer && typeof schedulerTimer.unref === "function") {
        schedulerTimer.unref();
    }

    console.log("[Scheduler] Auto Apply 09:00 IST scheduler registered.");
}

function stopScheduler() {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
    }
}

/**
 * Runs the daily pipeline for all active users
 */
async function runDailyScheduleForAllUsers() {
    const activeSettings = await AutoApplySettings.find({
        isPaused: false,
        autoScheduleEnabled: true
    });

    for (const setting of activeSettings) {
        if (setting.canSubmitToday()) {
            await discoveryQueue.add("scheduled_discovery", { userId: setting.user });
        }
    }
}

/**
 * Trigger immediate run for a specific user
 */
async function triggerUserPipeline(userId) {
    const settings = await AutoApplySettings.findOne({ user: userId });
    if (!settings || settings.isPaused) {
        throw new Error("Automation settings are paused or not configured.");
    }

    const job = await discoveryQueue.add("manual_trigger_discovery", { userId });
    return {
        jobId: job.id,
        status: "queued",
        targetRoles: settings.targetRoles || TARGET_ROLES,
        dailyTarget: settings.dailyApplicationTarget,
        queueMode: getQueueMode()
    };
}

/**
 * Returns comprehensive real-time execution metrics
 */
async function getExecutionMetrics(userId) {
    const settings = await AutoApplySettings.findOne({ user: userId }) || {
        dailyApplicationTarget: 20,
        dailySubmittedCount: 0,
        isPaused: false
    };

    const apps = await Application.find({ user: userId }).lean();

    const metrics = {
        totalDiscovered: await Job.countDocuments(),
        eligibleJobs: 0,
        applicationsPrepared: 0,
        applicationsSubmitted: 0,
        requiresManualAction: 0,
        failedApplications: 0,
        duplicatesPrevented: 0,
        platformBreakdown: {},
        recentFailures: [],
        submissionEvidences: [],
        dailyProgress: {
            submittedToday: settings.dailySubmittedCount,
            dailyTarget: settings.dailyApplicationTarget,
            canSubmitMore: settings.dailySubmittedCount < settings.dailyApplicationTarget,
            isPaused: settings.isPaused,
            scheduledTime: "09:00 IST"
        },
        queueMode: getQueueMode()
    };

    apps.forEach((a) => {
        const plat = a.platform || "Generic";
        if (!metrics.platformBreakdown[plat]) {
            metrics.platformBreakdown[plat] = { total: 0, submitted: 0, guided: 0, failed: 0 };
        }
        metrics.platformBreakdown[plat].total++;

        if (a.pipelineStage === "APPLICATION_PREPARED" || a.status === "Preparing" || a.status === "Awaiting Approval") {
            metrics.applicationsPrepared++;
        }
        if (a.pipelineStage === "SUBMITTED" || a.status === "Submitted") {
            metrics.applicationsSubmitted++;
            metrics.platformBreakdown[plat].submitted++;
            if (a.submissionEvidence && a.submissionEvidence.confirmationId) {
                metrics.submissionEvidences.push({
                    applicationId: a._id,
                    company: a.company,
                    jobTitle: a.jobTitle,
                    platform: a.platform,
                    confirmationId: a.submissionEvidence.confirmationId,
                    timestamp: a.submissionEvidence.timestamp || a.appliedAt
                });
            }
        }
        if (a.pipelineStage === "REQUIRES_MANUAL_ACTION" || a.submissionMethod === "guided") {
            metrics.requiresManualAction++;
            metrics.platformBreakdown[plat].guided++;
        }
        if (a.pipelineStage === "FAILED" || a.status === "Submission Failed") {
            metrics.failedApplications++;
            metrics.platformBreakdown[plat].failed++;
            metrics.recentFailures.push({
                applicationId: a._id,
                company: a.company,
                jobTitle: a.jobTitle,
                platform: a.platform,
                reason: a.failureReason || a.notes || "Submission rejected by platform."
            });
        }
        if (a.pipelineStage === "DUPLICATE") {
            metrics.duplicatesPrevented++;
        }
    });

    metrics.eligibleJobs = metrics.applicationsPrepared + metrics.applicationsSubmitted + metrics.requiresManualAction;

    return metrics;
}

module.exports = {
    initScheduler,
    stopScheduler,
    runDailyScheduleForAllUsers,
    triggerUserPipeline,
    getExecutionMetrics
};
