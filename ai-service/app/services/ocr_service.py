"""
OCR Fallback Service
Extracts text from scanned image PDFs using OCR when standard extraction returns empty text.
"""

from typing import Dict, Any
import fitz

class OCRService:
    @staticmethod
    def extract_text(file_bytes: bytes) -> Dict[str, Any]:
        """
        Attempts OCR on scanned document pages using PyMuPDF get_textpage_ocr
        or basic image stream parsing.
        """
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            extracted_text = []
            
            for page in doc:
                try:
                    # PyMuPDF offers OCR textpage if Tesseract is installed in the system
                    tp = page.get_textpage_ocr(flags=0, dpi=150, full=True)
                    text = page.get_text(textpage=tp)
                    if text.strip():
                        extracted_text.append(text)
                except Exception:
                    # Fallback to standard text
                    extracted_text.append(page.get_text())
                    
            full_text = "\n".join(extracted_text).strip()
            return {
                "success": bool(full_text),
                "text": full_text,
                "engine": "pymupdf_ocr"
            }
        except Exception as e:
            return {
                "success": False,
                "text": "",
                "error": str(e),
                "engine": "none"
            }

