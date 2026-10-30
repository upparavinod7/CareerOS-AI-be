from typing import List, Optional
from pydantic import BaseModel, Field

class RequirementItem(BaseModel):
    name: str
    category: str = "technical" # technical | experience | education | soft_skill | certification
    importance: str = "mandatory" # mandatory | preferred | optional
    context: str = ""

class StructuredJobDescription(BaseModel):
    job_title: str
    company: str = "Target Employer"
    mandatory_qualifications: List[str] = Field(default_factory=list)
    preferred_qualifications: List[str] = Field(default_factory=list)
    technical_skills: List[str] = Field(default_factory=list)
    programming_languages: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    required_experience_years: float = 0.0
    required_education: List[str] = Field(default_factory=list)
    responsibilities: List[str] = Field(default_factory=list)
    domain_knowledge: List[str] = Field(default_factory=list)
    soft_skills: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    classified_requirements: List[RequirementItem] = Field(default_factory=list)
    raw_text: str = ""

class JobAnalysisRequest(BaseModel):
    job_description: str
    job_title: Optional[str] = None
    company: Optional[str] = None

