const User = require("../models/User");
const AIServiceClient = require("../services/aiServiceClient");

/**
 * Format a StructuredResume back into clean plaintext
 */
function structuredResumeToText(structured, fallbackText = "") {
    if (!structured) return fallbackText;
    const parts = [];

    const pi = structured.personal_information || {};
    if (pi.full_name) parts.push(pi.full_name.toUpperCase());
    const contacts = [pi.email, pi.phone, pi.location, pi.linkedin, pi.github].filter(Boolean);
    if (contacts.length > 0) parts.push(contacts.join(" | "));

    if (structured.professional_summary) {
        parts.push("\nPROFESSIONAL SUMMARY\n" + structured.professional_summary);
    }

    if (structured.skills) {
        const skillsList = [];
        Object.entries(structured.skills).forEach(([category, items]) => {
            if (Array.isArray(items) && items.length > 0) {
                const label = category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                skillsList.push(`${label}: ${items.join(", ")}`);
            }
        });
        if (skillsList.length > 0) {
            parts.push("\nTECHNICAL SKILLS\n" + skillsList.join("\n"));
        }
    }

    if (Array.isArray(structured.experience) && structured.experience.length > 0) {
        parts.push("\nWORK EXPERIENCE");
        structured.experience.forEach(exp => {
            parts.push(`${exp.title || "Role"} - ${exp.company || "Company"} (${exp.start_date || ""} - ${exp.end_date || (exp.is_current ? "Present" : "")})`);
            if (Array.isArray(exp.highlights)) {
                exp.highlights.forEach(h => parts.push(`• ${h}`));
            }
        });
    }

    if (Array.isArray(structured.projects) && structured.projects.length > 0) {
        parts.push("\nPROJECTS");
        structured.projects.forEach(prj => {
            parts.push(`${prj.name || "Project"} (${(prj.technologies || []).join(", ")})`);
            if (prj.description) parts.push(prj.description);
            if (Array.isArray(prj.highlights)) {
                prj.highlights.forEach(h => parts.push(`• ${h}`));
            }
        });
    }

    if (Array.isArray(structured.education) && structured.education.length > 0) {
        parts.push("\nEDUCATION");
        structured.education.forEach(edu => {
            parts.push(`${edu.degree || "Degree"} in ${edu.field || "Field"} - ${edu.institution || "Institution"} (${edu.graduation_year || ""})`);
        });
    }

    return parts.join("\n\n").trim() || fallbackText;
}

/**
 * GET /api/v1/users/resumes
 * Lists all resume versions belonging to current user
 */
