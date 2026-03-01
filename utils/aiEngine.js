const roleSkillMap = {
    "Data Scientist": {
        beginner: ["python", "sql", "statistics"],
        intermediate: ["ml", "feature_engineering", "data_visualization"],
        advanced: ["model_deployment", "deep_learning", "mlops"]
    },
    "Backend Developer": {
        beginner: ["node", "express", "database"],
        intermediate: ["system_design", "docker", "testing"],
        advanced: ["kubernetes", "microservices", "observability"]
    },
    "Frontend Developer": {
        beginner: ["html", "css", "javascript"],
        intermediate: ["react", "typescript", "state_management"],
        advanced: ["performance", "accessibility", "frontend_architecture"]
    },
    "DevOps Engineer": {
        beginner: ["linux", "networking", "ci_cd"],
        intermediate: ["aws", "terraform", "docker"],
        advanced: ["kubernetes", "observability", "security_hardening"]
    },
    "AI/ML Engineer": {
        beginner: ["python", "linear_algebra", "statistics"],
        intermediate: ["pytorch", "nlp", "computer_vision"],
        advanced: ["model_serving", "distributed_training", "llm_ops"]
    }
};

const roleAliases = {
    "ml engineer": "AI/ML Engineer",
    "machine learning engineer": "AI/ML Engineer",
    "ai engineer": "AI/ML Engineer",
    "aiml engineer": "AI/ML Engineer",
    "data science": "Data Scientist",
    "data scientist": "Data Scientist",
    "backend engineer": "Backend Developer",
    "backend developer": "Backend Developer",
    "frontend engineer": "Frontend Developer",
    "frontend developer": "Frontend Developer",
    "front end developer": "Frontend Developer",
    "devops": "DevOps Engineer",
    "devops engineer": "DevOps Engineer"
};

const stopWords = new Set([
    "and", "or", "the", "a", "an", "for", "to", "of", "in", "on", "with", "from", "is", "are", "be", "as", "by"
]);

function normalizeSkill(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
}

function normalizeRole(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ");
}

function resolveRoleProfile(roleInput) {
    const normalizedInput = normalizeRole(roleInput);
    if (!normalizedInput) {
        return {
            resolvedRole: "Backend Developer",
            confidence: 0
        };
    }

    if (roleAliases[normalizedInput]) {
        return {
            resolvedRole: roleAliases[normalizedInput],
            confidence: 1
        };
    }

    const roleNames = Object.keys(roleSkillMap);
    const normalizedRoleEntries = roleNames.map(role => ({
        role,
        normalized: normalizeRole(role)
    }));

    const exact = normalizedRoleEntries.find(entry => entry.normalized === normalizedInput);
    if (exact) {
        return {
            resolvedRole: exact.role,
            confidence: 1
        };
    }

    const partial = normalizedRoleEntries.find(entry =>
        entry.normalized.includes(normalizedInput) || normalizedInput.includes(entry.normalized)
    );

    if (partial) {
        return {
            resolvedRole: partial.role,
            confidence: 0.8
        };
    }

    return {
        resolvedRole: "Backend Developer",
        confidence: 0.5
    };
}

function extractKeywords(jobDescription) {
    const words = String(jobDescription || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .filter(word => word.length > 2)
        .filter(word => !stopWords.has(word));

    const frequency = new Map();
    words.forEach(word => {
        frequency.set(word, (frequency.get(word) || 0) + 1);
    });

    return Array.from(frequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word]) => word);
}

function calculateFitScore(requiredSkills, userSkills) {
    const required = Array.isArray(requiredSkills)
        ? requiredSkills.map(normalizeSkill).filter(Boolean)
        : [];

    const user = new Set(
        (Array.isArray(userSkills) ? userSkills : [])
            .map(normalizeSkill)
            .filter(Boolean)
    );

    const strongSkills = required.filter(skill => user.has(skill));
    const missingSkills = required.filter(skill => !user.has(skill));

    const score = required.length === 0 ? 0 : (strongSkills.length / required.length) * 100;

    const suggestions = missingSkills.slice(0, 5).map(
        skill => `Add ${skill.replace(/_/g, " ")} with a project and measurable outcomes`
    );

    return {
        matchPercentage: Math.round(score),
        strongSkills,
        missingSkills,
        suggestions
    };
}

