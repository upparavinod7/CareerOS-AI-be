"""
CareerOS AI Microservice CLI Runner
Provides a direct, resilient subprocess bridge between Node.js Express and the Python AI services.
Enables offline, local execution of PyMuPDF parsing, ATS scoring, LLM tailoring, and PDF compilation.
"""

import sys
import os
import json
import base64
import time
import asyncio
import warnings

# Suppress library warnings so stdout contains pure JSON
warnings.filterwarnings("ignore")

from app.schemas.resume import StructuredResume
from app.schemas.job import StructuredJobDescription
from app.services.pdf_parser import PDFParser
from app.services.docx_parser import DOCXParser
from app.services.resume_parser import ResumeParser
from app.services.quality_checker import QualityChecker
from app.services.job_analyzer import JobAnalyzer
from app.services.ats_scorer import ATSScorer
from app.services.resume_optimizer import ResumeOptimizer
from app.services.pdf_generator import PDFGenerator
from app.services.pdf_validator import PDFValidator


async def handle_parse_file(payload):
    start = time.time()
    file_base64 = payload.get("file_base64")
    filename = payload.get("filename", "resume.pdf")
    mime_type = payload.get("mime_type", "application/pdf")
    raw_text = payload.get("raw_text", "")

    extracted_text = ""
    metadata = {}
    page_count = 1
    is_scanned = False

    if file_base64:
        content_bytes = base64.b64decode(file_base64)
        lower_name = filename.lower()
        if lower_name.endswith(".pdf") or "pdf" in mime_type:
            meta_res = PDFParser.extract_text_and_meta(content_bytes)
            extracted_text = meta_res.get("raw_text", "")
            page_count = meta_res.get("page_count", 1)
            is_scanned = meta_res.get("is_scanned", False)
            metadata = meta_res
        elif lower_name.endswith(".docx") or "officedocument" in mime_type:
            meta_res = DOCXParser.extract_text_and_meta(content_bytes)
            extracted_text = meta_res.get("raw_text", "")
            page_count = meta_res.get("page_count", 1)
            metadata = meta_res
        else:
            extracted_text = content_bytes.decode("utf-8", errors="ignore")
    elif raw_text:
        extracted_text = raw_text

    structured_resume = ResumeParser.parse_raw_text(extracted_text, page_count=page_count, is_scanned=is_scanned)
    quality_report = QualityChecker.audit(structured_resume)
    elapsed = int((time.time() - start) * 1000)

    return {
        "success": True,
        "data": structured_resume.dict(),
        "raw_text": extracted_text,
        "quality_report": quality_report.dict(),
        "processing_time_ms": elapsed
    }


def handle_quality_check(payload):
    resume_dict = payload.get("resume", {})
    resume = StructuredResume(**resume_dict)
    report = QualityChecker.audit(resume)
    return {
        "success": True,
        "report": report.dict()
    }


def handle_score_ats(payload):
    resume_dict = payload.get("resume", {})
    resume = StructuredResume(**resume_dict)

    job_dict = payload.get("job")
    job_description = payload.get("job_description", "")
    job_title = payload.get("job_title", "")

    if job_dict:
        job = StructuredJobDescription(**job_dict)
    else:
        job = JobAnalyzer.analyze(job_description, job_title=job_title)

    score_report = ATSScorer.calculate_score(resume, job)
    return {
        "success": True,
        "report": score_report.dict(),
        "job": job.dict()
    }


async def handle_optimize(payload):
    resume_dict = payload.get("resume", {})
    resume = StructuredResume(**resume_dict)
    target_role = payload.get("target_role", "Software Engineer")
    job_description = payload.get("job_description", "")
    target_skills = payload.get("target_skills", [])

    report = await ResumeOptimizer.optimize(
        resume=resume,
        target_role=target_role,
        job_description=job_description,
        target_skills=target_skills
    )
    return {
        "success": True,
        "report": report.dict()
    }


def handle_generate_pdf(payload):
    resume_dict = payload.get("resume", {})
    resume = StructuredResume(**resume_dict)
    pdf_bytes = PDFGenerator.generate_pdf_bytes(resume)
    b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    return {
        "success": True,
        "pdf_base64": b64,
        "length": len(pdf_bytes)
    }


def handle_validate_pdf(payload):
    resume_dict = payload.get("resume", {})
    resume = StructuredResume(**resume_dict)
    pdf_bytes = PDFGenerator.generate_pdf_bytes(resume)
    validation = PDFValidator.validate_generated_pdf(pdf_bytes, resume)
    return {
        "success": True,
        "validation": validation.dict()
    }


async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Action required"}))
        sys.exit(1)

    action = sys.argv[1]

    # Read payload from stdin
    try:
        raw_input = sys.stdin.read()
        payload = json.loads(raw_input) if raw_input.strip() else {}
    except Exception as e:
        print(json.dumps({"success": False, "error": f"JSON parse error: {str(e)}"}))
        sys.exit(1)

    try:
        if action == "parse_file":
            result = await handle_parse_file(payload)
        elif action == "quality_check":
            result = handle_quality_check(payload)
        elif action == "score_ats":
            result = handle_score_ats(payload)
        elif action == "optimize":
            result = await handle_optimize(payload)
        elif action == "generate_pdf":
            result = handle_generate_pdf(payload)
        elif action == "validate_pdf":
            result = handle_validate_pdf(payload)
        else:
            result = {"success": False, "error": f"Unknown action: {action}"}
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
