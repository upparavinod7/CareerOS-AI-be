const mongoose = require("mongoose");

const autoApplySettingsSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
        targetRoles: {
            type: [String],
            default: [
                "AI Engineer",
                "Generative AI Engineer",
                "AI Agent Developer",
                "Machine Learning Engineer",
                "LLM Engineer",
                "AI Automation Engineer",
                "Full Stack Developer"
            ]
        },
        preferredLocations: { type: [String], default: ["Remote", "Remote worldwide"] },
        remoteOnly: { type: Boolean, default: true },
        minMatchScore: { type: Number, default: 65, min: 30, max: 100 },
        preferredCompanies: { type: [String], default: [] },
        excludedCompanies: { type: [String], default: [] },
        dailyApplicationTarget: { type: Number, default: 20, min: 1, max: 50 },
        dailySubmittedCount: { type: Number, default: 0 },
        lastSubmittedDate: { type: Date, default: null },
        sources: {
            type: [String],
            default: ["LinkedIn", "Wellfound", "Company Career Pages", "Internshala", "Supported APIs"]
        },
        workingHours: {
            start: { type: String, default: "09:00" },
            end: { type: String, default: "18:00" },
            timezone: { type: String, default: "Asia/Kolkata" }
        },
        scheduledExecutionTime: { type: String, default: "09:00 IST" },
        autoScheduleEnabled: { type: Boolean, default: true },
        requireApproval: { type: Boolean, default: true }, // Candidate approval required by default
        isPaused: { type: Boolean, default: false },
        defaultResumeId: { type: String, default: null }
    },
    { timestamps: true }
);

// Method to verify daily cap and reset if day has turned
autoApplySettingsSchema.methods.canSubmitToday = function () {
    if (this.isPaused) return false;

    const now = new Date();
    if (!this.lastSubmittedDate) {
        return this.dailySubmittedCount < this.dailyApplicationTarget;
    }

    const lastDay = this.lastSubmittedDate.toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    if (lastDay !== today) {
        this.dailySubmittedCount = 0;
        this.lastSubmittedDate = now;
        return true;
    }

    return this.dailySubmittedCount < this.dailyApplicationTarget;
};

// Increment count on submission
autoApplySettingsSchema.methods.recordSubmission = function () {
    const now = new Date();
    const lastDay = this.lastSubmittedDate ? this.lastSubmittedDate.toISOString().slice(0, 10) : "";
    const today = now.toISOString().slice(0, 10);

    if (lastDay !== today) {
        this.dailySubmittedCount = 1;
    } else {
        this.dailySubmittedCount += 1;
    }
    this.lastSubmittedDate = now;
};

module.exports = mongoose.model("AutoApplySettings", autoApplySettingsSchema);
