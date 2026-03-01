const Job = require("../models/Job");
const FitAnalysis = require("../models/FitAnalysis");
const {
    calculateFitScore,
    extractKeywords,
    generateRoadmap,
    suggestResumeImprovements,
    roleSkillMap,
    resolveRoleProfile
} = require("../utils/aiEngine");

exports.analyzeFit = async (req, res, next) => {
    try {
        const { jobId, skills = [], resumeText = "", experienceYears = 0 } = req.body;

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        const resumeKeywords = extractKeywords(resumeText);
        const mergedSkills = Array.from(new Set([...skills, ...resumeKeywords]));

        const fit = calculateFitScore(job.skills, mergedSkills);
        const experienceBoost = Math.min(10, Number(experienceYears) * 1.5);
        const finalScore = Math.min(100, fit.matchPercentage + Math.round(experienceBoost));

        const suggestions = [...fit.suggestions];
        if (finalScore < 60) {
            suggestions.push("Prioritize one project aligned to the top 3 missing skills before applying.");
        }

        await FitAnalysis.create({
            user: req.user._id,
            role: job.role,
            fitScore: finalScore,
            strongSkills: fit.strongSkills,
            missingSkills: fit.missingSkills,
            suggestions
        });

        res.json({
            job: {
                id: job._id,
                title: job.title,
                company: job.company,
                role: job.role
            },
            matchPercentage: finalScore,
            strongSkills: fit.strongSkills,
            missingSkills: fit.missingSkills,
            suggestions
        });
    } catch (error) {
        next(error);
    }
};

exports.analyzeRoleFit = async (req, res, next) => {
    try {
        const { role = "", skills = [], resumeText = "", experienceYears = 0 } = req.body;

        if (!role.trim()) {
            return res.status(400).json({ error: "role is required" });
        }

        const { resolvedRole, confidence } = resolveRoleProfile(role);
        const profile = roleSkillMap[resolvedRole] || roleSkillMap["Backend Developer"];
        const requiredSkills = [...profile.beginner, ...profile.intermediate, ...profile.advanced];

        const resumeKeywords = extractKeywords(resumeText);
        const mergedSkills = Array.from(new Set([...skills, ...resumeKeywords]));

        const fit = calculateFitScore(requiredSkills, mergedSkills);
        const experienceBoost = Math.min(10, Number(experienceYears) * 1.5);
        const finalScore = Math.min(100, fit.matchPercentage + Math.round(experienceBoost));

        const suggestions = [...fit.suggestions];
        if (finalScore < 60) {
            suggestions.push("Prioritize one role-specific project for your top 3 missing skills.");
        }
        if (confidence < 1) {
            suggestions.push(`Role interpreted as ${resolvedRole}. Refine role title for tighter analysis.`);
        }

        await FitAnalysis.create({
            user: req.user._id,
            role: resolvedRole,
            fitScore: finalScore,
            strongSkills: fit.strongSkills,
            missingSkills: fit.missingSkills,
            suggestions
        });

        res.json({
            targetRole: role,
            resolvedRole,
            roleMatchConfidence: confidence,
            requiredSkills,
            matchPercentage: finalScore,
            strongSkills: fit.strongSkills,
            missingSkills: fit.missingSkills,
            suggestions
        });
    } catch (error) {
        next(error);
    }
};

exports.createRoadmap = async (req, res, next) => {
    try {
        const { role, hoursPerDay, months } = req.body;

        if (!role || !hoursPerDay || !months) {
            return res.status(400).json({ error: "role, hoursPerDay and months are required" });
        }

        const roadmap = generateRoadmap(role, Number(hoursPerDay), Number(months));
        res.json(roadmap);
    } catch (error) {
        next(error);
    }
};

exports.optimizeResume = async (req, res, next) => {
    try {
        const { resumeText, role } = req.body;

        if (!resumeText || !role) {
            return res.status(400).json({ error: "resumeText and role are required" });
        }

        const output = suggestResumeImprovements(resumeText, role);
        res.json(output);
    } catch (error) {
        next(error);
    }
};

exports.interviewGuidance = async (req, res, next) => {
    try {
        const { role, focusSkills = [] } = req.body;

        const guidance = {
            role,
            technical: focusSkills.slice(0, 5).map(skill => `Prepare one deep-dive answer on ${skill}`),
            behavioral: [
                "Use STAR format for leadership and conflict stories.",
                "Quantify outcomes when discussing project impact.",
                "Prepare one failure story with concrete learning."
            ],
            mockPlan: [
                "Day 1: System/architecture round rehearsal",
                "Day 2: Coding + debugging drills",
                "Day 3: Behavioral mock and resume walkthrough"
            ]
        };

        res.json(guidance);
    } catch (error) {
        next(error);
    }
};
