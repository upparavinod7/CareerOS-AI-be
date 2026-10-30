const mongoose = require("mongoose");

const fitAnalysisSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },
        role: { type: String, required: true },
        fitScore: { type: Number, required: true, min: 0, max: 100 },
        strongSkills: { type: [String], default: [] },
        missingSkills: { type: [String], default: [] },
        partiallyMatchingSkills: { type: [String], default: [] },
        suggestions: { type: [String], default: [] },
        categoryScores: [
            {
                subject: { type: String, required: true },
                score: { type: Number, required: true }
            }
        ],
        keywordCoverage: { type: Number, default: 0 },
        experienceAlignment: { type: String, default: "" }
    },
    { timestamps: true }
);

fitAnalysisSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("FitAnalysis", fitAnalysisSchema);
