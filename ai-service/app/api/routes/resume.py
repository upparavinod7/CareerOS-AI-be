"""
Resume API Routes
Handles file parsing, text extraction, section segmentation, and quality audits.
"""

import time
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.core.security import verify_internal_api_key
from app.core.config import settings
from app.schemas.resume import StructuredResume, ResumeParseResponse
from app.schemas.analysis import QualityCheckReport
from app.services.pdf_parser import PDFParser
from app.services.docx_parser import DOCXParser
from app.services.ocr_service import OCRService
from app.services.resume_parser import ResumeParser
from app.services.quality_checker import QualityChecker

router = APIRouter(prefix="/resume", tags=["Resume"])

@router.post("/parse", response_model=ResumeParseResponse, dependencies=[Depends(verify_internal_api_key)])
async def parse_resume(file: UploadFile = File(...)):
    start_time = time.time()
    
    # Validation
    filename = file.filename or ""
    lower_fn = filename.lower()
    if not (lower_fn.endswith(".pdf") or lower_fn.endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")
        
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB.")
        
    # Extraction
    raw_text = ""
    page_count = 1
    is_scanned = False
    
    if lower_fn.endswith(".pdf"):
        pdf_res = PDFParser.extract_text_and_meta(content)
        raw_text = pdf_res["raw_text"]
        page_count = pdf_res["page_count"]
        is_scanned = pdf_res["is_scanned"]
        
        # Scanned PDF fallback
        if is_scanned or len(raw_text.strip()) < 40:
            ocr_res = OCRService.extract_text(content)
            if ocr_res["success"] and len(ocr_res["text"].strip()) > len(raw_text.strip()):
                raw_text = ocr_res["text"]
                is_scanned = True
    else:
        docx_res = DOCXParser.extract_text_and_meta(content)
        raw_text = docx_res["raw_text"]
        page_count = docx_res["page_count"]

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Unable to extract readable text from document. Ensure file is not corrupt or password-protected.")

    # Parse into structured resume
    structured_resume = ResumeParser.parse_raw_text(
        raw_text=raw_text,
        page_count=page_count,
        is_scanned=is_scanned
    )
    
    processing_ms = (time.time() - start_time) * 1000.0

    return ResumeParseResponse(
        success=True,
        data=structured_resume,
        raw_text=raw_text,
        processing_time_ms=round(processing_ms, 2)
    )

@router.post("/quality-check", response_model=QualityCheckReport, dependencies=[Depends(verify_internal_api_key)])
async def quality_check_resume(resume: StructuredResume):
    report = QualityChecker.audit(resume)
    return report

