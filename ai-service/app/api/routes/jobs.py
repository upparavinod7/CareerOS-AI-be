"""
Job Analysis API Routes
Extracts qualifications, required experience, and tech stack from job postings.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.core.security import verify_internal_api_key
from app.schemas.job import JobAnalysisRequest, StructuredJobDescription
from app.services.job_analyzer import JobAnalyzer

router = APIRouter(prefix="/jobs", tags=["Jobs"])

@router.post("/analyze", response_model=StructuredJobDescription, dependencies=[Depends(verify_internal_api_key)])
async def analyze_job(request: JobAnalysisRequest):
    if not request.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description text cannot be empty.")
        
    analysis = JobAnalyzer.analyze(
        text=request.job_description,
        job_title=request.job_title,
        company=request.company
    )
    return analysis

