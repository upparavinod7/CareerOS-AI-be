// CareerOS AI Engine - Career intelligence, scoring, roadmap, ATS, and interview synthesis

const roleSkillMap = {
    "AI/ML Engineer": {
        beginner: ["python", "statistics", "linear_algebra", "pandas", "numpy", "git"],
        intermediate: ["pytorch", "scikit_learn", "data_visualization", "nlp", "feature_engineering", "model_evaluation"],
        advanced: ["deep_learning", "model_serving", "distributed_training", "llm_ops", "mlops", "docker", "cuda"],
        description: "Designs, trains, and deploys intelligent machine learning systems and deep learning models.",
        categoryWeights: { "AI & ML": 0.45, "Data Processing": 0.25, "Engineering & DevOps": 0.20, "System Architecture": 0.10 }
    },
    "Generative AI / LLM Engineer": {
        beginner: ["python", "prompt_engineering", "langchain", "embeddings", "rest_api"],
        intermediate: ["rag", "vector_databases", "fine_tuning", "huggingface", "llama_index", "openai_api"],
        advanced: ["agentic_workflows", "model_quantization", "llm_evaluation", "guardrails", "vllm", "system_design"],
        description: "Specializes in building LLM applications, RAG pipelines, autonomous agents, and fine-tuning foundation models.",
        categoryWeights: { "GenAI & LLM": 0.50, "Backend & APIs": 0.20, "Vector Search": 0.15, "Evaluation": 0.15 }
    },
    "Data Scientist": {
        beginner: ["python", "sql", "statistics", "probability", "data_cleaning", "excel"],
        intermediate: ["scikit_learn", "exploratory_data_analysis", "hypothesis_testing", "feature_engineering", "tableau"],
        advanced: ["a_b_testing", "predictive_modeling", "big_data", "spark", "business_intelligence", "storytelling"],
        description: "Uncovers strategic business insights, formulates statistical hypotheses, and trains predictive algorithms.",
        categoryWeights: { "Statistics & Math": 0.35, "Data Wrangling": 0.30, "Machine Learning": 0.25, "Communication": 0.10 }
    },
    "Data Analyst": {
        beginner: ["sql", "excel", "data_cleaning", "reporting", "dashboarding"],
        intermediate: ["tableau", "power_bi", "python", "data_visualization", "metrics_analysis"],
        advanced: ["statistical_analysis", "etl_pipelines", "stakeholder_presentation", "data_modeling"],
        description: "Transforms raw structured data into clear reports, dashboards, and actionable business intelligence.",
        categoryWeights: { "SQL & Databases": 0.40, "Visualization": 0.35, "Analysis": 0.15, "Communication": 0.10 }
    },
    "Full Stack Developer": {
        beginner: ["html", "css", "javascript", "react", "node", "git"],
        intermediate: ["typescript", "tailwind", "express", "mongodb", "postgresql", "rest_api", "authentication"],
        advanced: ["nextjs", "state_management", "system_design", "docker", "caching", "ci_cd", "performance_tuning"],
        description: "Builds complete web applications from interactive user interfaces to robust server backends and databases.",
        categoryWeights: { "Frontend": 0.35, "Backend": 0.35, "Database": 0.15, "DevOps": 0.15 }
    },
    "Backend Developer": {
        beginner: ["node", "express", "database", "sql", "git", "rest_api"],
        intermediate: ["postgresql", "mongodb", "system_design", "docker", "authentication", "unit_testing", "caching"],
        advanced: ["microservices", "kubernetes", "message_queues", "redis", "distributed_systems", "observability"],
        description: "Engineers high-performance server logic, distributed databases, authentication systems, and cloud APIs.",
        categoryWeights: { "Server Architecture": 0.35, "Databases & Cache": 0.30, "API Design": 0.20, "Testing & Cloud": 0.15 }
    },
    "Frontend Developer": {
        beginner: ["html", "css", "javascript", "responsive_design", "git"],
        intermediate: ["react", "typescript", "tailwind", "state_management", "rest_api", "vite"],
        advanced: ["nextjs", "web_vitals", "frontend_architecture", "accessibility", "testing_library", "performance"],
        description: "Creates responsive, accessible, pixel-perfect user experiences with modern JavaScript frameworks.",
        categoryWeights: { "Core UI & Styling": 0.35, "React Ecosystem": 0.35, "Performance & A11y": 0.15, "Tooling": 0.15 }
    },
    "DevOps / Cloud Engineer": {
        beginner: ["linux", "bash", "networking", "git", "ci_cd"],
        intermediate: ["docker", "aws", "terraform", "github_actions", "ansible", "monitoring"],
        advanced: ["kubernetes", "infrastructure_as_code", "helm", "prometheus", "grafana", "cloud_security", "cost_optimization"],
        description: "Automates continuous integration, cloud infrastructure, container orchestration, and system reliability.",
        categoryWeights: { "Cloud & Containers": 0.40, "CI/CD & Automation": 0.30, "Linux & Security": 0.20, "Observability": 0.10 }
    },
    "AI Agent Developer": {
        beginner: ["python", "asyncio", "openai_api", "json_parsing", "tool_calling"],
        intermediate: ["langgraph", "crewai", "autogen", "memory_systems", "mcp_servers", "vector_embeddings"],
        advanced: ["multi_agent_coordination", "state_machine_agents", "sandbox_execution", "human_in_the_loop", "resilience"],
        description: "Specializes in developing autonomous AI agents with tool use, memory systems, and multi-agent coordination.",
        categoryWeights: { "Agent Frameworks": 0.45, "Tooling & Protocols": 0.25, "Backend Reliability": 0.20, "Evaluation": 0.10 }
    }
};

