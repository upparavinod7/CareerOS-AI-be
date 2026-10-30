from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class PersonalInformation(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""

class CategorizedSkills(BaseModel):
    programming_languages: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    libraries: List[str] = Field(default_factory=list)
    databases: List[str] = Field(default_factory=list)
    cloud_tools: List[str] = Field(default_factory=list)
    ai_ml_tools: List[str] = Field(default_factory=list)
    other: List[str] = Field(default_factory=list)

class WorkExperienceItem(BaseModel):
    title: str = ""
    company: str = ""
    location: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    is_current: bool = False
    highlights: List[str] = Field(default_factory=list)
    technologies_used: List[str] = Field(default_factory=list)

class ProjectItem(BaseModel):
    name: str = ""
    description: str = ""
    role: Optional[str] = ""
    technologies: List[str] = Field(default_factory=list)
    link: Optional[str] = ""
    highlights: List[str] = Field(default_factory=list)

class EducationItem(BaseModel):
    degree: str = ""
    field: str = ""
    institution: str = ""
    graduation_year: Optional[str] = ""
    gpa_or_grade: Optional[str] = ""

class CertificationItem(BaseModel):
    name: str = ""
    issuer: str = ""
    date_obtained: Optional[str] = ""
    credential_url: Optional[str] = ""

class ExtractionMetadata(BaseModel):
    confidence: float = 0.0
    page_count: int = 1
    detected_sections: List[str] = Field(default_factory=list)
    is_scanned: bool = False
    warnings: List[str] = Field(default_factory=list)

class StructuredResume(BaseModel):
    personal_information: PersonalInformation = Field(default_factory=PersonalInformation)
    professional_summary: str = ""
    skills: CategorizedSkills = Field(default_factory=CategorizedSkills)
    experience: List[WorkExperienceItem] = Field(default_factory=list)
    internships: List[WorkExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    certifications: List[CertificationItem] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    extraction_metadata: ExtractionMetadata = Field(default_factory=ExtractionMetadata)

class ResumeParseResponse(BaseModel):
    success: bool
    data: StructuredResume
    raw_text: str = ""
    processing_time_ms: float = 0.0

