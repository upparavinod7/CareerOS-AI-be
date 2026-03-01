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
            error: "Database unavailable. Start MongoDB and retry."
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
            return res.status(400).json({ error: "name, email and password are required" });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: "Enter a valid email address" });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ error: "Email already registered" });
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashed });
        const token = signToken(user._id.toString());

        return res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                skills: user.skills,
                experienceYears: user.experienceYears,
                targetRole: user.targetRole
            }
        });
    } catch (error) {
        if (isDatabaseUnavailable(error)) {
            return res.status(503).json({
                error: "Database unavailable. Start MongoDB and retry."
            });
        }

        if (error?.code === 11000) {
            return res.status(409).json({ error: "Email already registered" });
        }

        if (error?.name === "ValidationError") {
            return res.status(400).json({ error: "Invalid registration data" });
        }

        return res.status(500).json({ error: "Registration failed unexpectedly" });
    }
};

exports.login = async (req, res, next) => {
    try {
        if (!ensureDbReady(res)) return;

        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!email || !password) {
            return res.status(400).json({ error: "email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = signToken(user._id.toString());

        return res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                skills: user.skills,
                experienceYears: user.experienceYears,
                targetRole: user.targetRole
            }
        });
    } catch (error) {
        if (isDatabaseUnavailable(error)) {
            return res.status(503).json({
                error: "Database unavailable. Start MongoDB and retry."
            });
        }

        return res.status(500).json({ error: "Login failed unexpectedly" });
    }
};
