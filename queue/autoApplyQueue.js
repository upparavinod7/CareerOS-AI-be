/**
 * CareerOS Auto Apply Execution Engine
 * High-reliability BullMQ / Redis pipeline with resilient in-memory fallback.
 * Workflow:
 * JOB_DISCOVERED -> JOB_VALIDATED -> JOB_MATCHED -> APPLICATION_PREPARED -> READY_TO_SUBMIT -> SUBMITTING -> SUBMITTED
 * Exception states: FAILED, REQUIRES_MANUAL_ACTION, AWAITING_USER_REVIEW, DUPLICATE, EXPIRED.
 */

const { Queue, Worker } = require("bullmq");
const {
  getRedisClient,
  isRedisConnected,
  getQueueMode,
} = require("../config/redis");
const Job = require("../models/Job");
const User = require("../models/User");
const Application = require("../models/Application");
const AutoApplySettings = require("../models/AutoApplySettings");
const { prepareApplicationPackage } = require("../utils/applicationPreparer");
const { getProvider } = require("../applicationProviders");
const { syncPublicJobs } = require("../utils/jobFeedService");
const { evaluateJobFit } = require("../utils/aiEngine");

// Target roles specified in Phase 6 requirements
const TARGET_ROLES = [
  "AI Engineer",
  "Generative AI Engineer",
  "AI Agent Developer",
  "Machine Learning Engineer",
  "LLM Engineer",
  "AI Automation Engineer",
  "Full Stack Developer",
];

class ResilientQueueWrapper {
  constructor(queueName, processor) {
    this.name = queueName;
    this.processor = processor;
    this.inMemoryJobs = [];
    this.bullQueue = null;
    this.bullWorker = null;

    const redis = getRedisClient();
    if (redis && isRedisConnected()) {
      try {
        this.bullQueue = new Queue(queueName, { connection: redis });
        this.bullWorker = new Worker(
          queueName,
          async (job) => {
            return await this.processor(job.data);
          },
          { connection: redis, concurrency: 3 },
        );
        console.log(`[Queue] Initialized BullMQ queue: ${queueName}`);
      } catch (err) {
        console.warn(
          `[Queue] BullMQ init failed for ${queueName}, using in-memory:`,
          err.message,
        );
      }
    }
  }

  async add(name, data, opts = {}) {
    if (this.bullQueue && isRedisConnected()) {
      return await this.bullQueue.add(name, data, opts);
    }

    // Resilient in-memory execution fallback
    const memoryJob = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name,
      data,
      timestamp: new Date(),
    };
    this.inMemoryJobs.push(memoryJob);

    // Execute immediately in microtask to prevent blocking
    setImmediate(async () => {
      try {
        await this.processor(data);
      } catch (err) {
        console.error(
          `[Queue] Memory job ${memoryJob.id} failed:`,
          err.message,
        );
      }
    });

    return memoryJob;
  }

  async getWaitingCount() {
    if (this.bullQueue && isRedisConnected()) {
      return await this.bullQueue.getWaitingCount();
    }
    return this.inMemoryJobs.length;
  }
}

// -------------------------------------------------------------
// PROCESSORS
// -------------------------------------------------------------

/**
 * 1. Discovery Processor
 * Discovers live jobs matching target roles and remote criteria, verifies deduplication.
 */
