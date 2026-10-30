"""
Embedding & Semantic Similarity Service
Calculates deterministic token and n-gram semantic similarity vectors
to compare resume content with job requirements.
"""

import math
import re
from typing import List, Dict, Set
import numpy as np

class EmbeddingService:
    @staticmethod
    def _tokenize_ngrams(text: str, n: int = 3) -> Dict[str, float]:
        """Creates character n-grams and token terms for robust fuzzy semantic matching."""
        clean = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
        words = clean.split()
        
        freqs: Dict[str, float] = {}
        for w in words:
            if len(w) > 2:
                freqs[w] = freqs.get(w, 0.0) + 1.0
                
        # Character n-grams for typo & stem tolerance
        for i in range(len(clean) - n + 1):
            ngram = clean[i:i+n]
            if not ngram.isspace():
                freqs[ngram] = freqs.get(ngram, 0.0) + 0.3
                
        # Normalize vector
        norm = math.sqrt(sum(v * v for v in freqs.values()))
        if norm > 0:
            for k in freqs:
                freqs[k] /= norm
        return freqs

    @classmethod
    def compute_similarity(cls, text_a: str, text_b: str) -> float:
        """
        Computes cosine similarity between two texts.
        Returns score between 0.0 and 1.0.
        """
        if not text_a or not text_b:
            return 0.0
            
        vec_a = cls._tokenize_ngrams(text_a)
        vec_b = cls._tokenize_ngrams(text_b)
        
        dot_product = sum(vec_a[k] * vec_b[k] for k in vec_a if k in vec_b)
        return float(np.clip(dot_product, 0.0, 1.0))

    @classmethod
    def compute_jaccard(cls, list_a: List[str], list_b: List[str]) -> float:
        """Computes Jaccard index between two sets of string tokens."""
        set_a = {s.strip().lower() for s in list_a if s.strip()}
        set_b = {s.strip().lower() for s in list_b if s.strip()}
        if not set_a or not set_b:
            return 0.0
        intersection = len(set_a.intersection(set_b))
        union = len(set_a.union(set_b))
        return float(intersection / union) if union > 0 else 0.0

