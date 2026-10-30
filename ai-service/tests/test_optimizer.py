import asyncio
import pytest
from app.services.resume_parser import ResumeParser
from app.services.resume_optimizer import ResumeOptimizer
from tests.test_parser import SAMPLE_RESUME_TEXT

def test_resume_optimizer_diffs_and_guardrail():
    resume = ResumeParser.parse_raw_text(SAMPLE_RESUME_TEXT)
    report = asyncio.run(ResumeOptimizer.optimize(
        resume=resume,
        target_role="Staff Distributed Systems Engineer",
        target_skills=["Kubernetes", "AWS", "Python", "Go"]
    ))

    assert report.falsification_guardrail_passed is True
    assert len(report.diffs) > 0

    # Ensure every diff has original, improved, and provenance evidence
    for diff in report.diffs:
        assert diff.original_text
        assert diff.improved_text
        assert diff.provenance_evidence
        assert "Google XYZ" in diff.rag_framework_applied or "Executive Hook" in diff.rag_framework_applied

def test_hallucination_checker_catches_unauthorized_numbers():
    orig = "Worked on microservices architecture with Node.js and Redis."
    fake_improved = "Engineered microservices reducing latency by 75% and saving $100000."
    
    is_hallucination = ResumeOptimizer._check_hallucination(orig, fake_improved)
    assert is_hallucination is True

    valid_improved = "Engineered microservices architecture utilizing Node.js and Redis for resilient caching."
    is_valid = ResumeOptimizer._check_hallucination(orig, valid_improved)
    assert is_valid is False
