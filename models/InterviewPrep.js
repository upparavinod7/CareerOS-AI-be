const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        role: { type: String, enum: ["ai", "user"], required: true },
        content: { type: String, required: true },
        score: { type: Number, default: null },
        feedback: { type: String, default: "" }
    },
    { _id: true, timestamps: true }
);

const interviewPrepSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        role: { type: String, required: true, trim: true },
        difficulty: {
            type: String,
            enum: ["Beginner", "Intermediate", "Advanced"],
            default: "Intermediate"
        },
        focusSkills: { type: [String], default: [] },
        technicalQuestions: { type: [String], default: [] },
        behavioralQuestions: { type: [String], default: [] },
        mockPlan: { type: [String], default: [] },
        chatMessages: { type: [messageSchema], default: [] }
    },
    { timestamps: true }
);

interviewPrepSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("InterviewPrep", interviewPrepSchema);

