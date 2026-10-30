"""
Job Description Analyzer Service
Parses raw job descriptions, extracts mandatory vs preferred qualifications,
tech stack, experience requirements, and responsibilities.
"""

import re
from typing import List, Dict, Optional
from app.schemas.job import StructuredJobDescription, RequirementItem
from app.services.skill_extractor import SkillExtractor
from app.knowledge_base.taxonomy import get_skill_category

EXPERIENCE_REGEX = re.compile(r"(\d+)(?:\+|-(\d+))?\s*(?:years?|yrs?)(?:\s*of)?\s*(?:experience|exp)?", re.IGNORECASE)
EDUCATION_KEYWORDS = ["bachelor", "master", "phd", "b.tech", "m.tech", "degree in computer science", "engineering"]

class JobAnalyzer:
    @classmethod
    def analyze(cls, text: str, job_title: Optional[str] = None, company: Optional[str] = None) -> StructuredJobDescription:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        
        # 1. Title inference if not supplied
        inferred_title = job_title
        if not inferred_title and lines:
            first_line = lines[0]
            if len(first_line) < 60 and any(kw in first_line.lower() for kw in ["engineer", "developer", "architect", "lead", "designer", "scientist", "manager", "intern"]):
                inferred_title = first_line
        if not inferred_title:
            inferred_title = "Software Engineer"

        # 2. Extract technical skills
        evidences = SkillExtractor.extract_from_text(text, section_hint="job_description")
        all_skills = [e.canonical_name for e in evidences]
        categorized = SkillExtractor.categorize_skills(all_skills)
        
        # 3. Partition sections (Mandatory vs Preferred vs Responsibilities)
        mandatory_bullets: List[str] = []
        preferred_bullets: List[str] = []
        responsibilities: List[str] = []
        classified_reqs: List[RequirementItem] = []
        
        current_mode = "general"
        for line in lines:
            lower = line.lower()
            if any(h in lower for h in ["requirement", "qualifications", "must have", "what you need", "minimum"]):
                current_mode = "mandatory"
                continue
            elif any(h in lower for h in ["preferred", "nice to have", "plus", "bonus", "desirable"]):
                current_mode = "preferred"
                continue
            elif any(h in lower for h in ["responsibilities", "what you will do", "duties", "role"]):
                current_mode = "responsibilities"
                continue
                
            clean_line = re.sub(r"^[\s•\-*>]+\s*", "", line).strip()
            if not clean_line or len(clean_line) < 10:
                continue
                
            if current_mode == "mandatory":
                mandatory_bullets.append(clean_line)
                classified_reqs.append(RequirementItem(name=clean_line[:100], category="experience", importance="mandatory", context=clean_line))
            elif current_mode == "preferred":
                preferred_bullets.append(clean_line)
                classified_reqs.append(RequirementItem(name=clean_line[:100], category="experience", importance="preferred", context=clean_line))
            elif current_mode == "responsibilities":
                responsibilities.append(clean_line)

        # 4. Extract required years of experience
        exp_years = 0.0
        exp_matches = EXPERIENCE_REGEX.findall(text)
        if exp_matches:
            try:
                # Find the maximum lower-bound number mentioned
                years = [float(m[0]) for m in exp_matches if m[0] and float(m[0]) <= 20]
                if years:
                    exp_years = max(years)
            except Exception:
                exp_years = 0.0

        # 5. Extract Education Requirements
        required_edu = []
        for kw in EDUCATION_KEYWORDS:
            if re.search(rf"\b{re.escape(kw)}\b", text, re.IGNORECASE):
                required_edu.append(kw.title())

        # Map extracted skills into classified requirements
        for skill in all_skills:
            classified_reqs.append(RequirementItem(
                name=skill,
                category=get_skill_category(skill),
                importance="mandatory" if any(skill.lower() in m.lower() for m in mandatory_bullets) else "preferred",
                context=f"Mentioned in job description: {skill}"
            ))

        return StructuredJobDescription(
            job_title=inferred_title,
            company=company or "Target Employer",
            mandatory_qualifications=mandatory_bullets[:15],
            preferred_qualifications=preferred_bullets[:10],
            technical_skills=all_skills,
            programming_languages=categorized.programming_languages,
            frameworks=categorized.frameworks,
            tools=categorized.cloud_tools + categorized.databases,
            required_experience_years=exp_years,
            required_education=list(set(required_edu)),
            responsibilities=responsibilities[:15],
            classified_requirements=classified_reqs,
            raw_text=text
        )

