import asyncio
import pytest
import httpx
from app.main import app
from app.core.config import settings

def test_health_check():
    async def _run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/health")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "healthy"
    asyncio.run(_run())

def test_unauthorized_request_rejected():
    async def _run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.post("/api/v1/jobs/analyze", json={"job_description": "Software engineer needed"})
            assert resp.status_code in (401, 403)
    asyncio.run(_run())

def test_authorized_job_analysis():
    async def _run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.post(
                "/api/v1/jobs/analyze",
                headers={"X-Internal-API-Key": settings.INTERNAL_API_KEY},
                json={
                    "job_title": "Full Stack Engineer",
                    "job_description": "We need a Full Stack Engineer with React, Node.js, and MongoDB experience. 3+ years required."
                }
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["job_title"] == "Full Stack Engineer"
            assert "React" in data["technical_skills"]
            assert "Node.js" in data["technical_skills"]
            assert data["required_experience_years"] == 3.0
    asyncio.run(_run())
