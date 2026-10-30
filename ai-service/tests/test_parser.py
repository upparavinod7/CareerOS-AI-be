import pytest
from app.services.resume_parser import ResumeParser
from app.services.skill_extractor import SkillExtractor
from app.services.quality_checker import QualityChecker

SAMPLE_RESUME_TEXT = """
Alex Morgan
alex.morgan@example.com | +1 (555) 234-5678 | San Francisco, CA
https://linkedin.com/in/alexmorgan | https://github.com/alexmorgan

PROFESSIONAL SUMMARY
Senior Full Stack Engineer with 5+ years of experience architecting distributed cloud systems and high-throughput web applications using React, Node.js, and AWS.

TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python, SQL, HTML5, CSS3
Frameworks: React, Node.js, Express.js, FastAPI, Next.js, Tailwind CSS
Databases: PostgreSQL, MongoDB, Redis
Cloud & DevOps: Docker, Kubernetes, AWS, CI/CD, GitHub Actions

WORK EXPERIENCE
Senior Software Engineer | TechCorp Inc - San Francisco, CA
Jan 2022 - Present
• Architected event-driven microservices architecture using Node.js and AWS SQS, handling 2.5M daily requests.
• Spearheaded migration from monolithic REST API to GraphQL federation, reducing client latency by 35%.
• Mentored 6 junior engineers and standardized CI/CD pipelines using GitHub Actions.

Software Developer | CloudSolutions LLC - Seattle, WA
Jun 2019 - Dec 2021
• Developed customer dashboard in React and Tailwind CSS, increasing user retention by 20%.
• Optimized PostgreSQL query execution plans, reducing database CPU load by 40%.

PROJECTS
CareerOS Platform | React, FastAPI, Docker
• Built real-time job application tracking platform with automated status synchronizer.
• Implemented OAuth 2.0 authentication and end-to-end encrypted profile storage.

EDUCATION
Bachelor of Science in Computer Science
University of California, Berkeley (2019)
GPA: 3.8/4.0

CERTIFICATIONS
• AWS Certified Solutions Architect - Amazon Web Services
"""

def test_resume_parser_extracts_contact_info():
    parsed = ResumeParser.parse_raw_text(SAMPLE_RESUME_TEXT)
    assert parsed.personal_information.full_name == "Alex Morgan"
    assert parsed.personal_information.email == "alex.morgan@example.com"
    assert parsed.personal_information.phone == "+1 (555) 234-5678"
    assert "San Francisco" in parsed.personal_information.location
    assert "alexmorgan" in parsed.personal_information.linkedin
    assert "alexmorgan" in parsed.personal_information.github

def test_resume_parser_extracts_skills_and_categories():
    parsed = ResumeParser.parse_raw_text(SAMPLE_RESUME_TEXT)
    skills = parsed.skills
    assert "JavaScript" in skills.programming_languages
    assert "Python" in skills.programming_languages
    assert "React" in skills.frameworks
    assert "Node.js" in skills.frameworks
    assert "PostgreSQL" in skills.databases
    assert "Docker" in skills.cloud_tools

def test_resume_parser_extracts_experience_and_projects():
    parsed = ResumeParser.parse_raw_text(SAMPLE_RESUME_TEXT)
    assert len(parsed.experience) >= 2
    assert "TechCorp" in parsed.experience[0].company or "Senior Software Engineer" in parsed.experience[0].title
    assert len(parsed.experience[0].highlights) >= 2
    assert len(parsed.projects) >= 1
    assert "CareerOS" in parsed.projects[0].name

def test_quality_checker_audit():
    parsed = ResumeParser.parse_raw_text(SAMPLE_RESUME_TEXT)
    report = QualityChecker.audit(parsed)
    assert report.quality_score >= 80.0
    assert report.has_contact_info is True
    assert report.has_measurable_metrics is True
    assert len(report.strengths) >= 2

