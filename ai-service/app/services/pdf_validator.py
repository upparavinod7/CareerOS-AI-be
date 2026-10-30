"""
PDF Round-Trip Validator Service
Parses the generated PDF using PyMuPDF to verify text completeness,
detect multi-page overflow, and validate that critical sections are preserved.
"""

from typing import List, Dict, Any
import fitz
from app.schemas.resume import StructuredResume
from app.schemas.analysis import PDFValidationResult

class PDFValidator:
    @classmethod
    def validate_generated_pdf(cls, pdf_bytes: bytes, original_resume: StructuredResume) -> PDFValidationResult:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = len(doc)
        
        extracted_text = ""
        for page in doc:
            extracted_text += page.get_text("text") + "\n"

        lower_text = extracted_text.lower()
        sections_verified = []
        missing_sections = []
        warnings = []

        # Check Candidate Name
        name = original_resume.personal_information.full_name
        if name and name.lower() in lower_text:
            sections_verified.append("Candidate Name")
        elif name:
            missing_sections.append("Candidate Name")
            warnings.append("Candidate name not found in generated PDF text.")

        # Check Email
        email = original_resume.personal_information.email
        if email and email.lower() in lower_text:
            sections_verified.append("Email Address")
        elif email:
            missing_sections.append("Email Address")
            warnings.append("Contact email missing from PDF text.")

        # Check Skills
        if any(s.lower() in lower_text for s in original_resume.skills.programming_languages + original_resume.skills.frameworks):
            sections_verified.append("Technical Skills")
        else:
            if original_resume.skills.programming_languages or original_resume.skills.frameworks:
                missing_sections.append("Technical Skills")

        # Check Experience
        if original_resume.experience:
            if any(exp.company.lower() in lower_text for exp in original_resume.experience if exp.company):
                sections_verified.append("Work Experience")
            else:
                missing_sections.append("Work Experience")

        # Check Education
        if original_resume.education:
            if any(edu.institution.lower() in lower_text for edu in original_resume.education if edu.institution):
                sections_verified.append("Education")
            else:
                missing_sections.append("Education")

        # Check overflow
        text_overflow = page_count > 2
        if text_overflow:
            warnings.append(f"Resume generated spans {page_count} pages, which may be excessive for an ATS resume.")

        # Readability score
        readability = 100.0
        if missing_sections:
            readability -= (len(missing_sections) * 15.0)
        if text_overflow:
            readability -= 10.0
        readability = max(20.0, readability)

        is_valid = len(extracted_text.strip()) > 100 and len(missing_sections) == 0

        return PDFValidationResult(
            valid=is_valid,
            page_count=page_count,
            extracted_text_length=len(extracted_text.strip()),
            sections_verified=sections_verified,
            missing_sections=missing_sections,
            text_overflow_detected=text_overflow,
            readability_score=readability,
            warnings=warnings
        )

