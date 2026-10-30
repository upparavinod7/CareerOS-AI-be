/**
 * CareerOS AI Python Microservice Client
 * Communicates with the FastAPI AI Microservice using internal API authentication.
 */

const AI_SERVICE_BASE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";
const INTERNAL_API_KEY = process.env.INTERNAL_AI_KEY || "careeros_internal_ai_secret_key_2026";

class AIServiceClient {
    static async healthCheck() {
        try {
            const resp = await fetch(`${AI_SERVICE_BASE_URL}/health`, {
                headers: { "X-Internal-API-Key": INTERNAL_API_KEY },
                signal: AbortSignal.timeout(3000)
            });
            if (!resp.ok) return { healthy: false, status: resp.status };
            const data = await resp.json();
            return { healthy: true, data };
        } catch (err) {
            return { healthy: false, error: err.message };
        }
    }

    /**
     * Parse resume file (PDF or DOCX buffer)
     */
    static async parseResumeFile({ buffer, filename, mimeType }) {
        const formData = new FormData();
        const blob = new Blob([buffer], { type: mimeType || "application/pdf" });
        formData.append("file", blob, filename || "resume.pdf");

        const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/resume/parse`, {
            method: "POST",
            headers: {
                "X-Internal-API-Key": INTERNAL_API_KEY
            },
            body: formData,
            signal: AbortSignal.timeout(20000)
        });

        if (!resp.ok) {
            const errorBody = await resp.json().catch(() => ({ detail: "Unknown AI microservice error" }));
            throw new Error(errorBody.detail || `AI microservice returned HTTP ${resp.status}`);
        }

        return await resp.json();
    }

    /**
     * 16-point Quality and ATS format audit
     */
    static async qualityCheckResume(structuredResume) {
        const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/resume/quality-check`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-API-Key": INTERNAL_API_KEY
            },
            body: JSON.stringify(structuredResume),
            signal: AbortSignal.timeout(10000)
        });

        if (!resp.ok) {
            const errorBody = await resp.json().catch(() => ({ detail: "Quality check failed" }));
            throw new Error(errorBody.detail || `HTTP ${resp.status}`);
        }

        return await resp.json();
    }

    /**
     * Analyze job description into structured requirements and tech stack
     */
    static async analyzeJob({ jobDescription, jobTitle, company }) {
        const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/jobs/analyze`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-API-Key": INTERNAL_API_KEY
            },
            body: JSON.stringify({
                job_description: jobDescription,
                job_title: jobTitle,
                company: company
            }),
            signal: AbortSignal.timeout(10000)
        });

        if (!resp.ok) {
            const errorBody = await resp.json().catch(() => ({ detail: "Job analysis failed" }));
            throw new Error(errorBody.detail || `HTTP ${resp.status}`);
        }

        return await resp.json();
    }

    /**
     * Calculate 6-component ATS score
     */
    static async scoreATS({ resume, job, jobDescription }) {
        const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/ats/score`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-API-Key": INTERNAL_API_KEY
            },
            body: JSON.stringify({
                resume,
                job,
                job_description: jobDescription
            }),
            signal: AbortSignal.timeout(15000)
        });

        if (!resp.ok) {
            const errorBody = await resp.json().catch(() => ({ detail: "ATS scoring failed" }));
            throw new Error(errorBody.detail || `HTTP ${resp.status}`);
        }

        return await resp.json();
    }

    /**
     * 12-Step Resume Optimization with Factual Integrity Guardrail
     */
    static async optimizeResume({ resume, targetRole, jobDescription, targetSkills }) {
        const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/optimization/optimize`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-API-Key": INTERNAL_API_KEY
            },
            body: JSON.stringify({
                resume,
                target_role: targetRole,
                job_description: jobDescription,
                target_skills: targetSkills
            }),
            signal: AbortSignal.timeout(25000)
        });

        if (!resp.ok) {
            const errorBody = await resp.json().catch(() => ({ detail: "Resume optimization failed" }));
            throw new Error(errorBody.detail || `HTTP ${resp.status}`);
        }

        return await resp.json();
    }

    /**
     * Generate ATS PDF
     * Returns binary Buffer
     */
    static async generatePDF(structuredResume) {
        const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/optimization/generate-pdf`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-API-Key": INTERNAL_API_KEY
            },
            body: JSON.stringify(structuredResume),
            signal: AbortSignal.timeout(15000)
        });

        if (!resp.ok) {
            throw new Error(`PDF generation failed with HTTP ${resp.status}`);
        }

        const arrayBuffer = await resp.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * Round-Trip PDF Validation
     */
    static async validatePDF(structuredResume) {
        const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/optimization/validate-pdf`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-API-Key": INTERNAL_API_KEY
            },
            body: JSON.stringify(structuredResume),
            signal: AbortSignal.timeout(15000)
        });

        if (!resp.ok) {
            const errorBody = await resp.json().catch(() => ({ detail: "PDF validation failed" }));
            throw new Error(errorBody.detail || `HTTP ${resp.status}`);
        }

        return await resp.json();
    }
}

module.exports = AIServiceClient;