const roleAliases = {
    "ml engineer": "AI/ML Engineer",
    "machine learning engineer": "AI/ML Engineer",
    "ai engineer": "AI/ML Engineer",
    "aiml engineer": "AI/ML Engineer",
    "genai engineer": "Generative AI / LLM Engineer",
    "generative ai engineer": "Generative AI / LLM Engineer",
    "llm engineer": "Generative AI / LLM Engineer",
    "ai agent developer": "AI Agent Developer",
    "agent developer": "AI Agent Developer",
    "data science": "Data Scientist",
    "data scientist": "Data Scientist",
    "data analyst": "Data Analyst",
    "business analyst": "Data Analyst",
    "full stack developer": "Full Stack Developer",
    "fullstack developer": "Full Stack Developer",
    "full stack engineer": "Full Stack Developer",
    "fullstack engineer": "Full Stack Developer",
    "backend engineer": "Backend Developer",
    "backend developer": "Backend Developer",
    "frontend engineer": "Frontend Developer",
    "frontend developer": "Frontend Developer",
    "front end developer": "Frontend Developer",
    "devops": "DevOps / Cloud Engineer",
    "devops engineer": "DevOps / Cloud Engineer",
    "cloud engineer": "DevOps / Cloud Engineer",
    "sre": "DevOps / Cloud Engineer"
};

const stopWords = new Set([
    "and", "or", "the", "a", "an", "for", "to", "of", "in", "on", "with", "from", "is", "are", "be", "as", "by",
    "will", "can", "our", "you", "your", "we", "this", "that", "at", "it", "have", "has", "all", "about"
]);

function normalizeSkill(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\/\-\s]+/g, "_");
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
            resolvedRole: "Full Stack Developer",
            confidence: 0.5
        };
    }

    if (roleAliases[normalizedInput]) {
        return {
            resolvedRole: roleAliases[normalizedInput],
            confidence: 1.0
        };
    }

    const roleNames = Object.keys(roleSkillMap);
    for (const role of roleNames) {
        const norm = normalizeRole(role);
        if (norm === normalizedInput) {
            return { resolvedRole: role, confidence: 1.0 };
        }
        if (norm.includes(normalizedInput) || normalizedInput.includes(norm)) {
            return { resolvedRole: role, confidence: 0.85 };
        }
    }

    // Default match
    return {
        resolvedRole: "Full Stack Developer",
        confidence: 0.6
    };
}

