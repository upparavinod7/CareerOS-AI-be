const mongoose = require("mongoose");

const resumeIntelligenceSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        title: {
            type: String,
            default: "Main Resume"
        },
        filename: {
            type: String,
            default: "resume.pdf"
        },
        targetRole: {
            type: String,
            default: ""
        },
        structuredResume: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        rawText: {
            type: String,
            default: ""
        },
        qualityReport: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        lastATSReport: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        lastOptimization: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        validationResult: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("ResumeIntelligence", resumeIntelligenceSchema);

