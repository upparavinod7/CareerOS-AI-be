import pytest
from app.services.resume_parser import ResumeParser
from app.services.pdf_generator import PDFGenerator
from app.services.pdf_validator import PDFValidator
from tests.test_parser import SAMPLE_RESUME_TEXT

def test_pdf_generation_and_round_trip_validation():
    resume = ResumeParser.parse_raw_text(SAMPLE_RESUME_TEXT)
    pdf_bytes = PDFGenerator.generate_pdf_bytes(resume)

    # Valid PDF magic header
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 1000

    # Round trip validation
    val = PDFValidator.validate_generated_pdf(pdf_bytes, resume)
    assert val.valid is True
    assert val.page_count <= 2
    assert "Candidate Name" in val.sections_verified
    assert "Email Address" in val.sections_verified
    assert "Work Experience" in val.sections_verified
    assert val.readability_score >= 80.0

