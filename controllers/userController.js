const User = require("../models/User");
const bcrypt = require("bcryptjs");

exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select("-password").populate("savedJobs");
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        const profileCompletion = user.getProfileCompletion();
        res.json({
            success: true,
            user: {
                ...user.toObject(),
                profileCompletion
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.updateMe = async (req, res, next) => {
    try {
        const allowedFields = [
            "name",
            "headline",
            "bio",
            "skills",
            "experienceYears",
            "targetRole",
            "preferredLocations",
            "preferredWorkType",
            "resumeText",
            "education",
            "experience",
            "certifications"
        ];

        const update = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                update[field] = req.body[field];
            }
        });

        // Ensure skills are normalized array
        if (typeof update.skills === "string") {
            update.skills = update.skills.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
        } else if (Array.isArray(update.skills)) {
            update.skills = update.skills.map(s => String(s).trim().toLowerCase()).filter(Boolean);
        }

        const user = await User.findByIdAndUpdate(req.user._id, update, {
            new: true,
            runValidators: true,
            select: "-password"
        }).populate("savedJobs");

        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        const profileCompletion = user.getProfileCompletion();
        res.json({
            success: true,
            message: "Profile updated successfully",
            user: {
                ...user.toObject(),
                profileCompletion
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: "Current and new password are required" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, error: "New password must be at least 6 characters" });
        }

        const user = await User.findById(req.user._id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: "Current password is incorrect" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        next(error);
    }
};
