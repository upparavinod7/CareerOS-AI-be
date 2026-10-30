"""
Resume Optimization and PDF Generation Routes
Optimizes resume bullets with zero hallucination guardrail, generates ATS PDF, and performs round-trip validation.
"""

from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, Response
from app.core.security import verify_internal_api_key
from app.schemas.resume import StructuredResume
from app.schemas.analysis import OptimizationReport, PDFValidationResult
from app.services.resume_optimizer import ResumeOptimizer
from app.services.pdf_generator import PDFGenerator
from app.services.pdf_validator import PDFValidator

router = APIRouter(prefix="/optimization", tags=["Optimization"])

class OptimizeRequest(BaseModel):
    resume: StructuredResume
    target_role: str
    job_description: Optional[str] = ""
    target_skills: Optional[List[str]] = None

@router.post("/optimize", response_model=OptimizationReport, dependencies=[Depends(verify_internal_api_key)])
async def optimize_resume(req: OptimizeRequest):
    if not req.target_role.strip():
        raise HTTPException(status_code=400, detail="Target role cannot be empty.")
        
    report = await ResumeOptimizer.optimize(
        resume=req.resume,
        target_role=req.target_role,
        job_description=req.job_description or "",
        target_skills=req.target_skills or []
    )
    return report

@router.post("/generate-pdf", dependencies=[Depends(verify_internal_api_key)])
async def generate_pdf(resume: StructuredResume):
    pdf_bytes = PDFGenerator.generate_pdf_bytes(resume)
    filename = f"{resume.personal_information.full_name or 'Resume'}_CareerOS.pdf".replace(" ", "_")
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.post("/validate-pdf", response_model=PDFValidationResult, dependencies=[Depends(verify_internal_api_key)])
async def validate_pdf(resume: StructuredResume):
    pdf_bytes = PDFGenerator.generate_pdf_bytes(resume)
    validation = PDFValidator.validate_generated_pdf(pdf_bytes, resume)
    return validation

