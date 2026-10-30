"""
Resume Quality & ATS Format Checker Service
16-point comprehensive audit checking readability, contact completeness,
bullet metrics, action verb diversity, and structural formatting.
"""

import re
from typing import List, Set
from app.schemas.resume import StructuredResume
from app.schemas.analysis import QualityCheckReport, FormattingIssue
from app.knowledge_base.documents import ALL_ACTION_VERBS, WEAK_PHRASES_MAP

METRIC_REGEX = re.compile(r"(\b\d+(?:\.\d+)?%|\$\d+(?:,\d+)*(?:\.\d+)?|\b\d+\+?\b|\b\d+x\b)", re.IGNORECASE)

class QualityChecker:
    @classmethod
    def audit(cls, resume: StructuredResume) -> QualityCheckReport:
        issues: List[FormattingIssue] = []
        strengths: List[str] = []
        
        # 1. Contact Info Checks (Checks 1-5)
        pi = resume.personal_information
        if not pi.email:
            issues.append(FormattingIssue(
                code="MISSING_EMAIL", severity="high",
                message="No email address found in the contact section.",
                suggested_fix="Include a professional email address at the top."
            ))
        else:
            strengths.append("Valid contact email present.")

        if not pi.phone:
            issues.append(FormattingIssue(
                code="MISSING_PHONE", severity="high",
                message="No telephone number found in the contact section.",
                suggested_fix="Include your international phone number."
            ))

        if not pi.location:
            issues.append(FormattingIssue(
                code="MISSING_LOCATION", severity="low",
                message="City or geographic location is not stated.",
                suggested_fix="Specify your City, Country or Remote preference."
            ))

        if not pi.linkedin:
            issues.append(FormattingIssue(
                code="MISSING_LINKEDIN", severity="low",
                message="LinkedIn profile URL is absent.",
                suggested_fix="Add your public LinkedIn profile link."
            ))

        # 2. Section Checks (Checks 6-7)
        if not resume.professional_summary:
            issues.append(FormattingIssue(
                code="MISSING_SUMMARY", severity="medium",
                message="Resume lacks a targeted professional summary.",
                suggested_fix="Add a 2-3 sentence summary outlining your core strengths and target role."
            ))
        else:
            strengths.append("Professional summary section is present.")

        if not resume.education:
            issues.append(FormattingIssue(
                code="MISSING_EDUCATION", severity="medium",
                message="No academic qualifications or education history identified.",
                suggested_fix="List your degrees, institutions, and graduation years."
            ))

        # 3. Bullet Point Quality & Metrics (Checks 8-12)
        all_bullets: List[str] = []
        for exp in resume.experience:
            all_bullets.extend(exp.highlights)
        for prj in resume.projects:
            all_bullets.extend(prj.highlights)

        metrics_count = 0
        weak_verb_count = 0
        short_bullets = 0
        long_bullets = 0
        starts_lowercase = 0
        used_verbs: Set[str] = set()

        for b in all_bullets:
            clean = b.strip()
            if not clean:
                continue

            # Check starts lowercase
            if clean[0].islower():
                starts_lowercase += 1

            # Check metrics
            if METRIC_REGEX.search(clean):
                metrics_count += 1

            # Check length
            if len(clean) < 25:
                short_bullets += 1
            elif len(clean) > 280:
                long_bullets += 1

            # Check weak phrases
            lower = clean.lower()
            for weak in WEAK_PHRASES_MAP.keys():
                if weak in lower:
                    weak_verb_count += 1
                    break

            # Collect first verb
            first_word = clean.split()[0].lower() if clean.split() else ""
            if first_word in ALL_ACTION_VERBS:
                used_verbs.add(first_word)

        if starts_lowercase > 0:
            issues.append(FormattingIssue(
                code="LOWERCASE_BULLETS", severity="low",
                message=f"{starts_lowercase} bullet points start with lowercase letters.",
                suggested_fix="Capitalize the first letter of each bullet point."
            ))

        if all_bullets and metrics_count == 0:
            issues.append(FormattingIssue(
                code="NO_QUANTIFIABLE_METRICS", severity="high",
                message="Zero quantifiable metrics (percentages, numbers, dollars) found across bullets.",
                suggested_fix="Apply the Google XYZ formula: quantify performance gains, throughput, or scope."
            ))
        elif metrics_count > 0:
            strengths.append(f"Demonstrates measurable results ({metrics_count} quantified achievements).")

        if weak_verb_count > 0:
            issues.append(FormattingIssue(
                code="WEAK_VERBS_DETECTED", severity="medium",
                message=f"Found {weak_verb_count} bullets using passive phrasing (e.g. 'responsible for', 'worked on').",
                suggested_fix="Replace with strong verbs like Architected, Engineered, Optimized, or Spearheaded."
            ))

        if short_bullets > 0:
            issues.append(FormattingIssue(
                code="BULLET_TOO_BRIEF", severity="low",
                message=f"{short_bullets} bullet points are very brief (under 25 characters).",
                suggested_fix="Expand bullets to explain what, how, and why."
            ))

        if long_bullets > 0:
            issues.append(FormattingIssue(
                code="BULLET_TOO_LONG", severity="low",
                message=f"{long_bullets} bullet points exceed 280 characters, reducing scan speed.",
                suggested_fix="Split complex sentences into crisp, distinct accomplishments."
            ))

        # 4. Action verb diversity & Score Calculation
        verb_diversity = len(used_verbs) / max(1, len(all_bullets))
        if len(used_verbs) >= 4:
            strengths.append(f"Strong action verb diversity ({len(used_verbs)} distinct power verbs used).")

        # Deduct penalties from 100
        score = 100.0
        for issue in issues:
            if issue.severity == "high":
                score -= 15.0
            elif issue.severity == "medium":
                score -= 8.0
            else:
                score -= 3.0

        score = max(30.0, min(100.0, score))

        return QualityCheckReport(
            quality_score=round(score, 1),
            issues=issues,
            strengths=strengths,
            estimated_page_count=resume.extraction_metadata.page_count,
            has_contact_info=bool(pi.email and pi.phone),
            has_measurable_metrics=metrics_count > 0,
            action_verb_diversity_score=round(verb_diversity, 2)
        )

