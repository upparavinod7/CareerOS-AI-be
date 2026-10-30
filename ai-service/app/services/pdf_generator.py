"""
ATS-Compliant PDF Generation Engine using ReportLab
Generates clean, single-column, ATS-parseable PDF resumes with selectable text and standard typography.
"""

import io
from typing import List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from app.schemas.resume import StructuredResume

class PDFGenerator:
    @classmethod
    def generate_pdf_bytes(cls, resume: StructuredResume) -> bytes:
        buffer = io.BytesIO()
        
        # 0.5 in margins = 36 pt
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Custom Clean Styles
        title_style = ParagraphStyle(
            'CandidateName',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0F172A")
        )
        
        contact_style = ParagraphStyle(
            'ContactLine',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569")
        )

        section_heading = ParagraphStyle(
            'SectionHeading',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#1E293B"),
            spaceBefore=8,
            spaceAfter=2,
            keepWithNext=True
        )

        item_title_style = ParagraphStyle(
            'ItemTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#0F172A")
        )

        item_subtitle_style = ParagraphStyle(
            'ItemSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#334155")
        )

        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            leading=13.5,
            textColor=colors.HexColor("#1E293B")
        )

        bullet_style = ParagraphStyle(
            'Bullet',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12.5,
            leftIndent=14,
            firstLineIndent=-10,
            textColor=colors.HexColor("#334155"),
            spaceAfter=2
        )

        story = []

        # 1. Header (Name & Contact)
        name = resume.personal_information.full_name or "Candidate Name"
        story.append(Paragraph(name, title_style))
        story.append(Spacer(1, 4))

        contact_parts = []
        if resume.personal_information.email:
            email = resume.personal_information.email
            contact_parts.append(f'<a href="mailto:{email}"><font color="#2563EB">{email}</font></a>')
        if resume.personal_information.phone:
            phone = resume.personal_information.phone
            contact_parts.append(phone)
        if resume.personal_information.location:
            contact_parts.append(resume.personal_information.location)
        if resume.personal_information.linkedin:
            link = resume.personal_information.linkedin
            contact_parts.append(f'<a href="{link}"><font color="#2563EB">LinkedIn</font></a>')
        if resume.personal_information.github:
            gh = resume.personal_information.github
            contact_parts.append(f'<a href="{gh}"><font color="#2563EB">GitHub</font></a>')

        contact_line = " &nbsp;|&nbsp; ".join(contact_parts)
        if contact_line:
            story.append(Paragraph(contact_line, contact_style))
        story.append(Spacer(1, 8))

        # Helper divider
        def add_section_divider(heading_text: str):
            story.append(Paragraph(heading_text.upper(), section_heading))
            story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#CBD5E1"), spaceAfter=5, spaceBefore=2))

        # 2. Professional Summary
        if resume.professional_summary:
            add_section_divider("Professional Summary")
            story.append(Paragraph(resume.professional_summary, body_style))
            story.append(Spacer(1, 6))

        # 3. Core Technical Skills
        skills = resume.skills
        skill_lines = []
        if skills.programming_languages:
            skill_lines.append(f"<b>Languages:</b> {', '.join(skills.programming_languages)}")
        if skills.frameworks:
            skill_lines.append(f"<b>Frameworks:</b> {', '.join(skills.frameworks)}")
        if skills.databases:
            skill_lines.append(f"<b>Databases:</b> {', '.join(skills.databases)}")
        if skills.cloud_tools:
            skill_lines.append(f"<b>Cloud & DevOps:</b> {', '.join(skills.cloud_tools)}")
        if skills.ai_ml_tools:
            skill_lines.append(f"<b>AI & ML:</b> {', '.join(skills.ai_ml_tools)}")
        if skills.other:
            skill_lines.append(f"<b>Other:</b> {', '.join(skills.other)}")

        if skill_lines:
            add_section_divider("Technical Skills")
            for sl in skill_lines:
                story.append(Paragraph(sl, body_style))
            story.append(Spacer(1, 6))

        # 4. Work Experience
        if resume.experience:
            add_section_divider("Work Experience")
            for exp in resume.experience:
                date_str = f" ({exp.start_date})" if exp.start_date else ""
                title_line = f"<b>{exp.title}</b> — {exp.company}{date_str}"
                story.append(Paragraph(title_line, item_title_style))
                for h in exp.highlights:
                    story.append(Paragraph(f"• &nbsp;{h}", bullet_style))
                story.append(Spacer(1, 4))
            story.append(Spacer(1, 2))

        # 5. Projects
        if resume.projects:
            add_section_divider("Projects")
            for prj in resume.projects:
                tech_str = f" [<i>{', '.join(prj.technologies)}</i>]" if prj.technologies else ""
                prj_header = f"<b>{prj.name}</b>{tech_str}"
                story.append(Paragraph(prj_header, item_title_style))
                if prj.description:
                    story.append(Paragraph(prj.description, body_style))
                for h in prj.highlights:
                    story.append(Paragraph(f"• &nbsp;{h}", bullet_style))
                story.append(Spacer(1, 4))
            story.append(Spacer(1, 2))

        # 6. Education
        if resume.education:
            add_section_divider("Education")
            for edu in resume.education:
                yr_str = f" ({edu.graduation_year})" if edu.graduation_year else ""
                edu_line = f"<b>{edu.degree}</b> in {edu.field} — {edu.institution}{yr_str}" if edu.field else f"<b>{edu.degree}</b> — {edu.institution}{yr_str}"
                story.append(Paragraph(edu_line, body_style))
            story.append(Spacer(1, 6))

        # 7. Certifications
        if resume.certifications:
            add_section_divider("Certifications")
            for cert in resume.certifications:
                story.append(Paragraph(f"• &nbsp;<b>{cert.name}</b> — {cert.issuer}", bullet_style))

        # Build document
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

