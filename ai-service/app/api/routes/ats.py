"""
ATS Compatibility Scoring Routes
Evaluates candidate compatibility against target job description across 6 weighted components.
"""

from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from app.core.security import verify_internal_api_key
from app.schemas.resume import StructuredResume
from app.schemas.job import StructuredJobDescription
from app.schemas.analysis import ATSCompatibilityReport
from app.services.job_analyzer import JobAnalyzer
from app.services.ats_scorer import ATSScorer

router = APIRouter(prefix="/ats", tags=["ATS"])

class ATSScoreRequest(BaseModel):
    resume: StructuredResume
    job: Optional[StructuredJobDescription] = None
    job_description: Optional[str] = None

@router.post("/score", response_model=ATSCompatibilityReport, dependencies=[Depends(verify_internal_api_key)])
async def score_ats(req: ATSScoreRequest):
    job_data = req.job
    if not job_data:
        if not req.job_description or not req.job_description.strip():
            raise HTTPException(status_code=400, detail="Must provide either structured job object or raw job description.")
        job_data = JobAnalyzer.analyze(req.job_description)
        
    report = ATSScorer.calculate_score(req.resume, job_data)
    return report

