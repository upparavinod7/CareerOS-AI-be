"""
PDF Parser Service using PyMuPDF (fitz)
Extracts raw text, detects layout, and identifies scanned documents.
"""

from typing import Tuple, Dict, Any, List
import fitz  # PyMuPDF

class PDFParser:
    @staticmethod
    def extract_text_and_meta(file_bytes: bytes) -> Dict[str, Any]:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_count = len(doc)
        full_text_pages: List[str] = []
        has_images = False
        
        for page_idx in range(page_count):
            page = doc[page_idx]
            text = page.get_text("text")
            full_text_pages.append(text)
            
            if not has_images and len(page.get_images()) > 0:
                has_images = True
                
        raw_text = "\n".join(full_text_pages).strip()
        
        # Scanned PDF detection: very little or no extracted text despite containing images
        is_scanned = False
        if len(raw_text) < 60 and (has_images or page_count > 0):
            is_scanned = True

        metadata = doc.metadata or {}
        
        return {
            "raw_text": raw_text,
            "page_count": page_count,
            "is_scanned": is_scanned,
            "has_images": has_images,
            "author": metadata.get("author", ""),
            "title": metadata.get("title", ""),
            "producer": metadata.get("producer", "")
        }