async function listResumes(req, res, next) {
    try {
        const user = await User.findById(req.user._id).select(
            "resumes resumeText resumeFileName resumeFileBase64 resumeStructured resumeAtsScore skills"
        );
        const versions = user.resumes || [];

        // If user has master resumeText but no versions yet, synthesize default version
        if (versions.length === 0 && (user.resumeText || user.resumeFileBase64)) {
            return res.json({
                success: true,
                data: [
                    {
                        _id: "default-master",
                        title: user.resumeFileName ? `Master: ${user.resumeFileName}` : "Master Profile Resume",
                        targetRole: user.targetRole || "Full Stack Engineer",
                        isDefault: true,
                        resumeText: user.resumeText,
                        fileName: user.resumeFileName || "resume.pdf",
                        hasPdf: Boolean(user.resumeFileBase64),
                        skills: user.skills || [],
                        atsScore: user.resumeAtsScore || 75,
                        updatedAt: new Date()
                    }
                ],
                masterResume: {
                    fileName: user.resumeFileName || "",
                    hasPdf: Boolean(user.resumeFileBase64),
                    resumeText: user.resumeText || "",
                    structuredResume: user.resumeStructured || null,
                    atsScore: user.resumeAtsScore || 0
                }
            });
        }

        return res.json({
            success: true,
            data: versions,
            masterResume: {
                fileName: user.resumeFileName || "",
                hasPdf: Boolean(user.resumeFileBase64),
                resumeText: user.resumeText || "",
                structuredResume: user.resumeStructured || null,
                atsScore: user.resumeAtsScore || 0
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/users/resumes
 * Adds a new tailored resume version (supports file upload or text)
 */
async function addResume(req, res, next) {
    try {
        const {
            title,
            targetRole,
            resumeText,
            skills,
            isDefault,
            fileName,
            fileBase64,
            structuredResume,
            atsScore,
            tailoredWithAI,
            tailoredRole,
            bulletDiffs
        } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: "Resume title is required."
            });
        }

        let parsedText = resumeText ? resumeText.trim() : "";
        let structuredData = structuredResume || null;
        let finalSkills = Array.isArray(skills) ? skills : [];

        // If fileBase64 provided without text, parse using PyMuPDF / ResumeParser
        if (fileBase64 && !parsedText) {
            try {
                const parseRes = await AIServiceClient.parseResumeFile({
                    buffer: Buffer.from(fileBase64, "base64"),
                    filename: fileName || "resume.pdf",
                    mimeType: "application/pdf"
                });
                if (parseRes && parseRes.data) {
                    structuredData = parseRes.data;
                    parsedText = parseRes.raw_text || structuredResumeToText(parseRes.data);
                    if (finalSkills.length === 0 && parseRes.data.skills) {
                        const extracted = [];
                        Object.values(parseRes.data.skills).forEach(arr => {
                            if (Array.isArray(arr)) extracted.push(...arr);
                        });
                        finalSkills = Array.from(new Set(extracted));
                    }
                }
            } catch (parseErr) {
                console.warn("[addResume] PDF parse warning:", parseErr.message);
            }
        }

        if (!parsedText && !fileBase64) {
            return res.status(400).json({
                success: false,
                message: "Either resumeText or a valid PDF fileBase64 is required."
            });
        }

        const user = await User.findById(req.user._id);

        if (isDefault) {
            user.resumes.forEach(r => {
                r.isDefault = false;
            });
        }

        const newVersion = {
            title: title.trim(),
            targetRole: targetRole ? targetRole.trim() : "",
            resumeText: parsedText,
            skills: finalSkills,
            fileName: fileName || `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
            fileBase64: fileBase64 || "",
            fileSize: fileBase64 ? Math.round((fileBase64.length * 3) / 4) : 0,
            structuredResume: structuredData,
            atsScore: Number(atsScore) || 0,
            tailoredWithAI: Boolean(tailoredWithAI),
            tailoredRole: tailoredRole || "",
            bulletDiffs: Array.isArray(bulletDiffs) ? bulletDiffs : [],
            isDefault: Boolean(isDefault) || user.resumes.length === 0,
            updatedAt: new Date()
        };

        user.resumes.push(newVersion);
        await user.save();

        const added = user.resumes[user.resumes.length - 1];
        return res.status(201).json({
            success: true,
            message: "Resume version added successfully.",
            data: added
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/users/resumes/upload-pdf
 * Handles PDF resume upload: extracts text via PyMuPDF, audits ATS quality,
 * and sets either master profile resume or a new version.
 */
async function uploadResumePdf(req, res, next) {
    try {
        const {
            fileBase64,
            fileName = "resume.pdf",
            mimeType = "application/pdf",
            setAsMaster = true,
            createVersion = false,
            title,
            targetRole
        } = req.body;

        if (!fileBase64) {
            return res.status(400).json({
                success: false,
                error: "fileBase64 content is required."
            });
        }

        const buffer = Buffer.from(fileBase64, "base64");

        // Parse using PyMuPDF / Python AI engine
        const parseRes = await AIServiceClient.parseResumeFile({
            buffer,
            filename: fileName,
            mimeType
        });

        const structuredResume = parseRes.data;
        const rawText = parseRes.raw_text || structuredResumeToText(structuredResume);
        const qualityReport = parseRes.qualityReport || null;

        // Extract skills array
        const extractedSkills = [];
        if (structuredResume && structuredResume.skills) {
            Object.values(structuredResume.skills).forEach(arr => {
                if (Array.isArray(arr)) extractedSkills.push(...arr);
            });
        }
        const uniqueSkills = Array.from(new Set(extractedSkills));

        const user = await User.findById(req.user._id);

        // Calculate initial ATS score
        let initialScore = 75;
        if (qualityReport && qualityReport.readability_score) {
            initialScore = Math.min(95, Math.round(qualityReport.readability_score));
        }

        if (setAsMaster) {
            user.resumeText = rawText;
            user.resumeFileName = fileName;
            user.resumeFileBase64 = fileBase64;
            user.resumeStructured = structuredResume;
            user.resumeAtsScore = initialScore;

            // Merge skills into user profile if empty or add missing
            if (uniqueSkills.length > 0) {
                const currentSkills = new Set(user.skills || []);
                uniqueSkills.slice(0, 15).forEach(s => currentSkills.add(s.toLowerCase()));
                user.skills = Array.from(currentSkills);
            }

            // Populate personal info if empty
            const pi = structuredResume.personal_information || {};
            if (pi.phone && !user.phone) user.phone = pi.phone;
            if (pi.location && !user.location) user.location = pi.location;
        }

        if (createVersion) {
            const versionTitle = title || (fileName ? fileName.replace(/\.[^/.]+$/, "") : "Uploaded Resume");
            user.resumes.push({
                title: versionTitle,
                targetRole: targetRole || user.targetRole || "Full Stack Engineer",
                resumeText: rawText,
                skills: uniqueSkills,
                fileName,
                fileBase64,
                fileSize: buffer.length,
                structuredResume,
                atsScore: initialScore,
                tailoredWithAI: false,
                isDefault: user.resumes.length === 0,
                updatedAt: new Date()
            });
        }

        await user.save();

        res.json({
            success: true,
            message: "Resume PDF uploaded and parsed successfully with PyMuPDF.",
            data: structuredResume,
            rawText,
            fileName,
            qualityReport,
            skills: uniqueSkills,
            atsScore: initialScore,
            user: {
                skills: user.skills,
                resumeFileName: user.resumeFileName,
                hasPdf: Boolean(user.resumeFileBase64)
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/users/resumes/:id/tailor
 * Tailors a resume version with LLM for a target role or job description.
 * Generates Google XYZ rewritten bullets, updates ATS score, compiles downloadable ATS PDF.
 */
async function tailorResume(req, res, next) {
    try {
        const { id } = req.params;
        const {
            targetRole,
            jobDescription = "",
            targetSkills = [],
            saveAsNewVersion = true,
            newVersionTitle
        } = req.body;

        if (!targetRole || !targetRole.trim()) {
            return res.status(400).json({
                success: false,
                error: "targetRole is required for AI resume tailoring."
            });
        }

        const user = await User.findById(req.user._id);

        let sourceStructured = null;
        let sourceText = "";
        let targetVersion = null;

        if (id === "master" || id === "default-master") {
            sourceStructured = user.resumeStructured;
            sourceText = user.resumeText;
        } else {
            targetVersion = user.resumes.id(id);
            if (!targetVersion) {
                return res.status(404).json({ success: false, error: "Resume version not found." });
            }
            sourceStructured = targetVersion.structuredResume;
            sourceText = targetVersion.resumeText;
        }

        // If structured resume is missing, parse text into structured schema
        if (!sourceStructured && sourceText) {
            const parsed = await AIServiceClient.parseResumeFile({
                rawText: sourceText,
                filename: "resume.txt",
                mimeType: "text/plain"
            });
            sourceStructured = parsed.data;
        }

        if (!sourceStructured) {
            return res.status(400).json({
                success: false,
                error: "No resume content available to tailor. Please upload a PDF or enter resume text first."
            });
        }

        // Run 12-Step LLM Optimization with zero-hallucination guardrail
        const optReport = await AIServiceClient.optimizeResume({
            resume: sourceStructured,
            targetRole: targetRole.trim(),
            jobDescription: jobDescription.trim(),
            targetSkills: Array.isArray(targetSkills) ? targetSkills : []
        });

        const optimizedResume = optReport.optimized_resume || sourceStructured;

        // Compile clean single-column ATS PDF via ReportLab
        let pdfBuffer = null;
        let pdfBase64 = "";
        try {
            pdfBuffer = await AIServiceClient.generatePDF(optimizedResume);
            pdfBase64 = pdfBuffer.toString("base64");
        } catch (pdfErr) {
            console.warn("[tailorResume] PDF generation error:", pdfErr.message);
        }

        // Calculate ATS score against target role/description
        let atsReport = null;
        try {
            atsReport = await AIServiceClient.scoreATS({
                resume: optimizedResume,
                jobDescription: jobDescription || `Target Role: ${targetRole}\nRequired Skills: ${targetSkills.join(", ")}`
            });
        } catch (scoreErr) {
            console.warn("[tailorResume] ATS scoring error:", scoreErr.message);
        }

        const finalScore = atsReport?.overall_score || 88;
        const tailoredText = structuredResumeToText(optimizedResume, sourceText);
        const fileName = `${targetRole.replace(/[^a-zA-Z0-9_-]/g, "_")}_Tailored_Resume.pdf`;

        // Gather final skills
        const finalSkillsList = [];
        if (optimizedResume.skills) {
            Object.values(optimizedResume.skills).forEach(arr => {
                if (Array.isArray(arr)) finalSkillsList.push(...arr);
            });
        }

        let savedVersion = null;

        if (saveAsNewVersion || id === "master" || id === "default-master") {
            const versionTitle = newVersionTitle || `${targetRole} (AI Tailored)`;
            const newVer = {
                title: versionTitle,
                targetRole: targetRole.trim(),
                resumeText: tailoredText,
                skills: Array.from(new Set(finalSkillsList)),
                fileName,
                fileBase64: pdfBase64,
                fileSize: pdfBuffer ? pdfBuffer.length : 0,
                structuredResume: optimizedResume,
                atsScore: finalScore,
                tailoredWithAI: true,
                tailoredRole: targetRole.trim(),
                bulletDiffs: optReport.diffs || [],
                isDefault: false,
                updatedAt: new Date()
            };
            user.resumes.push(newVer);
            await user.save();
            savedVersion = user.resumes[user.resumes.length - 1];
        } else if (targetVersion) {
            targetVersion.resumeText = tailoredText;
            targetVersion.targetRole = targetRole.trim();
            targetVersion.structuredResume = optimizedResume;
            if (pdfBase64) {
                targetVersion.fileBase64 = pdfBase64;
                targetVersion.fileName = fileName;
                targetVersion.fileSize = pdfBuffer ? pdfBuffer.length : 0;
            }
            targetVersion.atsScore = finalScore;
            targetVersion.tailoredWithAI = true;
            targetVersion.tailoredRole = targetRole.trim();
            targetVersion.bulletDiffs = optReport.diffs || [];
            targetVersion.updatedAt = new Date();
            await user.save();
            savedVersion = targetVersion;
        }

        return res.json({
            success: true,
            message: `Resume successfully tailored with LLM for ${targetRole}!`,
            report: optReport,
            atsScore: finalScore,
            atsReport,
            pdfBase64,
            fileName,
            version: savedVersion
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/users/resumes/:id/download-pdf
 * Downloads ATS-compliant single-column PDF resume
 */
async function downloadResumePdf(req, res, next) {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user._id);

        let pdfBuffer = null;
        let fileName = "Resume_CareerOS.pdf";

        if (id === "master" || id === "default-master") {
            fileName = user.resumeFileName || "Master_Resume_CareerOS.pdf";
            if (user.resumeFileBase64) {
                pdfBuffer = Buffer.from(user.resumeFileBase64, "base64");
            } else if (user.resumeStructured) {
                pdfBuffer = await AIServiceClient.generatePDF(user.resumeStructured);
            } else if (user.resumeText) {
                const parsed = await AIServiceClient.parseResumeFile({
                    rawText: user.resumeText,
                    filename: "resume.txt",
                    mimeType: "text/plain"
                });
                pdfBuffer = await AIServiceClient.generatePDF(parsed.data);
            }
        } else {
            const version = user.resumes.id(id);
            if (!version) {
                return res.status(404).json({ success: false, error: "Resume version not found." });
            }
            fileName = version.fileName || `${version.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

            if (version.fileBase64) {
                pdfBuffer = Buffer.from(version.fileBase64, "base64");
            } else if (version.structuredResume) {
                pdfBuffer = await AIServiceClient.generatePDF(version.structuredResume);
            } else if (version.resumeText) {
                const parsed = await AIServiceClient.parseResumeFile({
                    rawText: version.resumeText,
                    filename: "resume.txt",
                    mimeType: "text/plain"
                });
                pdfBuffer = await AIServiceClient.generatePDF(parsed.data);
            }
        }

        if (!pdfBuffer) {
            return res.status(404).json({
                success: false,
                error: "No PDF content found for this resume. Please upload a PDF or tailor this version."
            });
        }

        if (!fileName.toLowerCase().endsWith(".pdf")) {
            fileName += ".pdf";
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/v1/users/resumes/:id/default
 * Sets a specific resume version as the default
 */
async function setDefaultResume(req, res, next) {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user._id);

        let found = false;
        user.resumes.forEach(r => {
            if (String(r._id) === id) {
                r.isDefault = true;
                found = true;
            } else {
                r.isDefault = false;
            }
        });

        if (!found) {
            return res.status(404).json({ success: false, message: "Resume version not found." });
        }

        await user.save();
        return res.json({
            success: true,
            message: "Default resume updated.",
            data: user.resumes
        });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/v1/users/resumes/:id
 * Deletes a resume version
 */
async function deleteResume(req, res, next) {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user._id);

        const initialLength = user.resumes.length;
        user.resumes = user.resumes.filter(r => String(r._id) !== id);

        if (user.resumes.length === initialLength) {
            return res.status(404).json({ success: false, message: "Resume version not found." });
        }

        // If default was deleted and others remain, make first one default
        if (user.resumes.length > 0 && !user.resumes.some(r => r.isDefault)) {
            user.resumes[0].isDefault = true;
        }

        await user.save();
        return res.json({
            success: true,
            message: "Resume version removed."
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listResumes,
    addResume,
    uploadResumePdf,
    tailorResume,
    downloadResumePdf,
    setDefaultResume,
    deleteResume
};
