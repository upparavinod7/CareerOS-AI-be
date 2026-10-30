"""
RAG Knowledge Retriever Service
Retrieves relevant bullet point rules, power verbs, and ATS guidelines
based on query context.
"""

from typing import List, Dict, Any
from app.knowledge_base.documents import RESUME_WRITING_RULES, ACTION_VERBS, WEAK_PHRASES_MAP
from app.services.embedding_service import EmbeddingService

class RAGService:
    @classmethod
    def retrieve_guidelines(cls, context_query: str, top_k: int = 2) -> List[Dict[str, str]]:
        scored = []
        for rule in RESUME_WRITING_RULES:
            sim = EmbeddingService.compute_similarity(context_query, rule["name"] + " " + rule["description"])
            scored.append((sim, rule))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:top_k]]

    @classmethod
    def get_suggested_action_verbs(cls, category: str = "engineering_and_dev") -> List[str]:
        return ACTION_VERBS.get(category, ACTION_VERBS["engineering_and_dev"])

    @classmethod
    def get_weak_phrase_replacement(cls, text: str) -> Dict[str, str]:
        found = {}
        lower = text.lower()
        for weak, strong in WEAK_PHRASES_MAP.items():
            if weak in lower:
                found[weak] = strong
        return found

