"""
DOCX Parser Service using python-docx
Extracts text from paragraphs and tables in .docx documents.
"""

import io
from typing import Dict, Any, List
import docx

class DOCXParser:
    @staticmethod
    def extract_text_and_meta(file_bytes: bytes) -> Dict[str, Any]:
        doc_stream = io.BytesIO(file_bytes)
        doc = docx.Document(doc_stream)
        
        extracted_lines: List[str] = []
        
        # Paragraphs
        for p in doc.paragraphs:
            text = p.text.strip()
            if text:
                extracted_lines.append(text)
                
        # Tables
        for table in doc.tables:
            for row in table.rows:
                row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_cells:
                    extracted_lines.append(" | ".join(row_cells))
                    
        raw_text = "\n".join(extracted_lines).strip()
        
        core_props = doc.core_properties
        title = core_props.title if core_props and core_props.title else ""
        author = core_props.author if core_props and core_props.author else ""
        
        return {
            "raw_text": raw_text,
            "page_count": max(1, len(raw_text) // 2500), # approximation for docx
            "is_scanned": False,
            "author": author,
            "title": title
        }

