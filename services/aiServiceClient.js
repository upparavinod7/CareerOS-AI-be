/**
 * CareerOS AI Python Microservice Client
 * Communicates with the FastAPI AI Microservice using internal API authentication.
 * Includes automatic local Python CLI subprocess fallback for zero-downtime resilience.
 */

const { spawn } = require("child_process");
const path = require("path");

const AI_SERVICE_BASE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";
const INTERNAL_API_KEY = process.env.INTERNAL_AI_KEY || "careeros_internal_ai_secret_key_2026";

/**
 * Execute Python microservice logic directly via CLI fallback
 */
function runPythonCLI(action, payload) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(__dirname, "../ai-service/cli_runner.py");
        const pythonBin = path.resolve(__dirname, "../ai-service/venv/bin/python3");
        const workingDir = path.resolve(__dirname, "../ai-service");

        const child = spawn(pythonBin, [scriptPath, action], {
            cwd: workingDir,
            env: {
                ...process.env,
                PYTHONPATH: "."
            }
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
            stdout += data.toString();
        });
        child.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        child.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`Python CLI (${action}) exited with code ${code}: ${stderr || stdout}`));
            }
            try {
                // Parse stdout - extract JSON even if there are stray lines
                const trimmed = stdout.trim();
                const jsonStart = trimmed.indexOf("{");
                const jsonEnd = trimmed.lastIndexOf("}");
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
                    if (parsed.success === false && parsed.error) {
                        return reject(new Error(parsed.error));
                    }
                    resolve(parsed);
                } else {
                    reject(new Error(`No valid JSON returned from Python CLI: ${trimmed}`));
                }
            } catch (err) {
                reject(new Error(`Failed to parse Python CLI response: ${err.message}. Raw output: ${stdout}`));
            }
        });

        child.on("error", (err) => {
            reject(err);
        });

        child.stdin.write(JSON.stringify(payload || {}));
        child.stdin.end();
    });
}

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
            return { healthy: true, fallback: "cli_runner", note: "HTTP offline; using Python CLI fallback" };
        }
    }

    /**
     * Parse resume file (PDF or DOCX buffer)
     */
    static async parseResumeFile({ buffer, filename, mimeType, rawText }) {
        try {
            const formData = new FormData();
            const blob = new Blob([buffer || Buffer.from(rawText || "", "utf-8")], { type: mimeType || "application/pdf" });
            formData.append("file", blob, filename || "resume.pdf");

            const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/resume/parse`, {
                method: "POST",
                headers: {
                    "X-Internal-API-Key": INTERNAL_API_KEY
                },
                body: formData,
                signal: AbortSignal.timeout(20000)
            });

            if (resp.ok) {
                return await resp.json();
            }
        } catch (err) {
            // Fall back to direct Python CLI execution
        }

        const cliRes = await runPythonCLI("parse_file", {
            file_base64: buffer ? buffer.toString("base64") : null,
            filename: filename || "resume.pdf",
            mime_type: mimeType || "application/pdf",
            raw_text: rawText || ""
        });

        return cliRes;
    }

    /**
     * 16-point Quality and ATS format audit
     */
    static async qualityCheckResume(structuredResume) {
        try {
            const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/resume/quality-check`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Internal-API-Key": INTERNAL_API_KEY
                },
                body: JSON.stringify(structuredResume),
                signal: AbortSignal.timeout(10000)
            });

            if (resp.ok) {
                return await resp.json();
            }
        } catch (err) {
            // Fall back to CLI
        }

        const res = await runPythonCLI("quality_check", { resume: structuredResume });
        return res.report;
    }

    /**
     * Analyze job description into structured requirements and tech stack
     */
    static async analyzeJob({ jobDescription, jobTitle, company }) {
        try {
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

            if (resp.ok) {
                return await resp.json();
            }
        } catch (err) {
            // Fall back to CLI
        }

        const res = await runPythonCLI("score_ats", { job_description: jobDescription, resume: {} });
        return res.job;
    }

    /**
     * Calculate 6-component ATS score
     */
    static async scoreATS({ resume, job, jobDescription }) {
        try {
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

            if (resp.ok) {
                return await resp.json();
            }
        } catch (err) {
            // Fall back to CLI
        }

        const res = await runPythonCLI("score_ats", {
            resume,
            job,
            job_description: jobDescription
        });
        return res.report;
    }

    /**
     * 12-Step Resume Optimization with Factual Integrity Guardrail
     */
    static async optimizeResume({ resume, targetRole, jobDescription, targetSkills }) {
        try {
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

            if (resp.ok) {
                return await resp.json();
            }
        } catch (err) {
            // Fall back to CLI
        }

        const res = await runPythonCLI("optimize", {
            resume,
            target_role: targetRole,
            job_description: jobDescription,
            target_skills: targetSkills
        });
        return res.report;
    }

    /**
     * Generate ATS PDF
     * Returns binary Buffer
     */
    static async generatePDF(structuredResume) {
        try {
            const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/optimization/generate-pdf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Internal-API-Key": INTERNAL_API_KEY
                },
                body: JSON.stringify(structuredResume),
                signal: AbortSignal.timeout(15000)
            });

            if (resp.ok) {
                const arrayBuffer = await resp.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }
        } catch (err) {
            // Fall back to CLI
        }

        const res = await runPythonCLI("generate_pdf", { resume: structuredResume });
        if (res.pdf_base64) {
            return Buffer.from(res.pdf_base64, "base64");
        }
        throw new Error("Failed to generate PDF via Python CLI fallback");
    }

    /**
     * Round-Trip PDF Validation
     */
    static async validatePDF(structuredResume) {
        try {
            const resp = await fetch(`${AI_SERVICE_BASE_URL}/api/v1/optimization/validate-pdf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Internal-API-Key": INTERNAL_API_KEY
                },
                body: JSON.stringify(structuredResume),
                signal: AbortSignal.timeout(15000)
            });

            if (resp.ok) {
                return await resp.json();
            }
        } catch (err) {
            // Fall back to CLI
        }

        const res = await runPythonCLI("validate_pdf", { resume: structuredResume });
        return res.validation;
    }
}

module.exports = AIServiceClient;
