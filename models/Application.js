const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
        status: {
            type: String,
            enum: ["Applied", "Interview", "Rejected", "Offer"],
            default: "Applied"
        },
        notes: { type: String, default: "" },
        appliedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

applicationSchema.index({ user: 1, job: 1 }, { unique: true });

module.exports = mongoose.model("Application", applicationSchema);
