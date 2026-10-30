import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "CareerOS AI Resume Intelligence Service"
    API_V1_STR: str = "/api/v1"
    AI_SERVICE_HOST: str = os.getenv("AI_SERVICE_HOST", "127.0.0.1")
    AI_SERVICE_PORT: int = int(os.getenv("AI_SERVICE_PORT", "8001"))
    INTERNAL_API_KEY: str = os.getenv("INTERNAL_API_KEY", "careeros_internal_ai_secret_key_2026")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
    MAX_FILE_SIZE_BYTES: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10")) * 1024 * 1024
    TEMP_STORAGE_DIR: str = os.getenv("TEMP_STORAGE_DIR", "/tmp/careeros_ai_processing")

    @property
    def service_name(self) -> str:
        return self.PROJECT_NAME
    
    @property
    def host(self) -> str:
        return self.AI_SERVICE_HOST

    @property
    def port(self) -> int:
        return self.AI_SERVICE_PORT

    @property
    def internal_api_key(self) -> str:
        return self.INTERNAL_API_KEY

settings = Settings()
