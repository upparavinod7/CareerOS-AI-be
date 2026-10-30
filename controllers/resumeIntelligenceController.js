/**
 * Resume Intelligence Controller
 * Orchestrates document upload, parsing, ATS scoring, AI optimization, and PDF generation.
 */

const AIServiceClient = require("../services/aiServiceClient");
const ResumeIntelligence = require("../models/ResumeIntelligence");
const Job = require("../models/Job");

/**
 * POST /api/v1/ai/resume/parse
 * Ingests a resume file (base64) or text and produces a StructuredResume
 */
exports.parseResume = async (req, res, next) => {
    try {
        const { fileBase64, filename, mimeType, rawText, title } = req.body;

        let result;
        if (fileBase64) {
            const buffer = Buffer.from(fileBase64, "base64");
            result = await AIServiceClient.parseResumeFile({
                buffer,
                filename: filename || "resume.pdf",
                mimeType: mimeType || "application/pdf"
            });
        } else if (rawText) {
            // Forward raw text as a text file to parser
            const buffer = Buffer.from(rawText, "utf-8");
            result = await AIServiceClient.parseResumeFile({
                buffer,
                filename: "resume.txt",
                mimeType: "text/plain"
            });
        } else {
            return res.status(400).json({
                success: false,
                error: "Either fileBase64 or rawText is required."
            });
        }

        const structuredResume = result.data;
        const textContent = result.raw_text || rawText || "";

        // Run quality check automatically
        let qualityReport = null;
        try {
            qualityReport = await AIServiceClient.qualityCheckResume(structuredResume);
        } catch (e) {
            // Non-fatal
            console.warn("Quality check warning:", e.message);
        }

        // Save record in MongoDB for user
        const record = await ResumeIntelligence.create({
            user: req.user._id,
            title: title || filename || "Parsed Resume",
            filename: filename || "resume.pdf",
            structuredResume,
            rawText: textContent,
            qualityReport
        });

        res.json({
            success: true,
            id: record._id,
            data: structuredResume,
            rawText: textContent,
            qualityReport,
            processingTimeMs: result.processing_time_ms
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/v1/ai/resume/quality-check
 * Evaluates a StructuredResume against 16 ATS quality rules
 */
exports.qualityCheck = async (req, res, next) => {
    try {
        const { resume } = req.body;
        if (!resume) {
            return res.status(400).json({ success: false, error: "resume object is required" });
        }

        const report = await AIServiceClient.qualityCheckResume(resume);
        res.json({
            success: true,
            report
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/v1/ai/resume/ats-score
 * Computes deterministic 6-component ATS compatibility score
 */
exports.scoreATS = async (req, res, next) => {
    try {
        const { resume, jobDescription, jobId, targetRole } = req.body;
        if (!resume) {
            return res.status(400).json({ success: false, error: "resume object is required" });
        }

        let jdText = jobDescription || "";
        let jobTitle = targetRole || "";

        // If jobId provided, fetch job details from database
        if (jobId) {
            const jobDoc = await Job.findById(jobId);
            if (jobDoc) {
                jdText = `${jobDoc.title} at ${jobDoc.company}\n${jobDoc.description}\nRequired skills: ${(jobDoc.skills || []).join(", ")}`;
                jobTitle = jobDoc.title;
            }
        }

        if (!jdText.trim()) {
            return res.status(400).json({
                success: false,
                error: "Target job description or valid jobId is required for ATS scoring."
            });
        }

        // Analyze job first
        const structuredJob = await AIServiceClient.analyzeJob({
            jobDescription: jdText,
            jobTitle: jobTitle
        });

        // Score ATS
        const scoreReport = await AIServiceClient.scoreATS({
            resume,
            job: structuredJob
        });

        res.json({
            success: true,
            report: scoreReport,
            structuredJob
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/v1/ai/resume/optimize
 * Rewrites bullets with Google XYZ formula and zero hallucination guardrail
 */
exports.optimize = async (req, res, next) => {
    try {
        const { resume, targetRole, jobDescription, targetSkills } = req.body;
        if (!resume || !targetRole) {
            return res.status(400).json({
                success: false,
                error: "resume and targetRole are required"
            });
        }

        const optReport = await AIServiceClient.optimizeResume({
            resume,
            targetRole,
            jobDescription: jobDescription || "",
            targetSkills: targetSkills || []
        });

        res.json({
            success: true,
            report: optReport
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/v1/ai/resume/generate-pdf
 * Renders and downloads clean single-column ATS PDF
 */
exports.generatePDF = async (req, res, next) => {
    try {
        const { resume } = req.body;
        if (!resume) {
            return res.status(400).json({ success: false, error: "resume object is required" });
        }

        const pdfBuffer = await AIServiceClient.generatePDF(resume);
        const candidateName = resume.personal_information?.full_name || "Resume";
        const cleanName = candidateName.replace(/[^a-zA-Z0-9]/g, "_");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${cleanName}_CareerOS.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/v1/ai/resume/validate-pdf
 * Runs PyMuPDF round-trip validation on generated PDF
 */
exports.validatePDF = async (req, res, next) => {
    try {
        const { resume } = req.body;
        if (!resume) {
            return res.status(400).json({ success: false, error: "resume object is required" });
        }

        const validation = await AIServiceClient.validatePDF(resume);
        res.json({
            success: true,
            validation
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/ai/resume/saved
 * Retrieves saved resumes and analyses for the current user
 */
exports.getSavedResumes = async (req, res, next) => {
    try {
        const saved = await ResumeIntelligence.find({ user: req.user._id }).sort({ updatedAt: -1 });
        res.json({
            success: true,
            items: saved
        });
    } catch (error) {
        next(error);
    }
};

