"""
Resume Parser Service
Extracts contact info, splits sections, extracts work experience, projects, education,
certifications, and produces StructuredResume.
"""

import re
from typing import Dict, List, Any, Optional, Tuple
from app.schemas.resume import (
    StructuredResume, PersonalInformation, CategorizedSkills,
    WorkExperienceItem, ProjectItem, EducationItem, CertificationItem, ExtractionMetadata
)
from app.knowledge_base.documents import ATS_HEADINGS_STANDARD
from app.services.skill_extractor import SkillExtractor

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}")
LINKEDIN_REGEX = re.compile(r"(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)", re.IGNORECASE)
GITHUB_REGEX = re.compile(r"(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)", re.IGNORECASE)
PORTFOLIO_REGEX = re.compile(r"(?:https?:\/\/)?([a-zA-Z0-9-]+\.(?:com|org|io|dev|me|net)(?:\/[^\s]*)?)", re.IGNORECASE)

DATE_RANGE_REGEX = re.compile(
    r"((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}\/\d{4}|\d{4})\s*[-–—to]+\s*(?:Present|Current|Now|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}\/\d{4}|\d{4}))",
    re.IGNORECASE
)

class ResumeParser:
    @classmethod
    def parse_raw_text(cls, raw_text: str, page_count: int = 1, is_scanned: bool = False) -> StructuredResume:
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        
        # 1. Contact Info
        contact_info, remaining_lines = cls._extract_contact_info(lines, raw_text)
        
        # 2. Section Partitioning
        sections = cls._partition_sections(remaining_lines)
        
        # 3. Parse Sections
        summary = cls._parse_summary(sections.get("summary", []))
        skills_categorized = cls._parse_skills(sections.get("skills", []), raw_text)
        experience, internships = cls._parse_experience(sections.get("experience", []))
        projects = cls._parse_projects(sections.get("projects", []))
        education = cls._parse_education(sections.get("education", []))
        certifications = cls._parse_certifications(sections.get("certifications", []))
        achievements = cls._parse_achievements(sections.get("achievements", []))
        
        # 4. Metadata & Confidence
        detected_sections = list(sections.keys())
        confidence = cls._calculate_confidence(contact_info, detected_sections)
        warnings = []
        if not contact_info.email:
            warnings.append("No email address detected.")
        if not contact_info.phone:
            warnings.append("No phone number detected.")
        if len(experience) == 0 and len(projects) == 0:
            warnings.append("Neither work experience nor technical projects detected.")

        return StructuredResume(
            personal_information=contact_info,
            professional_summary=summary,
            skills=skills_categorized,
            experience=experience,
            internships=internships,
            projects=projects,
            education=education,
            certifications=certifications,
            achievements=achievements,
            extraction_metadata=ExtractionMetadata(
                confidence=confidence,
                page_count=page_count,
                detected_sections=detected_sections,
                is_scanned=is_scanned,
                warnings=warnings
            )
        )

    @classmethod
    def _extract_contact_info(cls, lines: List[str], full_text: str) -> Tuple[PersonalInformation, List[str]]:
        contact = PersonalInformation()
        
        # Full name is usually the first non-empty line
        if lines:
            first_line = lines[0]
            # Avoid picking a heading like "RESUME" or "CURRICULUM VITAE" as name
            if not re.search(r"resume|curriculum|cv|contact|profile", first_line, re.IGNORECASE):
                contact.full_name = first_line[:60].strip()
            elif len(lines) > 1:
                contact.full_name = lines[1][:60].strip()
                
        # Regex scans
        email_match = EMAIL_REGEX.search(full_text)
        if email_match:
            contact.email = email_match.group(0).strip()
            
        phone_match = PHONE_REGEX.search(full_text)
        if phone_match:
            contact.phone = phone_match.group(0).strip()
            
        linkedin_match = LINKEDIN_REGEX.search(full_text)
        if linkedin_match:
            contact.linkedin = f"https://linkedin.com/in/{linkedin_match.group(1)}"
            
        github_match = GITHUB_REGEX.search(full_text)
        if github_match:
            contact.github = f"https://github.com/github_match.group(1)" if not github_match.group(0).startswith("http") else github_match.group(0)

        # Location heuristic: search first 10 lines for City, ST or City, Country
        for line in lines[:10]:
            parts = [p.strip() for p in re.split(r"[|•]", line) if p.strip()]
            for p in parts:
                if re.search(r"^[A-Za-z\s]+,\s*([A-Za-z]{2,}|India|USA|UK|Canada|Germany)$", p):
                    if not any(kw in p.lower() for kw in ["database", "framework", "language", "skill", "technolog", "engineer", "resume", "summary", "@"]):
                        contact.location = p
                        break
            if contact.location:
                break

        return contact, lines

    @classmethod
    def _partition_sections(cls, lines: List[str]) -> Dict[str, List[str]]:
        sections: Dict[str, List[str]] = {}
        current_section = "summary"
        
        for line in lines:
            line_clean = line.strip().lower()
            detected_sec = None
            
            # Check against ATS standard headings
            for sec_key, aliases in ATS_HEADINGS_STANDARD.items():
                for alias in aliases:
                    if line_clean == alias or line_clean == f"{alias}:" or line_clean.startswith(f"{alias} -"):
                        detected_sec = sec_key
                        break
                if detected_sec:
                    break
                    
            if detected_sec:
                current_section = detected_sec
                if current_section not in sections:
                    sections[current_section] = []
            else:
                if current_section not in sections:
                    sections[current_section] = []
                sections[current_section].append(line)
                
        return sections

    @classmethod
    def _parse_summary(cls, lines: List[str]) -> str:
        # Filter out lines that look like candidate name or contact info
        content = [l for l in lines if "@" not in l and not PHONE_REGEX.search(l)]
        return " ".join(content).strip()

    @classmethod
    def _parse_skills(cls, lines: List[str], full_text: str) -> CategorizedSkills:
        text_block = "\n".join(lines)
        # If skills section has very few items, also scan entire text
        evidences = SkillExtractor.extract_from_text(text_block if len(lines) > 2 else full_text, section_hint="skills")
        skill_names = [e.canonical_name for e in evidences]
        
        # Also parse comma-separated skill lists explicitly written in lines
        for line in lines:
            parts = re.split(r"[,•|\t;]", line)
            for part in parts:
                clean_part = part.strip()
                if 2 <= len(clean_part) <= 30:
                    skill_names.append(clean_part)
                    
        return SkillExtractor.categorize_skills(skill_names)

    @classmethod
    def _parse_experience(cls, lines: List[str]) -> Tuple[List[WorkExperienceItem], List[WorkExperienceItem]]:
        experience: List[WorkExperienceItem] = []
        internships: List[WorkExperienceItem] = []
        
        current_item: Optional[WorkExperienceItem] = None
        
        for line in lines:
            date_match = DATE_RANGE_REGEX.search(line)
            
            # Check if this line is a standalone date range for an already open experience item
            if current_item and not current_item.start_date and len(current_item.highlights) == 0 and date_match:
                current_item.start_date = date_match.group(0)
                continue

            # Check if line looks like a job header: has title/company with pipe/dash, or uppercase
            is_new_job_header = False
            if ("|" in line or " - " in line) and len(line) < 100 and not line.strip().startswith(("-", "•", "*")):
                is_new_job_header = True
            elif date_match and not line.strip().startswith(("-", "•", "*")):
                is_new_job_header = True

            if is_new_job_header:
                if current_item and (current_item.title or current_item.company):
                    if "intern" in current_item.title.lower():
                        internships.append(current_item)
                    else:
                        experience.append(current_item)
                
                current_item = WorkExperienceItem()
                if date_match:
                    current_item.start_date = date_match.group(0)
                    line_clean = line.replace(date_match.group(0), "").strip()
                else:
                    line_clean = line.strip()

                # Parse Title | Company - Location
                parts = [p.strip() for p in re.split(r"[|]", line_clean) if p.strip()]
                if parts:
                    current_item.title = parts[0]
                if len(parts) > 1:
                    subparts = [sp.strip() for sp in re.split(r"[-–—]", parts[1]) if sp.strip()]
                    current_item.company = subparts[0] if subparts else parts[1]
                    if len(subparts) > 1:
                        current_item.location = subparts[1]
            else:
                if current_item:
                    # Clean bullet marker
                    bullet = re.sub(r"^[\s•\-*>]+\s*", "", line).strip()
                    if bullet:
                        current_item.highlights.append(bullet)
                        # Extract technologies mentioned in bullet
                        evidences = SkillExtractor.extract_from_text(bullet, section_hint="work_experience")
                        for ev in evidences:
                            if ev.canonical_name not in current_item.technologies_used:
                                current_item.technologies_used.append(ev.canonical_name)
                                
        if current_item and (current_item.title or current_item.company):
            if "intern" in current_item.title.lower():
                internships.append(current_item)
            else:
                experience.append(current_item)
                
        return experience, internships

    @classmethod
    def _parse_projects(cls, lines: List[str]) -> List[ProjectItem]:
        projects: List[ProjectItem] = []
        current_project: Optional[ProjectItem] = None
        
        for line in lines:
            # Check if line looks like a project header (e.g. "CareerOS AI | React, Node.js" or "Project Name - Link")
            is_header = False
            if ("|" in line or " - " in line or ":" in line) and len(line) < 80 and not line.strip().startswith(("-", "•", "*")):
                is_header = True
                
            if is_header:
                if current_project and current_project.name:
                    projects.append(current_project)
                current_project = ProjectItem()
                parts = [p.strip() for p in re.split(r"[|:]", line) if p.strip()]
                current_project.name = parts[0]
                if len(parts) > 1:
                    # Often technologies are listed after the pipe/colon
                    tech_evidences = SkillExtractor.extract_from_text(parts[1], section_hint="project")
                    current_project.technologies = [t.canonical_name for t in tech_evidences]
            else:
                if current_project:
                    bullet = re.sub(r"^[\s•\-*>]+\s*", "", line).strip()
                    if bullet:
                        current_project.highlights.append(bullet)
                        evidences = SkillExtractor.extract_from_text(bullet, section_hint="project")
                        for ev in evidences:
                            if ev.canonical_name not in current_project.technologies:
                                current_project.technologies.append(ev.canonical_name)
                                
        if current_project and current_project.name:
            projects.append(current_project)
            
        return projects

    @classmethod
    def _parse_education(cls, lines: List[str]) -> List[EducationItem]:
        education: List[EducationItem] = []
        current_edu: Optional[EducationItem] = None
        
        for line in lines:
            deg_match = re.search(r"(B\.Tech|B\.E\.|Bachelor|Master|M\.S\.|M\.Tech|Ph\.D|Associate|Diploma|High School|B\.Sc|BCA|MCA)", line, re.IGNORECASE)
            if deg_match:
                if current_edu and current_edu.degree:
                    education.append(current_edu)
                current_edu = EducationItem(degree=deg_match.group(0))
                # Rest of line might be field or institution
                parts = [p.strip() for p in re.split(r"[,|–—-]", line) if p.strip()]
                for p in parts:
                    if deg_match.group(0).lower() not in p.lower():
                        if not current_edu.field and any(kw in p.lower() for kw in ["computer", "engineering", "science", "information", "data"]):
                            current_edu.field = p
                        elif not current_edu.institution:
                            current_edu.institution = p
            elif current_edu:
                year_match = re.search(r"\b(19\d{2}|20\d{2})\b", line)
                if year_match and not current_edu.graduation_year:
                    current_edu.graduation_year = year_match.group(0)
                if not current_edu.institution and len(line) < 80:
                    current_edu.institution = line.strip()
                    
        if current_edu and current_edu.degree:
            education.append(current_edu)
            
        return education

    @classmethod
    def _parse_certifications(cls, lines: List[str]) -> List[CertificationItem]:
        certifications: List[CertificationItem] = []
        for line in lines:
            clean = re.sub(r"^[\s•\-*>]+\s*", "", line).strip()
            if clean and len(clean) > 3:
                parts = clean.split(" - ")
                name = parts[0]
                issuer = parts[1] if len(parts) > 1 else "Accredited Body"
                certifications.append(CertificationItem(name=name, issuer=issuer))
        return certifications

    @classmethod
    def _parse_achievements(cls, lines: List[str]) -> List[str]:
        achievements: List[str] = []
        for line in lines:
            clean = re.sub(r"^[\s•\-*>]+\s*", "", line).strip()
            if clean and len(clean) > 5:
                achievements.append(clean)
        return achievements

    @classmethod
    def _calculate_confidence(cls, contact: PersonalInformation, sections: List[str]) -> float:
        score = 0.0
        if contact.email:
            score += 0.25
        if contact.phone:
            score += 0.15
        if contact.full_name:
            score += 0.10
        if "skills" in sections:
            score += 0.15
        if "experience" in sections:
            score += 0.20
        if "education" in sections:
            score += 0.10
        if "projects" in sections:
            score += 0.05
        return round(min(1.0, score), 2)
