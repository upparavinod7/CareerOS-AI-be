from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from app.schemas.resume import StructuredResume

class ATSScoreComponents(BaseModel):
    required_skills: float = 0.0      # 30% weight
    experience_relevance: float = 0.0 # 20% weight
    keyword_coverage: float = 0.0     # 15% weight
    project_relevance: float = 0.0    # 15% weight
    education: float = 0.0            # 10% weight
    formatting: float = 0.0           # 10% weight

class ATSCompatibilityReport(BaseModel):
    overall_score: float = 0.0
    score_type: str = "careerOS_job_compatibility"
    components: ATSScoreComponents = Field(default_factory=ATSScoreComponents)
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    partially_matched_skills: List[str] = Field(default_factory=list)
    keyword_suggestions: List[str] = Field(default_factory=list)
    formatting_issues: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    disclaimer: str = "This score reflects CareerOS AI deterministic compatibility analysis, not a vendor ATS guarantee."

class FormattingIssue(BaseModel):
    code: str
    severity: str # high | medium | low
    message: str
    suggested_fix: str

class QualityCheckReport(BaseModel):
    quality_score: float = 0.0
    issues: List[FormattingIssue] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    estimated_page_count: int = 1
    has_contact_info: bool = True
    has_measurable_metrics: bool = True
    action_verb_diversity_score: float = 0.0

class OptimizedBulletDiff(BaseModel):
    id: str
    section: str # summary | experience | project
    original_text: str
    improved_text: str
    provenance_evidence: str
    rag_framework_applied: str # e.g. "Google XYZ formula (Accomplished [X] by doing [Z])"
    accepted: bool = False

class OptimizationReport(BaseModel):
    original_resume: StructuredResume
    optimized_resume: StructuredResume
    diffs: List[OptimizedBulletDiff] = Field(default_factory=list)
    summary_improvement: str = ""
    target_role: str = ""
    falsification_guardrail_passed: bool = True
    unsupported_claims_rejected: int = 0

class PDFValidationResult(BaseModel):
    valid: bool
    page_count: int
    extracted_text_length: int
    sections_verified: List[str] = Field(default_factory=list)
    missing_sections: List[str] = Field(default_factory=list)
    text_overflow_detected: bool = False
    readability_score: float = 100.0
    warnings: List[str] = Field(default_factory=list)

