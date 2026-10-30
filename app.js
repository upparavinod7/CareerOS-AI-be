const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const jobRoutes = require("./routes/jobRoutes");
const aiRoutes = require("./routes/aiRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const integrationRoutes = require("./routes/integrationRoutes");
const autoApplyRoutes = require("./routes/autoApplyRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { securityHeaders, rateLimiter } = require("./middleware/security");
const { notFound, errorHandler } = require("./middleware/errorHandlers");

const app = express();

const origins = (process.env.CLIENT_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(securityHeaders);
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin || origins.includes(origin) || origin.includes("localhost") || origin.includes("127.0.0.1")) {
            return callback(null, true);
        }
        return callback(null, true); // Permissive in development
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
}

app.use(rateLimiter);

app.get("/health", (req, res) => {
    const { isDatabaseConnected, getDatabaseMode } = require("./config/db");
    res.json({
        status: "ok",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: {
            connected: isDatabaseConnected(),
            mode: getDatabaseMode()
        }
    });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/jobs", jobRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/applications", applicationRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/integrations", integrationRoutes);
app.use("/api/v1/auto-apply", autoApplyRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
