"""
CareerOS AI Resume Intelligence Knowledge Base
Curated frameworks, guidelines, action verbs, and ATS rules.
"""

from typing import List, Dict

ACTION_VERBS = {
    "leadership": [
        "Architected", "Spearheaded", "Directed", "Orchestrated", "Pioneered",
        "Championed", "Led", "Steered", "Mobilized", "Mentored"
    ],
    "engineering_and_dev": [
        "Implemented", "Engineered", "Designed", "Developed", "Deployed",
        "Refactored", "Optimized", "Integrated", "Automated", "Constructed"
    ],
    "optimization_and_impact": [
        "Accelerated", "Maximized", "Minimized", "Reduced", "Amplified",
        "Boosted", "Streamlined", "Enhanced", "Scaled", "Revitalized"
    ],
    "problem_solving": [
        "Resolved", "Diagnosed", "Identified", "Troubleshot", "Debugged",
        "Mitigated", "Overhauled", "Corrected", "Standardized"
    ],
    "collaboration_and_delivery": [
        "Coordinated", "Delivered", "Authored", "Collaborated", "Facilitated",
        "Negotiated", "Shipped", "Executed", "Unified"
    ]
}

ALL_ACTION_VERBS = [verb.lower() for cat in ACTION_VERBS.values() for verb in cat]

WEAK_PHRASES_MAP = {
    "responsible for": "Engineered and owned",
    "duties included": "Executed",
    "worked on": "Developed and deployed",
    "helped with": "Collaborated to deliver",
    "assisted in": "Co-engineered and facilitated",
    "handled": "Administered and maintained",
    "participated in": "Contributed directly to",
    "involved in": "Spearheaded development of",
    "familiar with": "Applied in production",
    "knowledge of": "Implemented using"
}

ATS_HEADINGS_STANDARD = {
    "personal_information": ["contact", "personal information", "details"],
    "summary": ["professional summary", "summary", "about me", "profile", "overview", "executive summary"],
    "skills": ["skills", "technical skills", "core competencies", "technologies", "tech stack", "tools & technologies"],
    "experience": ["experience", "work experience", "professional experience", "employment history", "work history"],
    "projects": ["projects", "personal projects", "key projects", "notable projects", "technical projects"],
    "education": ["education", "academic background", "qualifications", "academic qualifications"],
    "certifications": ["certifications", "licenses & certifications", "credentials", "certificates"],
    "achievements": ["achievements", "honors & awards", "awards", "accomplishments", "recognition"]
}

RESUME_WRITING_RULES = [
    {
        "name": "Google XYZ Formula",
        "rule": "Every impact bullet should follow: Accomplished [X], as measured by [Y], by doing [Z].",
        "description": "Start with a strong action verb, state the concrete measurable business/technical outcome (e.g. latency, cost, throughput, revenue, user adoption), and explain the exact technical method/tool used."
    },
    {
        "name": "Factual Integrity & Zero Hallucination",
        "rule": "Never invent dates, employer names, project scopes, credentials, or metrics. Rephrase and quantify existing factual claims only.",
        "description": "If metrics are unstated, highlight achievements through technical precision rather than creating synthetic percentages."
    },
    {
        "name": "ATS Single-Column Format",
        "rule": "Avoid multi-column tables, text boxes, graphics, headers/footers, and non-standard symbols in parsed/generated resumes.",
        "description": "ATS parsers parse left-to-right linearly; multi-column formats cause interleaving errors."
    },
    {
        "name": "Eliminate Fluff & Soft Skill Keyword Stuffing",
        "rule": "Replace vague claims ('hard worker', 'team player') with verifiable technical deliverables and demonstrable project outcomes.",
        "description": "Demonstrate soft skills through leadership of cross-functional projects and sprint deliveries."
    }
]

