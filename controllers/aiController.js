const Job = require("../models/Job");
const FitAnalysis = require("../models/FitAnalysis");
const Roadmap = require("../models/Roadmap");
const CoverLetter = require("../models/CoverLetter");
const InterviewPrep = require("../models/InterviewPrep");
const User = require("../models/User");
const {
    calculateFitScore,
    extractKeywords,
    predictCareerRoles,
    generateRoadmap,
    suggestResumeImprovements,
    generateCoverLetterDraft,
    generateInterviewGuidance,
    evaluateInterviewAnswer,
    roleSkillMap,
    resolveRoleProfile
} = require("../utils/aiEngine");

// 1. Analyze fit against specific Job ID
exports.analyzeFit = async (req, res, next) => {
    try {
        const { jobId, skills = [], resumeText = "", experienceYears = 0 } = req.body;

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ success: false, error: "Job not found" });
        }

        const resumeKeywords = extractKeywords(resumeText);
        const mergedSkills = Array.from(new Set([...skills, ...resumeKeywords]));

        const fit = calculateFitScore(job.skills, mergedSkills, experienceYears, resumeText);

        const record = await FitAnalysis.create({
            user: req.user._id,
            job: job._id,
            role: job.role || job.title,
            fitScore: fit.matchPercentage,
            strongSkills: fit.strongSkills,
            missingSkills: fit.missingSkills,
            partiallyMatchingSkills: fit.partiallyMatchingSkills,
            suggestions: fit.suggestions,
            categoryScores: fit.categories,
            keywordCoverage: fit.keywordCoverage,
            experienceAlignment: fit.experienceAlignment
        });

        res.json({
            success: true,
            id: record._id,
            job: {
                id: job._id,
                title: job.title,
                company: job.company,
                role: job.role,
                location: job.location
            },
            matchPercentage: fit.matchPercentage,
            strongSkills: fit.strongSkills,
            partiallyMatchingSkills: fit.partiallyMatchingSkills,
            missingSkills: fit.missingSkills,
            keywordCoverage: fit.keywordCoverage,
            experienceAlignment: fit.experienceAlignment,
            suggestions: fit.suggestions,
            categories: fit.categories
        });
    } catch (error) {
        next(error);
    }
};

// 2. Analyze fit against target Role title
exports.analyzeRoleFit = async (req, res, next) => {
    try {
        const { role = "", skills = [], resumeText = "", experienceYears = 0 } = req.body;

        if (!role.trim()) {
            return res.status(400).json({ success: false, error: "Role is required" });
        }

        const { resolvedRole, confidence } = resolveRoleProfile(role);
        const profile = roleSkillMap[resolvedRole] || roleSkillMap["Full Stack Developer"];
        const requiredSkills = [...profile.beginner, ...profile.intermediate, ...profile.advanced];

        const resumeKeywords = extractKeywords(resumeText);
        const mergedSkills = Array.from(new Set([...skills, ...resumeKeywords]));

        const fit = calculateFitScore(requiredSkills, mergedSkills, experienceYears, resumeText);

        const record = await FitAnalysis.create({
            user: req.user._id,
            role: resolvedRole,
            fitScore: fit.matchPercentage,
            strongSkills: fit.strongSkills,
            missingSkills: fit.missingSkills,
            partiallyMatchingSkills: fit.partiallyMatchingSkills,
            suggestions: fit.suggestions,
            categoryScores: fit.categories,
            keywordCoverage: fit.keywordCoverage,
            experienceAlignment: fit.experienceAlignment
        });

        res.json({
            success: true,
            id: record._id,
            targetRole: role,
            resolvedRole,
            roleMatchConfidence: confidence,
            requiredSkills,
            matchPercentage: fit.matchPercentage,
            strongSkills: fit.strongSkills,
            partiallyMatchingSkills: fit.partiallyMatchingSkills,
            missingSkills: fit.missingSkills,
            keywordCoverage: fit.keywordCoverage,
            experienceAlignment: fit.experienceAlignment,
            suggestions: fit.suggestions,
            categories: fit.categories
        });
    } catch (error) {
        next(error);
    }
};

// 3. Get Fit Analysis History
exports.getFitHistory = async (req, res, next) => {
    try {
        const history = await FitAnalysis.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate("job", "title company location");

        res.json({
            success: true,
            history
        });
    } catch (error) {
        next(error);
    }
};