async function processDiscoveryJob(data) {
  const { userId } = data;
  const [user, settings] = await Promise.all([
    User.findById(userId),
    AutoApplySettings.findOne({ user: userId }),
  ]);

  if (!user || !settings || settings.isPaused) return { status: "skipped" };

  // Trigger sync if pool has fewer than 10 jobs
  const currentCount = await Job.countDocuments();
  if (currentCount < 10) {
    await syncPublicJobs().catch(() => {});
  }

  // Existing applications for duplicate prevention
  const existingApps = await Application.find({ user: userId }).select(
    "job status",
  );
  const existingJobSet = new Set(
    existingApps.map((a) => String(a.job)).filter(Boolean),
  );

  const activeRoles =
    settings.targetRoles && settings.targetRoles.length > 0
      ? settings.targetRoles
      : TARGET_ROLES;

  // Search query
  const roleRegex = activeRoles
    .map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const query = {
    $or: [
      { title: new RegExp(roleRegex, "i") },
      { role: new RegExp(roleRegex, "i") },
    ],
  };

  if (settings.remoteOnly) {
    query.workType = "Remote";
  }

  const availableJobs = await Job.find(query).limit(50).lean();
  let discoveredCount = 0;
  let duplicateCount = 0;

  for (const job of availableJobs) {
    if (existingJobSet.has(String(job._id))) {
      duplicateCount++;
      continue;
    }

    const fit = evaluateJobFit(user, job);
    if (fit.score >= (settings.minMatchScore || 60)) {
      discoveredCount++;
      // Enqueue into Preparation Queue
      await preparationQueue.add("prepare_application", {
        userId,
        jobId: job._id,
        fitScore: fit.score,
      });
    }
  }

  return {
    status: "discovery_completed",
    discoveredCount,
    duplicateCount,
  };
}

/**
 * 2. Preparation Processor
 * Generates ATS-friendly resume PDF via Python FastAPI service, cover letter, and screening answers.
 */
async function processPreparationJob(data) {
  const { userId, jobId, fitScore } = data;
  const [user, job, settings] = await Promise.all([
    User.findById(userId),
    Job.findById(jobId),
    AutoApplySettings.findOne({ user: userId }),
  ]);

  if (!user || !job || !settings) return { status: "aborted" };

  // Duplicate check guardrail
  const existing = await Application.findOne({ user: userId, job: jobId });
  if (existing) {
    return { status: "duplicate", applicationId: existing._id };
  }

  // Prepare package (calls Python FastAPI service for PDF compilation)
  const prep = await prepareApplicationPackage(user, job);
  const provider = getProvider(job.source || job.sourceUrl || job.title);
  const capabilities = provider.getCapabilities();

  // Determine initial status based on approval requirements & provider capability
  let pipelineStage = "APPLICATION_PREPARED";
  let status = "Awaiting Approval";

  if (settings.requireApproval) {
    pipelineStage = "AWAITING_USER_REVIEW";
    status = "Awaiting Approval";
  } else {
    if (
      capabilities.applicationSubmission &&
      capabilities.submissionMethod === "direct"
    ) {
      pipelineStage = "READY_TO_SUBMIT";
      status = "Ready to Submit";
    } else {
      pipelineStage = "REQUIRES_MANUAL_ACTION";
      status = "Ready to Submit"; // Guided flow ready
    }
  }

  const application = new Application({
    user: userId,
    job: job._id,
    company: job.company,
    jobTitle: job.title,
    location: job.location,
    salary: job.salary
      ? `${job.salary.min || ""} - ${job.salary.max || ""}`
      : "",
    jobUrl: job.sourceUrl || "",
    status: status,
    pipelineStage: pipelineStage,
    platform: provider.name,
    submissionMethod: capabilities.submissionMethod,
    resumeVersionId: prep.selectedResume.resumeId,
    resumeTitle: prep.selectedResume.title,
    resumeSnapshot: prep.selectedResume.snapshot,
    generatedPdfBase64: prep.generatedPdfBase64 || "",
    coverLetter: prep.coverLetter,
    questionAnswers: prep.questionAnswers,
    matchScore: fitScore || prep.matchScore,
    matchingSkills: prep.matchingSkills,
    missingSkills: prep.missingSkills,
    eligibilityConcerns: prep.eligibilityConcerns,
    approvalRecord: {
      approved: !settings.requireApproval,
      approvedAt: !settings.requireApproval ? new Date() : null,
      notes: !settings.requireApproval
        ? "Auto-approved by automation settings."
        : "",
    },
  });

  await application.save();

  // If auto-schedule enabled and ready to submit direct, forward to submission queue
  if (!settings.requireApproval && capabilities.submissionMethod === "direct") {
    await submissionQueue.add("submit_application", {
      userId,
      applicationId: application._id,
    });
  }

  return {
    status: "prepared",
    applicationId: application._id,
    pipelineStage,
    submissionMethod: capabilities.submissionMethod,
  };
}

