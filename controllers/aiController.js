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
            suggestions,
            categories: [
                { subject: 'Frontend', score: fit.strongSkills.some(s => ['react', 'html', 'css', 'javascript', 'typescript'].includes(s)) ? 90 : 30 },
                { subject: 'Backend', score: fit.strongSkills.some(s => ['node', 'express', 'python', 'database'].includes(s)) ? 85 : 40 },
                { subject: 'DevOps', score: fit.strongSkills.some(s => ['docker', 'aws', 'kubernetes'].includes(s)) ? 75 : 20 },
                { subject: 'Data', score: fit.strongSkills.some(s => ['sql', 'statistics', 'ml', 'python'].includes(s)) ? 80 : 35 },
                { subject: 'System Design', score: fit.strongSkills.some(s => ['system_design', 'microservices'].includes(s)) ? 70 : 45 },
                { subject: 'Testing', score: fit.strongSkills.some(s => ['testing'].includes(s)) ? 85 : 50 }
            ]
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
            suggestions,
            categories: [
                { subject: 'Frontend', score: fit.strongSkills.some(s => ['react', 'html', 'css', 'javascript', 'typescript'].includes(s)) ? 95 : 30 },
                { subject: 'Backend', score: fit.strongSkills.some(s => ['node', 'express', 'python', 'database'].includes(s)) ? 80 : 40 },
                { subject: 'DevOps', score: fit.strongSkills.some(s => ['docker', 'aws', 'kubernetes'].includes(s)) ? 70 : 20 },
                { subject: 'Data', score: fit.strongSkills.some(s => ['sql', 'statistics', 'ml', 'python'].includes(s)) ? 85 : 35 },
                { subject: 'System Design', score: fit.strongSkills.some(s => ['system_design', 'microservices'].includes(s)) ? 75 : 45 },
                { subject: 'Testing', score: fit.strongSkills.some(s => ['testing'].includes(s)) ? 60 : 50 }
            ]
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

exports.generateCoverLetter = async (req, res, next) => {
    try {
        const { role, companyName, jobDescription, resumeText } = req.body;

        if (!role || !companyName) {
             return res.status(400).json({ error: "role and companyName are required" });
        }

        const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        
        let coverLetter = `${date}\n\nHiring Manager\n${companyName}\n\nDear Hiring Manager,\n\nI am writing to express my strong interest in the ${role} position at ${companyName}. `;
        
        if (resumeText.length > 50) {
            coverLetter += `With my background matching the core requirements, I have developed a strong foundation in the skills necessary to succeed in this role. `;
        } else {
             coverLetter += `I am eager to bring my dedication, fast learning capabilities, and passion to your team. `;
        }
        
        if (jobDescription && jobDescription.length > 20) {
            coverLetter += `Your focus on innovation and the specific challenges outlined in the job description align perfectly with my career goals.\n\n`;
        } else {
            coverLetter += `I greatly admire ${companyName}'s work and would be thrilled to contribute to your ongoing success.\n\n`;
        }

        coverLetter += `Throughout my career, I have consistently focused on delivering high-quality results and collaborating effectively with cross-functional teams. I am confident that my technical skills and proactive mindset make me a strong candidate for this position.\n\nI would welcome the opportunity to further discuss how my background, skills, and certifications will be beneficial to ${companyName}. Thank you for your time and consideration.\n\nSincerely,\n\n[Your Name]\n[Your Contact Information]`;

        // Simulate network delay to make the loader visible on the frontend
        await new Promise(r => setTimeout(r, 1500));

        res.json({ coverLetter });
    } catch (error) {
        next(error);
    }
};

exports.chatMockInterview = async (req, res, next) => {
    try {
        const { role, messageHistory, currentAnswer } = req.body;

        if (!role) {
             return res.status(400).json({ error: "role is required" });
        }

        // Simulate network delay to emulate LLM reasoning
        await new Promise(r => setTimeout(r, 1500));

        // If simple greeting or opening
        if (!messageHistory || messageHistory.length === 0) {
             return res.json({
                 reply: `Hello! Let's start your mock interview for the ${role} position. Could you briefly walk me through your background and why you are interested in this role?`,
                 score: null
             });
        }

        // Extremely naive mock grading for the purpose of this demonstration
        const wordCount = (currentAnswer || "").split(/\s+/).length;
        let score = null;
        let reply = "";

        if (wordCount < 10) {
            score = 3;
            reply = "That's a bit brief. In a real interview, you'll want to expand on that significantly. Let's try another question: Can you describe a time you overcame a difficult technical challenge?";
        } else if (wordCount < 40) {
            score = 6;
            reply = "Good start, but you could provide more specific details or use the STAR method to structure your answer. Next question: How do you prioritize tasks when under a tight deadline?";
        } else {
            score = 9;
            reply = "Excellent answer. You provided good detail and structured your response well. Let's move on: Where do you see your career heading in the next 3 to 5 years?";
        }

        res.json({ reply, score });

    } catch (error) {
        next(error);
    }
};
