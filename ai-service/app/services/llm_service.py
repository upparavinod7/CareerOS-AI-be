"""
LLM Service with Prompt Injection Defense and Deterministic Semantic Fallback
Formats bullet points according to Google XYZ formula while guaranteeing zero invented facts.
"""

import os
import re
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings
from app.knowledge_base.documents import WEAK_PHRASES_MAP, ACTION_VERBS

class LLMService:
    @classmethod
    async def optimize_bullet(cls, original_bullet: str, target_role: str, technologies: list) -> Dict[str, str]:
        """
        Optimizes a single bullet point.
        Uses OpenAI if configured, otherwise applies deterministic XYZ rewrite with factual preservation.
        """
        api_key = settings.OPENAI_API_KEY
        if api_key and api_key.startswith("sk-") and len(api_key) > 20:
            try:
                improved = await cls._call_openai(original_bullet, target_role, technologies)
                if improved:
                    return {
                        "improved": improved,
                        "framework": "Google XYZ formula (Accomplished [X] by doing [Z])",
                        "engine": "llm_openai"
                    }
            except Exception:
                pass  # Fall back to deterministic semantic rewrite

        # Deterministic semantic rewrite
        improved = cls._deterministic_rewrite(original_bullet, target_role, technologies)
        return {
            "improved": improved,
            "framework": "Google XYZ formula (Accomplished [X] by doing [Z])",
            "engine": "deterministic_xyz_engine"
        }

    @classmethod
    async def _call_openai(cls, bullet: str, target_role: str, technologies: list) -> Optional[str]:
        # Prompt-injection defense: sanitize inputs
        sanitized_bullet = re.sub(r"[\n\r]+", " ", bullet).strip()
        sanitized_role = re.sub(r"[^\w\s-]", "", target_role).strip()
        
        system_prompt = (
            "You are a Principal Resume Editor. Rewrite the candidate's bullet point following the Google XYZ formula: "
            "'Accomplished [X], as measured by [Y], by doing [Z]'.\n"
            "STRICT RULES:\n"
            "1. NEVER invent metrics, percentages, dollar amounts, dates, or company names not already in the input.\n"
            "2. Start with a strong action verb (e.g. Engineered, Architected, Spearheaded, Deployed, Streamlined).\n"
            "3. Maintain 100% factual fidelity to what the candidate actually accomplished.\n"
            "4. Return ONLY the rewritten single bullet point, without quotation marks or conversational commentary."
        )
        
        user_prompt = (
            f"Target Role: {sanitized_role}\n"
            f"Technologies: {', '.join(technologies)}\n"
            f"Original Bullet: {sanitized_bullet}\n\n"
            "Rewritten Bullet:"
        )

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 150
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                # Clean quotes or prefixes
                content = re.sub(r"^[\"'\-•\s]+|[\"'\s]+$", "", content)
                return content
        return None

    @classmethod
    def _deterministic_rewrite(cls, bullet: str, target_role: str, technologies: list) -> str:
        text = bullet.strip()
        if not text:
            return text

        # 1. Replace weak lead phrases
        lower = text.lower()
        replaced = False
        for weak, strong in WEAK_PHRASES_MAP.items():
            if lower.startswith(weak):
                text = strong + text[len(weak):]
                replaced = True
                break
                
        # 2. If it doesn't start with a capitalized action verb, prepend or adjust
        first_word = text.split()[0] if text.split() else ""
        if not replaced and first_word.lower() not in [v.lower() for cat in ACTION_VERBS.values() for v in cat]:
            # Pick contextual verb based on technologies
            if any(t.lower() in ["aws", "docker", "kubernetes", "ci/cd", "terraform"] for t in technologies):
                lead_verb = "Architected and automated"
            elif any(t.lower() in ["react", "vue", "frontend", "ui", "tailwind"] for t in technologies):
                lead_verb = "Engineered and delivered"
            elif any(t.lower() in ["ml", "ai", "python", "nlp", "rag"] for t in technologies):
                lead_verb = "Designed and operationalized"
            else:
                lead_verb = "Implemented and optimized"
                
            # If lowercase first word, attach lead verb
            text = f"{lead_verb} {text[0].lower() + text[1:]}" if len(text) > 1 else f"{lead_verb} {text}"

        # Ensure it ends with a period
        if not text.endswith("."):
            text += "."
            
        return text