/**
 * 3. Submission Processor
 * Submits application directly via authorized API or establishes guided application package.
 */
async function processSubmissionJob(data) {
  const { userId, applicationId } = data;
  const [application, user, settings] = await Promise.all([
    Application.findOne({ _id: applicationId, user: userId }).populate("job"),
    User.findById(userId),
    AutoApplySettings.findOne({ user: userId }),
  ]);

  if (!application || !user || !settings) return { status: "not_found" };

  if (!settings.canSubmitToday()) {
    application.status = "Awaiting Approval";
    application.pipelineStage = "AWAITING_USER_REVIEW";
    application.failureReason = `Daily target of ${settings.dailyApplicationTarget} reached. Queued for tomorrow.`;
    await application.save();
    return { status: "daily_limit_reached" };
  }

  const provider = getProvider(application.platform || application.jobUrl);
  const capabilities = provider.getCapabilities();

  // Direct Submission (Greenhouse, Lever where authorized)
  if (
    capabilities.applicationSubmission &&
    capabilities.submissionMethod === "direct"
  ) {
    application.pipelineStage = "SUBMITTING";
    await application.save();

    try {
      const submitResult = await provider.submitDirect({
        candidateName: user.name,
        candidateEmail: user.email,
        candidatePhone: user.phone,
        resumeSnapshot: application.resumeSnapshot,
        generatedPdfBase64: application.generatedPdfBase64,
        coverLetter: application.coverLetter,
        questionAnswers: application.questionAnswers,
        jobUrl: application.jobUrl || application.job?.sourceUrl || "",
        jobId: application.job?._id || application.jobTitle,
      });

      application.pipelineStage = "SUBMITTED";
      application.status = "Submitted";
      application.providerConfirmation = {
        confirmationId: submitResult.confirmationId,
        responseMessage: "Direct submission accepted by platform API.",
        submittedAt: new Date(),
      };
      application.submissionEvidence = {
        confirmationId: submitResult.confirmationId,
        rawResponse: submitResult.responsePayload || {},
        timestamp: new Date(),
        verified: true,
      };
      application.appliedAt = new Date();
      await application.save();

      settings.recordSubmission();
      await settings.save();

      return {
        status: "submitted",
        applicationId: application._id,
        confirmationId: submitResult.confirmationId,
      };
    } catch (err) {
      application.pipelineStage = "FAILED";
      application.status = "Submission Failed";
      application.failureReason = err.message;
      application.lastRetryAt = new Date();
      await application.save();

      return {
        status: "failed",
        applicationId: application._id,
        error: err.message,
      };
    }
  }

  // Guided Submission (LinkedIn, Indeed, Wellfound, Internshala, Career Portals)
  application.pipelineStage = "REQUIRES_MANUAL_ACTION";
  application.status = "Ready to Submit";
  await application.save();

  return {
    status: "guided_ready",
    applicationId: application._id,
    submissionMethod: "guided",
  };
}

// -------------------------------------------------------------
// INSTANTIATE QUEUES
// -------------------------------------------------------------

const discoveryQueue = new ResilientQueueWrapper(
  "discoveryQueue",
  processDiscoveryJob,
);
const preparationQueue = new ResilientQueueWrapper(
  "preparationQueue",
  processPreparationJob,
);
const submissionQueue = new ResilientQueueWrapper(
  "submissionQueue",
  processSubmissionJob,
);

module.exports = {
  discoveryQueue,
  preparationQueue,
  submissionQueue,
  processDiscoveryJob,
  processPreparationJob,
  processSubmissionJob,
  TARGET_ROLES,
};