function generateRoadmap(role, hoursPerDay, months) {
    const { resolvedRole, confidence } = resolveRoleProfile(role);
    const profile = roleSkillMap[resolvedRole] || roleSkillMap["Backend Developer"];

    const totalWeeks = Math.max(1, Math.round((months || 1) * 4));
    const totalHours = Math.max(10, Math.round((hoursPerDay || 1) * 30 * (months || 1)));

    const resourceBank = {
        Beginner: ["Official docs + notes (3h)", "One guided tutorial (4h)", "Flashcards for terminology (1h)"],
        Intermediate: ["Build one feature in a side project (6h)", "Write tests/benchmarks (2h)", "Share a recap post (1h)"],
        Advanced: ["Design doc or ADR (3h)", "Deploy/scale scenario (6h)", "Post-mortem or optimization log (2h)"]
    };

    const levels = [
        { name: "Foundation", skills: profile.beginner, level: "Beginner", weight: 1, milestone: "Ship one fundamentals mini-project" },
        { name: "Growth", skills: profile.intermediate, level: "Intermediate", weight: 1.3, milestone: "Launch a feature end-to-end" },
        { name: "Mastery", skills: profile.advanced, level: "Advanced", weight: 1.6, milestone: "Harden & scale with metrics" }
    ];

    const totalWeight = levels.reduce((sum, group) => sum + group.skills.length * group.weight, 0) || 1;

    let weekCursor = 1;
    const timeline = [];
    const phases = [];
    const weeklyPlan = [];

    levels.forEach(group => {
        const groupWeight = (group.skills.length * group.weight) / totalWeight;
        const groupWeeks = Math.max(1, Math.round(groupWeight * totalWeeks));
        const groupHours = Math.max(6, Math.round(groupWeight * totalHours));
        const startWeek = weekCursor;
        const endWeek = Math.min(totalWeeks, startWeek + groupWeeks - 1);
        weekCursor = endWeek + 1;

        const hoursPerSkill = group.skills.length
            ? Math.max(3, Math.round(groupHours / group.skills.length))
            : 0;

        group.skills.forEach(skill => {
            timeline.push({
                skill,
                level: group.level,
                allocatedHours: hoursPerSkill,
                startWeek,
                endWeek,
                milestone: group.milestone,
                resources: resourceBank[group.level]
            });
        });

        phases.push({
            name: group.name,
            durationWeeks: endWeek - startWeek + 1,
            focus: `${group.level} depth on ${group.skills.slice(0, 3).join(", ")}${group.skills.length > 3 ? "..." : ""}`,
            milestone: group.milestone,
            skills: group.skills
        });
    });

    // Build a week-by-week plan using timeline ordering
    for (let week = 1; week <= totalWeeks; week += 1) {
        const active = timeline.find(item => week >= item.startWeek && week <= item.endWeek) || timeline[0];
        if (!active) break;
        weeklyPlan.push({
            week,
            focus: `${active.level}: ${active.skill.replace(/_/g, " ")}`,
            hours: Math.max(6, Math.round(totalHours / totalWeeks)),
            deliverable: active.milestone
        });
    }

    const recommendations = [
        "Block calendar time for deep work; aim for 2-3 sessions/week.",
        "Publish a short write-up each phase to attract referrals and feedback.",
        "Pair each advanced skill with a measurable metric (latency, accuracy, cost)."
    ];

    return {
        role,
        resolvedRole,
        roleMatchConfidence: confidence,
        hoursPerDay,
        months,
        totalHours,
        totalWeeks,
        phases,
        timeline,
        weeklyPlan,
        recommendations
    };
}

function suggestResumeImprovements(resumeText, role) {
    const text = String(resumeText || "").toLowerCase();
    const selected = roleSkillMap[role] || roleSkillMap["Backend Developer"];
    const roleKeywords = [...selected.beginner, ...selected.intermediate, ...selected.advanced];

    const missingKeywords = roleKeywords.filter(keyword => !text.includes(keyword.replace(/_/g, " ")));

    const bulletSuggestions = [
        "Start bullets with action verbs and quantify impact (e.g., reduced API latency by 35%).",
        "Include one achievement bullet per project with metric + business outcome.",
        "Align section order to ATS: Summary, Skills, Experience, Projects, Education."
    ];

    const atsChecklist = {
        hasContactSection: /email|phone|linkedin/.test(text),
        hasProjectsSection: /project/.test(text),
        hasImpactMetrics: /\d+%|\d+\s*(ms|sec|hours|users|requests)/.test(text)
    };

    return {
        role,
        missingKeywords,
        bulletSuggestions,
        atsChecklist
    };
}

module.exports = {
    calculateFitScore,
    extractKeywords,
    generateRoadmap,
    suggestResumeImprovements,
    roleSkillMap,
    resolveRoleProfile
};