function extractKeywords(text) {
    const words = String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9_\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .filter(word => word.length > 2 && !stopWords.has(word));

    const frequency = new Map();
    words.forEach(word => {
        frequency.set(word, (frequency.get(word) || 0) + 1);
    });

    return Array.from(frequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([word]) => word);
}

// Calculate explainable fit score
function calculateFitScore(requiredSkills, userSkills, experienceYears = 0, resumeText = "") {
    const required = Array.isArray(requiredSkills)
        ? requiredSkills.map(normalizeSkill).filter(Boolean)
        : [];

    const userSkillSet = new Set(
        (Array.isArray(userSkills) ? userSkills : []).map(normalizeSkill).filter(Boolean)
    );

    const resumeLower = String(resumeText || "").toLowerCase();

    const strongSkills = [];
    const partiallyMatchingSkills = [];
    const missingSkills = [];

    required.forEach(skill => {
        const cleanSkillName = skill.replace(/_/g, " ");
        if (userSkillSet.has(skill) || userSkillSet.has(cleanSkillName)) {
            strongSkills.push(skill);
        } else if (resumeLower.includes(cleanSkillName) || resumeLower.includes(skill)) {
            partiallyMatchingSkills.push(skill);
        } else {
            missingSkills.push(skill);
        }
    });

    const totalReq = required.length || 1;
    const baseSkillScore = ((strongSkills.length * 1.0 + partiallyMatchingSkills.length * 0.65) / totalReq) * 85;

    // Experience boost: up to 15 points
    const expYears = Number(experienceYears) || 0;
    const experienceBoost = Math.min(15, Math.round(expYears * 2.5));

    const finalScore = Math.min(99, Math.max(15, Math.round(baseSkillScore + experienceBoost)));

    // Categorized evaluation
    const categories = [
        {
            subject: "Frontend & UI",
            score: strongSkills.some(s => ["react", "html", "css", "javascript", "typescript", "tailwind", "nextjs"].includes(s)) ? 88 : partiallyMatchingSkills.some(s => ["react", "javascript"].includes(s)) ? 60 : 35
        },
        {
            subject: "Backend & APIs",
            score: strongSkills.some(s => ["node", "express", "python", "rest_api", "database", "sql"].includes(s)) ? 90 : partiallyMatchingSkills.some(s => ["node", "python", "sql"].includes(s)) ? 65 : 40
        },
        {
            subject: "Data & ML",
            score: strongSkills.some(s => ["python", "sql", "statistics", "ml", "pytorch", "pandas", "data_cleaning"].includes(s)) ? 86 : partiallyMatchingSkills.some(s => ["python", "sql"].includes(s)) ? 60 : 30
        },
        {
            subject: "DevOps & Cloud",
            score: strongSkills.some(s => ["docker", "aws", "kubernetes", "ci_cd", "linux", "terraform"].includes(s)) ? 85 : partiallyMatchingSkills.some(s => ["docker", "git"].includes(s)) ? 58 : 25
        },
        {
            subject: "System Design",
            score: strongSkills.some(s => ["system_design", "microservices", "redis", "caching", "architecture"].includes(s)) ? 84 : 45
        },
        {
            subject: "Testing & Reliability",
            score: strongSkills.some(s => ["unit_testing", "testing", "ci_cd", "observability"].includes(s)) ? 82 : 48
        }
    ];

    const suggestions = [];
    if (missingSkills.length > 0) {
        missingSkills.slice(0, 4).forEach(skill => {
            suggestions.push(`Build a portfolio feature implementing ${skill.replace(/_/g, " ")} with verifiable outcomes.`);
        });
    }

    if (expYears < 2) {
        suggestions.push("Highlight production metrics (e.g. latency reduced by X%, test coverage at Y%) to compensate for early-career experience.");
    }

    if (suggestions.length === 0) {
        suggestions.push("Your core skills match very strongly. Tailor your resume achievements to the target job's specific domain challenges.");
    }

    const keywordCoverage = Math.round(((strongSkills.length + partiallyMatchingSkills.length) / totalReq) * 100);

    return {
        matchPercentage: finalScore,
        strongSkills,
        partiallyMatchingSkills,
        missingSkills,
        keywordCoverage,
        experienceAlignment: expYears >= 3 ? "Strong senior/mid alignment" : expYears >= 1 ? "Solid foundational alignment" : "Entry-level with high growth potential",
        categories,
        suggestions
    };
}

