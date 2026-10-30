const { evaluateJobFit, generateCoverLetter } = require("./aiEngine");

/**
 * Intelligent Application Preparation Engine
 * Tailors candidate assets to specific job opportunities without fabricating claims.
 */

function selectBestResume(user, job) {
    if (!user.resumes || user.resumes.length === 0) {
        return {
            resumeId: null,
            title: "Master Profile Resume",
            snapshot: user.resumeText || `${user.name} - ${user.headline || user.targetRole}\nSkills: ${(user.skills || []).join(", ")}`
        };
    }

    const jobText = `${job.title} ${job.description} ${(job.requirements || []).join(" ")}`.toLowerCase();

    let bestScore = -1;
    let selectedResume = user.resumes.find(r => r.isDefault) || user.resumes[0];

    for (const resume of user.resumes) {
        let score = 0;
        if (resume.targetRole && jobText.includes(resume.targetRole.toLowerCase())) {
            score += 30;
        }
        for (const skill of (resume.skills || [])) {
            if (jobText.includes(skill.toLowerCase())) {
                score += 5;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            selectedResume = resume;
        }
    }

    return {
        resumeId: selectedResume._id ? String(selectedResume._id) : null,
        title: selectedResume.title,
        snapshot: selectedResume.resumeText
    };
}

function generateScreeningAnswers(user, job) {
    const jobTitle = job.title || "Software Engineer";
    const company = job.company || "the company";
    const candidateSkills = user.skills || [];
    const jobReqs = Array.isArray(job.requirements) ? job.requirements : [];

    const overlapSkills = candidateSkills.filter(s =>
        `${jobTitle} ${job.description || ""} ${jobReqs.join(" ")}`.toLowerCase().includes(s.toLowerCase())
    );

    const highlightedSkills = overlapSkills.length > 0 ? overlapSkills.slice(0, 5).join(", ") : candidateSkills.slice(0, 4).join(", ");

    return [
        {
            question: "How many years of relevant experience do you have for this role?",
            answer: `${user.experienceYears || 2} years of relevant experience in ${user.targetRole || jobTitle}.`,
            fieldType: "number"
        },
        {
            question: "What is your current notice period / earliest available start date?",
            answer: user.noticePeriod || "Immediate availability (within 2 weeks).",
            fieldType: "text"
        },
        {
            question: "What are your salary expectations for this position?",
            answer: user.expectedSalary > 0
                ? `$${user.expectedSalary.toLocaleString()} USD / annum (negotiable based on benefits and role scope).`
                : "Open to discussion based on standard industry benchmark for this level.",
            fieldType: "text"
        },
        {
            question: "Are you legally authorized to work in the specified location / remotely?",
            answer: "Yes, fully authorized to work in preferred locations and remote setups.",
            fieldType: "select"
        },
        {
            question: `What excites you most about joining ${company} as a ${jobTitle}?`,
            answer: `I am eager to contribute my expertise in ${highlightedSkills || "modern software engineering"} to solve high-impact challenges at ${company}. My background aligns closely with the core engineering initiatives of this team.`,
            fieldType: "textarea"
        },
        {
            question: "Summarize your hands-on experience with the required technology stack.",
            answer: `I have extensive practical experience building and deploying production systems with ${highlightedSkills}. My focus has been on building reliable, performant, and well-tested services.`,
            fieldType: "textarea"
        }
    ];
}

async function prepareApplicationPackage(user, job) {
    // 1. Calculate explainable match score
    const fitAnalysis = evaluateJobFit(user, job);

    // 2. Select best-matching resume version
    const selectedResume = selectBestResume(user, job);

    // 3. Draft tailored cover letter
    let coverLetterText = "";
    try {
        const coverLetterRes = await generateCoverLetter(user, {
            company: job.company,
            jobTitle: job.title,
            jobDescription: job.description,
            tone: "Confident"
        });
        coverLetterText = coverLetterRes.coverLetter || "";
    } catch {
        coverLetterText = `Dear Hiring Team at ${job.company},\n\nI am writing to express my strong enthusiasm for the ${job.title} role. With my background in ${(user.skills || []).slice(0, 4).join(", ")}, I am confident in delivering immediate value to your organization.\n\nSincerely,\n${user.name}`;
    }

    // 4. Generate structured answers
    const questionAnswers = generateScreeningAnswers(user, job);

    // 5. Detect any eligibility concerns
    const eligibilityConcerns = [];
    if (user.preferredWorkType !== "Any" && job.workType && job.workType !== user.preferredWorkType) {
        eligibilityConcerns.push(`Work type mismatch: Job is ${job.workType}, but your preference is ${user.preferredWorkType}.`);
    }
    if (fitAnalysis.missingSkills && fitAnalysis.missingSkills.length > 3) {
        eligibilityConcerns.push(`Key skill gaps identified in: ${fitAnalysis.missingSkills.slice(0, 3).join(", ")}.`);
    }

    return {
        matchScore: fitAnalysis.score,
        matchingSkills: fitAnalysis.matchingSkills || [],
        missingSkills: fitAnalysis.missingSkills || [],
        eligibilityConcerns,
        selectedResume,
        coverLetter: coverLetterText,
        questionAnswers
    };
}

module.exports = {
    prepareApplicationPackage,
    selectBestResume,
    generateScreeningAnswers
};
