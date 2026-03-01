const mongoose = require("mongoose");

const fitAnalysisSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, required: true },
        fitScore: { type: Number, required: true },
        strongSkills: { type: [String], default: [] },
        missingSkills: { type: [String], default: [] },
        suggestions: { type: [String], default: [] }
    },
    { timestamps: true }
);

fitAnalysisSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("FitAnalysis", fitAnalysisSchema);