// Career Role Predictor (Phase 4.5)
function predictCareerRoles({ skills = [], experienceYears = 0, education = "", interests = [], targetAreas = [] }) {
    const userSkills = (Array.isArray(skills) ? skills : []).map(normalizeSkill);
    const userInterests = (Array.isArray(interests) ? interests : []).map(normalizeRole);
    const userTargetAreas = (Array.isArray(targetAreas) ? targetAreas : []).map(normalizeRole);

    const predictions = [];

    for (const [roleName, roleData] of Object.entries(roleSkillMap)) {
        const allRoleSkills = [...roleData.beginner, ...roleData.intermediate, ...roleData.advanced];
        const matching = allRoleSkills.filter(s => userSkills.includes(s));
        const missing = allRoleSkills.filter(s => !userSkills.includes(s));

        let score = (matching.length / (allRoleSkills.length || 1)) * 75;

        // Boost if matches user interests
        const normRole = normalizeRole(roleName);
        if (userInterests.some(i => normRole.includes(i) || i.includes(normRole))) {
            score += 15;
        }
        if (userTargetAreas.some(t => normRole.includes(t) || t.includes(normRole))) {
            score += 10;
        }

        score = Math.min(98, Math.max(20, Math.round(score + Math.min(10, experienceYears * 2))));

        predictions.push({
            role: roleName,
            suitabilityScore: score,
            description: roleData.description,
            existingSkills: matching.slice(0, 6),
            missingSkills: missing.slice(0, 5),
            recommendedLearningPath: `Focus on mastering ${missing.slice(0, 3).map(s => s.replace(/_/g, " ")).join(", ")} over a 12-week sprint.`
        });
    }

    predictions.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    return {
        topRecommendations: predictions.slice(0, 4),
        allPredictions: predictions,
        guidanceNote: "These recommendations represent strategic skill-market alignment guidance based on industry standards, not guaranteed employment predictions."
    };
}

