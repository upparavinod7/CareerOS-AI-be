"""
ATS Scoring Engine
Deterministic 6-component weighted scoring algorithm calculating job-to-resume compatibility.
Weights:
- Required skills: 30%
- Experience relevance: 20%
- Keyword coverage: 15%
- Project relevance: 15%
- Education: 10%
- Formatting: 10%
"""

from typing import List, Set, Dict, Any
from app.schemas.resume import StructuredResume
from app.schemas.job import StructuredJobDescription
from app.schemas.analysis import ATSCompatibilityReport, ATSScoreComponents
from app.services.embedding_service import EmbeddingService

class ATSScorer:
    @classmethod
    def calculate_score(cls, resume: StructuredResume, job: StructuredJobDescription) -> ATSCompatibilityReport:
        # Gather all candidate skills into a flat canonical set
        candidate_skills: Set[str] = set()
        for cat in [
            resume.skills.programming_languages,
            resume.skills.frameworks,
            resume.skills.libraries,
            resume.skills.databases,
            resume.skills.cloud_tools,
            resume.skills.ai_ml_tools,
            resume.skills.other
        ]:
            for s in cat:
                candidate_skills.add(s.strip().lower())
                
        # Also check technologies used in work experience and projects
        for exp in resume.experience:
            for t in exp.technologies_used:
                candidate_skills.add(t.strip().lower())
        for prj in resume.projects:
            for t in prj.technologies:
                candidate_skills.add(t.strip().lower())

        job_req_skills = [s.strip().lower() for s in job.technical_skills]
        
        # 1. Required Skills Score (30%)
        matched: List[str] = []
        missing: List[str] = []
        
        for req in job_req_skills:
            if req in candidate_skills:
                matched.append(req.title())
            else:
                # Check partial match (substring or similar stem)
                partial = any(req in cs or cs in req for cs in candidate_skills)
                if not partial:
                    missing.append(req.title())

        skills_score = (len(matched) / max(1, len(job_req_skills))) * 100.0 if job_req_skills else 85.0
        skills_score = min(100.0, skills_score)

        # 2. Experience Relevance Score (20%)
        # Compare job title and responsibilities with candidate experience
        exp_texts = []
        for exp in resume.experience:
            exp_texts.append(f"{exp.title} {exp.company} {' '.join(exp.highlights)}")
        all_exp_text = " ".join(exp_texts)
        
        job_exp_text = f"{job.job_title} {' '.join(job.responsibilities)} {' '.join(job.mandatory_qualifications)}"
        exp_sim = EmbeddingService.compute_similarity(all_exp_text, job_exp_text)
        exp_score = min(100.0, exp_sim * 120.0) # scaled

        # 3. Keyword Coverage Score (15%)
        # Check presence of mandatory qualification keywords
        total_kws = len(job.mandatory_qualifications)
        if total_kws > 0:
            similarities = [EmbeddingService.compute_similarity(all_exp_text, mq) for mq in job.mandatory_qualifications]
            avg_sim = sum(similarities) / total_kws
            kw_score = min(100.0, max(35.0, avg_sim * 160.0))
        else:
            kw_score = 80.0

        # 4. Project Relevance Score (15%)
        proj_texts = []
        for prj in resume.projects:
            proj_texts.append(f"{prj.name} {prj.description} {' '.join(prj.highlights)} {' '.join(prj.technologies)}")
        all_proj_text = " ".join(proj_texts)
        proj_sim = EmbeddingService.compute_similarity(all_proj_text, job_exp_text)
        proj_score = min(100.0, proj_sim * 125.0)

        # 5. Education Score (10%)
        edu_score = 50.0 # base for any education
        if resume.education:
            edu_score = 85.0
            for edu in resume.education:
                deg_lower = edu.degree.lower()
                for req_edu in job.required_education:
                    if req_edu.lower() in deg_lower:
                        edu_score = 100.0
                        break

        # 6. Formatting Score (10%)
        formatting_issues: List[str] = []
        fmt_score = 100.0
        
        if not resume.personal_information.email:
            fmt_score -= 20.0
            formatting_issues.append("Email address is missing from header.")
        if not resume.personal_information.phone:
            fmt_score -= 15.0
            formatting_issues.append("Contact phone number is missing.")
        if len(resume.experience) == 0 and len(resume.projects) == 0:
            fmt_score -= 30.0
            formatting_issues.append("No work experience or project entries identified.")
        if not resume.professional_summary:
            fmt_score -= 10.0
            formatting_issues.append("Professional summary section is absent.")
        fmt_score = max(20.0, fmt_score)

        # Weighted calculation
        overall = (
            (skills_score * 0.30) +
            (exp_score * 0.20) +
            (kw_score * 0.15) +
            (proj_score * 0.15) +
            (edu_score * 0.10) +
            (fmt_score * 0.10)
        )
        overall = round(min(100.0, max(0.0, overall)), 1)

        # Recommendations
        recommendations = []
        if missing:
            recommendations.append(f"Incorporate missing core skills if you have experience with them: {', '.join(missing[:4])}.")
        if exp_score < 70.0:
            recommendations.append("Align your experience bullet points with the target responsibilities using clear action verbs.")
        if not resume.personal_information.linkedin:
            recommendations.append("Add your LinkedIn profile link to improve recruiter verification.")

        return ATSCompatibilityReport(
            overall_score=overall,
            score_type="careerOS_job_compatibility",
            components=ATSScoreComponents(
                required_skills=round(skills_score, 1),
                experience_relevance=round(exp_score, 1),
                keyword_coverage=round(kw_score, 1),
                project_relevance=round(proj_score, 1),
                education=round(edu_score, 1),
                formatting=round(fmt_score, 1)
            ),
            matched_skills=matched,
            missing_skills=missing,
            partially_matched_skills=[],
            keyword_suggestions=[f"Demonstrate experience with {s}" for s in missing[:5]],
            formatting_issues=formatting_issues,
            recommendations=recommendations
        )