// 4. Career Predictor (Phase 4.5)
exports.predictCareer = async (req, res, next) => {
    try {
        const {
            skills = [],
            experienceYears = 0,
            education = "",
            interests = [],
            targetAreas = []
        } = req.body;

        const result = predictCareerRoles({
            skills,
            experienceYears,
            education,
            interests,
            targetAreas
        });

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
};

// 5. Generate Roadmap (Phase 4.6)
exports.createRoadmap = async (req, res, next) => {
    try {
        const { role, hoursPerDay = 2, months = 3, currentLevel = "Beginner" } = req.body;

        if (!role || !role.trim()) {
            return res.status(400).json({ success: false, error: "Target role is required" });
        }

        const roadmapData = generateRoadmap(role, hoursPerDay, months, currentLevel);

        // Automatically save roadmap for the user so it persists
        const savedRoadmap = await Roadmap.create({
            user: req.user._id,
            ...roadmapData
        });

        res.json({
            success: true,
            message: "Roadmap generated and saved successfully",
            roadmap: savedRoadmap,
            ...savedRoadmap.toObject()
        });
    } catch (error) {
        next(error);
    }
};

// 6. Get Saved Roadmaps
exports.getRoadmaps = async (req, res, next) => {
    try {
        const roadmaps = await Roadmap.find({ user: req.user._id }).sort({ updatedAt: -1 });
        res.json({
            success: true,
            items: roadmaps
        });
    } catch (error) {
        next(error);
    }
};

// 7. Toggle Roadmap Task Completed
exports.toggleRoadmapTask = async (req, res, next) => {
    try {
        const { roadmapId, taskId } = req.params;

        const roadmap = await Roadmap.findOne({ _id: roadmapId, user: req.user._id });
        if (!roadmap) {
            return res.status(404).json({ success: false, error: "Roadmap not found" });
        }

        const task = roadmap.weeklyPlan.id(taskId);
        if (!task) {
            return res.status(404).json({ success: false, error: "Task not found" });
        }

        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date() : null;
        roadmap.updateProgress();
        await roadmap.save();

        res.json({
            success: true,
            message: task.completed ? "Task marked complete" : "Task marked incomplete",
            task,
            progressPercentage: roadmap.progressPercentage
        });
    } catch (error) {
        next(error);
    }
};

// 8. Resume Optimizer & ATS Analyzer (Phase 4.7)
exports.optimizeResume = async (req, res, next) => {
    try {
        const { resumeText, role } = req.body;

        if (!resumeText || !role) {
            return res.status(400).json({ success: false, error: "resumeText and role are required" });
        }

        const output = suggestResumeImprovements(resumeText, role);
        res.json({
            success: true,
            ...output
        });
    } catch (error) {
        next(error);
    }
};

// 9. Interview Guidance (Phase 4.9)
exports.interviewGuidance = async (req, res, next) => {
    try {
        const { role, focusSkills = [], difficulty = "Intermediate" } = req.body;

        if (!role || !role.trim()) {
            return res.status(400).json({ success: false, error: "Role is required" });
        }

        const guidance = generateInterviewGuidance(role, focusSkills, difficulty);
        res.json({
            success: true,
            ...guidance,
            // maintain legacy flat format compatibility:
            technical: guidance.technicalQuestions,
            behavioral: guidance.behavioralQuestions,
            mockPlan: guidance.mockPlan
        });
    } catch (error) {
        next(error);
    }
};

// 10. Chat Mock Interview (Phase 4.9)
exports.chatMockInterview = async (req, res, next) => {
    try {
        const { role, messageHistory = [], currentAnswer = "" } = req.body;

        if (!role || !role.trim()) {
            return res.status(400).json({ success: false, error: "Role is required" });
        }

        if (!messageHistory || messageHistory.length === 0) {
            return res.json({
                success: true,
                reply: `Hello! Welcome to your mock interview for the ${role} position. Let's begin: Could you briefly walk me through your technical background and what makes you interested in this role?`,
                score: null,
                feedback: null
            });
        }

        const lastAiQuestion = messageHistory
            .slice()
            .reverse()
            .find(m => m.role === "ai" || m.role === "assistant")?.content || "";

        const evaluation = evaluateInterviewAnswer(role, currentAnswer, lastAiQuestion);

        res.json({
            success: true,
            reply: evaluation.reply,
            score: evaluation.score,
            feedback: evaluation.feedback
        });
    } catch (error) {
        next(error);
    }
};

// 11. Generate Cover Letter (Phase 4.8)
exports.generateCoverLetter = async (req, res, next) => {
    try {
        const { role, companyName, jobDescription, resumeText, tone = "Professional" } = req.body;

        if (!role || !companyName) {
            return res.status(400).json({ success: false, error: "Role and company name are required" });
        }

        const coverLetter = generateCoverLetterDraft({
            role,
            companyName,
            jobDescription,
            resumeText,
            tone
        });

        // Save cover letter
        await CoverLetter.create({
            user: req.user._id,
            role,
            companyName,
            jobDescription,
            tone,
            content: coverLetter
        });

        res.json({
            success: true,
            coverLetter
        });
    } catch (error) {
        next(error);
    }
};

// 12. Get Saved Cover Letters
exports.getSavedCoverLetters = async (req, res, next) => {
    try {
        const letters = await CoverLetter.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json({
            success: true,
            items: letters
        });
    } catch (error) {
        next(error);
    }
};