// Generate Personalized Roadmap (Phase 4.6)
function generateRoadmap(role, hoursPerDay = 2, months = 3, currentLevel = "Beginner") {
    const { resolvedRole, confidence } = resolveRoleProfile(role);
    const profile = roleSkillMap[resolvedRole] || roleSkillMap["Full Stack Developer"];

    const totalWeeks = Math.max(4, Math.round((Number(months) || 3) * 4));
    const totalHours = Math.max(30, Math.round((Number(hoursPerDay) || 2) * 7 * totalWeeks));

    const weeksPerPhase = Math.max(1, Math.floor(totalWeeks / 3));

    const phases = [
        {
            name: "Phase 1: Core Foundations & Architecture",
            durationWeeks: weeksPerPhase,
            focus: `Master fundamentals: ${profile.beginner.slice(0, 4).map(s => s.replace(/_/g, " ")).join(", ")}`,
            milestone: "Ship 1 production-ready fundamentals mini-project with unit tests.",
            skills: profile.beginner
        },
        {
            name: "Phase 2: Intermediate Growth & System Integration",
            durationWeeks: weeksPerPhase,
            focus: `Build real-world features: ${profile.intermediate.slice(0, 4).map(s => s.replace(/_/g, " ")).join(", ")}`,
            milestone: "Deploy an end-to-end full application with authentication and persistent database.",
            skills: profile.intermediate
        },
        {
            name: "Phase 3: Advanced Mastery, Scaling & Production Readiness",
            durationWeeks: totalWeeks - (weeksPerPhase * 2),
            focus: `Mastery & cloud deployment: ${profile.advanced.slice(0, 4).map(s => s.replace(/_/g, " ")).join(", ")}`,
            milestone: "Architect, benchmark, and deploy a scalable project with CI/CD and metrics logging.",
            skills: profile.advanced
        }
    ];

    const weeklyPlan = [];
    const allSkills = [...profile.beginner, ...profile.intermediate, ...profile.advanced];

    for (let week = 1; week <= totalWeeks; week++) {
        const skillIndex = Math.min(allSkills.length - 1, Math.floor(((week - 1) / totalWeeks) * allSkills.length));
        const activeSkill = allSkills[skillIndex] || "system_design";
        const phaseName = week <= weeksPerPhase ? "Foundations" : week <= weeksPerPhase * 2 ? "Growth" : "Mastery";

        weeklyPlan.push({
            week,
            focus: `${phaseName}: Deep dive into ${activeSkill.replace(/_/g, " ")}`,
            hours: Math.round(totalHours / totalWeeks),
            deliverable: week % 2 === 0
                ? `Publish code walkthrough & benchmark for ${activeSkill.replace(/_/g, " ")}`
                : `Complete core exercises and implement mini-module for ${activeSkill.replace(/_/g, " ")}`,
            completed: false,
            completedAt: null
        });
    }

    const recommendations = [
        "Commit code daily and document your architectural decisions in README design notes.",
        "Set aside 1 hour every Friday to simulate an interview question on that week's topic.",
        "Deploy your milestones publicly on GitHub, Vercel, or Render to showcase verifiable proof of work."
    ];

    return {
        title: `${resolvedRole} Mastery Roadmap`,
        targetRole: resolvedRole,
        confidence,
        currentSkillLevel: currentLevel,
        hoursPerDay: Number(hoursPerDay) || 2,
        months: Number(months) || 3,
        totalHours,
        totalWeeks,
        phases,
        weeklyPlan,
        recommendations,
        progressPercentage: 0
    };
}

// Resume Optimizer & ATS Analyzer (Phase 4.7)
function suggestResumeImprovements(resumeText, role) {
    const text = String(resumeText || "");
    const lowerText = text.toLowerCase();
    const { resolvedRole } = resolveRoleProfile(role);
    const profile = roleSkillMap[resolvedRole] || roleSkillMap["Full Stack Developer"];
    const roleKeywords = [...profile.beginner, ...profile.intermediate, ...profile.advanced];

    const matchedKeywords = roleKeywords.filter(k => lowerText.includes(k.replace(/_/g, " ")));
    const missingKeywords = roleKeywords.filter(k => !lowerText.includes(k.replace(/_/g, " ")));

    // ATS Checklist & checks
    const hasContact = /email|phone|\.com|github|linkedin/i.test(text);
    const hasProjects = /project|repository|github\.com|built|deployed/i.test(text);
    const hasMetrics = /\d+%\s*|\$\d+|\b\d+\s*(ms|seconds|minutes|users|requests|qps|k)\b/i.test(text);
    const hasActionVerbs = /\b(engineered|architected|spearheaded|optimized|implemented|deployed|reduced|accelerated|streamlined)\b/i.test(text);
    const hasClearSections = /experience|education|skills|projects|summary/i.test(text);

    let atsScore = 30;
    if (hasContact) atsScore += 10;
    if (hasProjects) atsScore += 15;
    if (hasMetrics) atsScore += 15;
    if (hasActionVerbs) atsScore += 15;
    if (hasClearSections) atsScore += 15;

    const bulletSuggestions = [
        "Transform passive tasks into active impact: 'Responsible for backend APIs' -> 'Engineered 12 RESTful microservices, reducing query response times by 38%'.",
        "Adopt Google's X-Y-Z formula: Accomplished [X] as measured by [Y], by doing [Z].",
        "Standardize section titles to standard ATS headers: Summary, Technical Skills, Professional Experience, Projects, Education.",
        `Incorporate top target keywords: ${missingKeywords.slice(0, 3).map(k => k.replace(/_/g, " ")).join(", ")} inside relevant project bullets.`
    ];

    const atsChecklist = {
        hasContactSection: hasContact,
        hasProjectsSection: hasProjects,
        hasImpactMetrics: hasMetrics,
        hasStrongActionVerbs: hasActionVerbs,
        hasStandardSections: hasClearSections
    };

    return {
        role: resolvedRole,
        atsScore: Math.min(95, atsScore),
        matchedKeywords: matchedKeywords.map(k => k.replace(/_/g, " ")),
        missingKeywords: missingKeywords.map(k => k.replace(/_/g, " ")),
        bulletSuggestions,
        atsChecklist
    };
}

