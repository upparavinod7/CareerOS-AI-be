const mongoose = require("mongoose");

const coverLetterSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        role: { type: String, required: true, trim: true },
        companyName: { type: String, required: true, trim: true },
        jobDescription: { type: String, default: "" },
        tone: {
            type: String,
            enum: ["Professional", "Confident", "Enthusiastic", "Concise"],
            default: "Professional"
        },
        content: { type: String, required: true }
    },
    { timestamps: true }
);

coverLetterSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("CoverLetter", coverLetterSchema);

