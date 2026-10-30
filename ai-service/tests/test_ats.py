import pytest
from app.services.resume_parser import ResumeParser
from app.services.job_analyzer import JobAnalyzer
from app.services.ats_scorer import ATSScorer
from tests.test_parser import SAMPLE_RESUME_TEXT

SAMPLE_JOB_TEXT = """
Job Title: Senior Backend Engineer
Company: Stripe

About the Role:
We are looking for a Senior Backend Engineer to join our Payments Infrastructure team.

Required Qualifications:
- 4+ years of professional backend software development experience.
- Strong proficiency in Python or Go, with solid knowledge of SQL.
- Deep expertise with Docker, Kubernetes, and AWS cloud services.
- Experience designing resilient microservices and distributed transactions.

Preferred Qualifications:
- Familiarity with Rust or Terraform.
- Prior experience in fintech or payment processing systems.

Responsibilities:
- Design and operate mission-critical payment processing APIs handling billions in volume.
- Collaborate with frontend engineers to build reliable SDKs and developer experiences.
"""

def test_job_analyzer():
    job = JobAnalyzer.analyze(SAMPLE_JOB_TEXT, job_title="Senior Backend Engineer", company="Stripe")
    assert job.job_title == "Senior Backend Engineer"
    assert job.company == "Stripe"
    assert "Python" in job.technical_skills
    assert "Docker" in job.technical_skills
    assert "Kubernetes" in job.technical_skills
    assert job.required_experience_years == 4.0
    assert len(job.mandatory_qualifications) > 0

def test_ats_scorer_components_and_weights():
    resume = ResumeParser.parse_raw_text(SAMPLE_RESUME_TEXT)
    job = JobAnalyzer.analyze(SAMPLE_JOB_TEXT)
    report = ATSScorer.calculate_score(resume, job)

    assert 0.0 <= report.overall_score <= 100.0
    assert report.components.required_skills > 0.0
    assert report.components.experience_relevance > 0.0
    assert report.components.keyword_coverage > 0.0
    assert report.components.project_relevance > 0.0
    assert report.components.education > 0.0
    assert report.components.formatting > 0.0

    # Skills check: Python, Docker, Kubernetes, AWS should be matched
    matched_lower = [m.lower() for m in report.matched_skills]
    assert "python" in matched_lower
    assert "docker" in matched_lower
    assert "kubernetes" in matched_lower
    
    # Missing skills should identify Rust or Go if not present in resume
    missing_lower = [m.lower() for m in report.missing_skills]
    assert "go" in missing_lower or "rust" in missing_lower