// Cover Letter Generator (Phase 4.8)
function generateCoverLetterDraft({ role, companyName, jobDescription = "", resumeText = "", tone = "Professional" }) {
    const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const cleanRole = role.trim();
    const cleanCompany = companyName.trim();

    let openingP = "";
    if (tone === "Confident") {
        openingP = `I am writing to express my strong enthusiasm for the ${cleanRole} role at ${cleanCompany}. With a proven track record of architecting reliable software solutions and solving complex technical challenges, I am eager to make an immediate, high-impact contribution to your engineering initiatives.`;
    } else if (tone === "Enthusiastic") {
        openingP = `I was thrilled to discover the ${cleanRole} opening at ${cleanCompany}! As someone who deeply admires ${cleanCompany}'s innovation and mission, I would love the opportunity to bring my energy, technical proficiency, and dedication to your collaborative team.`;
    } else if (tone === "Concise") {
        openingP = `Please accept this application for the ${cleanRole} position at ${cleanCompany}. With solid technical competence and hands-on experience delivering reliable software, I am ready to support your engineering goals.`;
    } else {
        openingP = `I am writing to officially submit my application for the ${cleanRole} position at ${cleanCompany}. Having followed ${cleanCompany}'s growth, I am impressed by your team's dedication to quality and forward-thinking technological solutions.`;
    }

    let bodyP1 = "";
    if (resumeText && resumeText.length > 50) {
        bodyP1 = `Throughout my work, I have focused on building scalable, maintainable systems while ensuring high performance and security. My background in software design and continuous integration enables me to rapidly align with your existing stack and deliver measurable results from day one.`;
    } else {
        bodyP1 = `My technical background has equipped me with strong problem-solving capabilities, rapid adaptability, and a disciplined approach to writing clean, maintainable code. I thrive in environments that value high standards, collaborative ownership, and engineering excellence.`;
    }

    let bodyP2 = "";
    if (jobDescription && jobDescription.length > 20) {
        bodyP2 = `The challenges outlined in your job requirements resonate closely with my professional strengths. I am particularly eager to apply my experience toward solving the architectural and functional goals critical to ${cleanCompany}'s ongoing success.`;
    } else {
        bodyP2 = `I am confident that my technical skills, proactive communication, and passion for continuous improvement will be a valuable asset to ${cleanCompany}'s objectives.`;
    }

    const closingP = `I would welcome the opportunity to speak with your team and discuss how my background and work ethic will benefit ${cleanCompany}. Thank you for your time and consideration.\n\nSincerely,\n\n[Your Name]\n[Your Contact Information]\n[LinkedIn Profile / Portfolio]`;

    const fullLetter = `${date}\n\nHiring Team\n${cleanCompany}\n\nDear Hiring Team,\n\n${openingP}\n\n${bodyP1}\n\n${bodyP2}\n\n${closingP}`;

    return fullLetter;
}

