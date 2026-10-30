const User = require("../models/User");

/**
 * GET /api/v1/users/resumes
 * Lists all resume versions belonging to current user
 */
async function listResumes(req, res, next) {
    try {
        const user = await User.findById(req.user._id).select("resumes resumeText");
        const versions = user.resumes || [];

        // If user has master resumeText but no versions yet, synthesize default version
        if (versions.length === 0 && user.resumeText) {
            return res.json({
                success: true,
                data: [
                    {
                        _id: "default-master",
                        title: "Master Profile Resume",
                        targetRole: "Full Stack Engineer",
                        isDefault: true,
                        resumeText: user.resumeText,
                        skills: user.skills || [],
                        updatedAt: new Date()
                    }
                ]
            });
        }

        return res.json({
            success: true,
            data: versions
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/users/resumes
 * Adds a new tailored resume version
 */
async function addResume(req, res, next) {
    try {
        const { title, targetRole, resumeText, skills, isDefault } = req.body;
        if (!title || !resumeText) {
            return res.status(400).json({
                success: false,
                message: "Title and resumeText are required."
            });
        }

        const user = await User.findById(req.user._id);

        // If setting as default, clear default from existing versions
        if (isDefault) {
            user.resumes.forEach(r => {
                r.isDefault = false;
            });
        }

        const newVersion = {
            title: title.trim(),
            targetRole: targetRole ? targetRole.trim() : "",
            resumeText: resumeText.trim(),
            skills: Array.isArray(skills) ? skills : [],
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
    setDefaultResume,
    deleteResume
};
