const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function auth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_me");
        const user = await User.findById(payload.sub).select("-password");

        if (!user) {
            return res.status(401).json({ error: "Invalid token" });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

module.exports = { auth };