// AI Interview Guidance & Evaluation (Phase 4.9)
function generateInterviewGuidance(role, focusSkills = [], difficulty = "Intermediate") {
    const { resolvedRole } = resolveRoleProfile(role);
    const profile = roleSkillMap[resolvedRole] || roleSkillMap["Full Stack Developer"];
    const allSkills = focusSkills.length > 0 ? focusSkills : [...profile.beginner, ...profile.intermediate];

    const technicalQuestions = [
        `Explain how you would design and optimize an API endpoint for high-throughput traffic using ${allSkills[0]?.replace(/_/g, " ") || "modern backend techniques"}.`,
        `What are the most common memory leaks or performance bottlenecks in ${allSkills[1]?.replace(/_/g, " ") || "this stack"}, and how do you diagnose them?`,
        `Walk through your approach to error handling and transactions when persisting relational or document data.`,
        `How do you handle graceful degradation and circuit breaking in distributed services?`
    ];

    const behavioralQuestions = [
        "Describe a time you encountered a critical production bug right before a release. How did you triage and resolve it?",
        "Tell me about a technical disagreement you had with a team member. How did you resolve the difference objectively?",
        "Give an example of a project where requirements shifted mid-development. How did you adapt your architecture?"
    ];

    const mockPlan = [
        "Day 1: Technical Deep Dive - Core language semantics, asynchronous patterns, and data structures.",
        "Day 2: System Design Drill - Data flow diagrams, caching strategies, and API contracts.",
        "Day 3: Behavioral Polish - Structure 3 compelling stories using the STAR method (Situation, Task, Action, Result)."
    ];

    return {
        role: resolvedRole,
        difficulty,
        technicalQuestions,
        behavioralQuestions,
        mockPlan
    };
}

function evaluateInterviewAnswer(role, currentAnswer, question = "") {
    const answer = String(currentAnswer || "").trim();
    const wordCount = answer.split(/\s+/).filter(Boolean).length;

    let score = 5;
    let feedback = "";
    let nextQuestion = "";

    const hasMetrics = /\d+%|\b(ms|seconds|minutes|users|qps|reduced|scaled)\b/i.test(answer);
    const hasSTAR = /\b(situation|task|action|result|when|because|then|led to)\b/i.test(answer);

    if (wordCount < 15) {
        score = 4;
        feedback = "Answer is too brief. In a real technical interview, clearly outline context, your specific technical decisions, and the resulting business impact.";
        nextQuestion = "Can you describe a specific time you solved a challenging technical issue in production?";
    } else if (wordCount < 45) {
        score = hasSTAR || hasMetrics ? 7 : 6;
        feedback = "Good foundation, but you can strengthen your answer by structuring it with the STAR method and quantifying your achievements.";
        nextQuestion = "How do you ensure maintainability and testability when writing production code under tight deadlines?";
    } else {
        score = hasMetrics && hasSTAR ? 9 : 8;
        feedback = "Excellent response! Well-structured with clear technical rationale and measurable outcomes.";
        nextQuestion = "Where do you envision your technical leadership and architectural expertise expanding over the next 2-3 years?";
    }

    return {
        score,
        feedback,
        reply: `${feedback}\n\nFollow-up question:\n${nextQuestion}`
    };
}

function evaluateJobFit(user, job) {
    let jobSkills = (job && job.skills && job.skills.length > 0)
        ? job.skills
        : (job && job.requirements && job.requirements.length > 0)
            ? job.requirements
            : [];

    if (!jobSkills || jobSkills.length === 0) {
        jobSkills = extractKeywords(`${job?.title || ""} ${job?.description || ""}`);
    }

    const userSkills = (user && user.skills) || [];
    const experienceYears = (user && user.experienceYears) || 0;
    const resumeText = (user && user.resumeText) || "";

    const fit = calculateFitScore(jobSkills, userSkills, experienceYears, resumeText);
    return {
        score: fit.matchPercentage,
        matchingSkills: fit.strongSkills || [],
        partiallyMatchingSkills: fit.partiallyMatchingSkills || [],
        missingSkills: fit.missingSkills || [],
        suggestions: fit.suggestions || []
    };
}

module.exports = {
    calculateFitScore,
    evaluateJobFit,
    extractKeywords,
    predictCareerRoles,
    generateRoadmap,
    suggestResumeImprovements,
    generateCoverLetterDraft,
    generateCoverLetter: generateCoverLetterDraft,
    generateInterviewGuidance,
    evaluateInterviewAnswer,
    roleSkillMap,
    resolveRoleProfile
};
