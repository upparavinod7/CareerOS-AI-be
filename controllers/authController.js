const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken } = require("../utils/token");
const { isDatabaseConnected } = require("../config/db");

function isDatabaseUnavailable(error) {
    if (!error) return false;

    const names = new Set([
        "MongooseServerSelectionError",
        "MongoNetworkError",
        "MongoServerSelectionError"
    ]);

    if (names.has(error.name)) return true;

    const message = String(error.message || "").toLowerCase();
    return (
        message.includes("buffering timed out") ||
        message.includes("econnrefused") ||
        message.includes("server selection timed out")
    );
}

function ensureDbReady(res) {
    if (!isDatabaseConnected()) {
        res.status(503).json({
            success: false,
            error: "Database unavailable. Start MongoDB and retry.",
            message: "Database unavailable. Start MongoDB and retry."
        });
        return false;
    }
    return true;
}

exports.register = async (req, res, next) => {
    try {
        if (!ensureDbReady(res)) return;

        const body = req.body && typeof req.body === "object" ? req.body : {};
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: "Name, email and password are required.",
                message: "Name, email and password are required."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                error: "Please enter a valid email address.",
                message: "Please enter a valid email address."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: "Password must be at least 6 characters long.",
                message: "Password must be at least 6 characters long."
            });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({
                success: false,
                error: "An account with this email already exists.",
                message: "An account with this email already exists."
            });
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashed });
        const token = signToken(user._id.toString());

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            token,
            user: {
                id: user._id,
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                skills: user.skills,
                experienceYears: user.experienceYears,
                targetRole: user.targetRole,
                profileCompletion: user.getProfileCompletion()
            }
        });
    } catch (error) {
        if (isDatabaseUnavailable(error)) {
            return res.status(503).json({
                success: false,
                error: "Database unavailable. Start MongoDB and retry.",
                message: "Database unavailable. Start MongoDB and retry."
            });
        }

        if (error?.code === 11000) {
            return res.status(409).json({
                success: false,
                error: "An account with this email already exists.",
                message: "An account with this email already exists."
            });
        }

        if (error?.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                error: "Invalid registration data",
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            error: "Registration failed unexpectedly",
            message: error.message
        });
    }
};

exports.login = async (req, res, next) => {
    try {
        if (!ensureDbReady(res)) return;

        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: "Email and password are required.",
                message: "Email and password are required."
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password",
                message: "Invalid email or password"
            });
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password",
                message: "Invalid email or password"
            });
        }

        const token = signToken(user._id.toString());

        return res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                headline: user.headline,
                bio: user.bio,
                skills: user.skills,
                experienceYears: user.experienceYears,
                targetRole: user.targetRole,
                preferredLocations: user.preferredLocations,
                preferredWorkType: user.preferredWorkType,
                resumeText: user.resumeText,
                profileCompletion: user.getProfileCompletion()
            }
        });
    } catch (error) {
        if (isDatabaseUnavailable(error)) {
            return res.status(503).json({
                success: false,
                error: "Database unavailable. Start MongoDB and retry.",
                message: "Database unavailable. Start MongoDB and retry."
            });
        }

        return res.status(500).json({
            success: false,
            error: "Login failed unexpectedly",
            message: error.message
        });
    }
};
