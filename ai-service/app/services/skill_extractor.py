"""
Skill Extraction Service
Extracts, normalizes, categorizes, and determines evidence provenance for skills.
"""

import re
from typing import Dict, List, Set, Tuple, Any
from app.knowledge_base.taxonomy import SYNONYMS_MAP, CATEGORY_MAP, normalize_skill, get_skill_category
from app.schemas.resume import CategorizedSkills

class SkillEvidence:
    def __init__(self, canonical_name: str, category: str, evidence_type: str, context: str):
        self.canonical_name = canonical_name
        self.category = category
        self.evidence_type = evidence_type  # "explicit" | "work_experience" | "project" | "summary"
        self.context = context

class SkillExtractor:
    @classmethod
    def extract_from_text(cls, text: str, section_hint: str = "general") -> List[SkillEvidence]:
        """
        Scans text for known skills in SYNONYMS_MAP using word boundaries and returns list of SkillEvidence.
        """
        found_skills: Dict[str, SkillEvidence] = {}
        lower_text = text.lower()
        
        # Sort keys by length descending to match multi-word phrases first (e.g. 'google cloud platform' before 'cloud')
        sorted_synonyms = sorted(SYNONYMS_MAP.keys(), key=lambda x: len(x), reverse=True)
        
        for phrase in sorted_synonyms:
            # Pattern with boundary check (accounting for symbols like C++, C#, .js, etc.)
            escaped = re.escape(phrase)
            pattern = rf"(?<![a-zA-Z0-9_#+.]){escaped}(?![a-zA-Z0-9_#+.])"
            
            match = re.search(pattern, lower_text)
            if match:
                canonical = SYNONYMS_MAP[phrase]
                if canonical not in found_skills:
                    category = get_skill_category(canonical)
                    start = max(0, match.start() - 30)
                    end = min(len(text), match.end() + 30)
                    snippet = text[start:end].replace("\n", " ").strip()
                    
                    found_skills[canonical] = SkillEvidence(
                        canonical_name=canonical,
                        category=category,
                        evidence_type=section_hint,
                        context=snippet
                    )
                    
        return list(found_skills.values())

    @classmethod
    def categorize_skills(cls, skills_list: List[str]) -> CategorizedSkills:
        """
        Takes a list of raw or canonical skill strings, normalizes them, and builds a CategorizedSkills object.
        """
        result = CategorizedSkills()
        seen = set()
        
        for s in skills_list:
            canonical = normalize_skill(s)
            if canonical in seen:
                continue
            seen.add(canonical)
            
            cat = get_skill_category(canonical)
            if cat == "programming_languages":
                result.programming_languages.append(canonical)
            elif cat == "frameworks":
                result.frameworks.append(canonical)
            elif cat == "libraries":
                result.libraries.append(canonical)
            elif cat == "databases":
                result.databases.append(canonical)
            elif cat == "cloud_tools":
                result.cloud_tools.append(canonical)
            elif cat == "ai_ml_tools":
                result.ai_ml_tools.append(canonical)
            else:
                result.other.append(canonical)
                
        return result

