from fastapi import Header, HTTPException, status
from app.core.config import settings

async def verify_internal_api_key(
    x_internal_api_key: str = Header(None)
):
    # If API key is configured, verify header matches
    expected = settings.internal_api_key
    if expected and x_internal_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid internal AI service API key."
        )
    return True

