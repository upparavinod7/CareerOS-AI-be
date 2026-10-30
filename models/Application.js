const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },
        // Custom application fields for external or manual tracking
        company: { type: String, default: "", trim: true },
        jobTitle: { type: String, default: "", trim: true },
        location: { type: String, default: "", trim: true },
        jobUrl: { type: String, default: "", trim: true },
        recruiterName: { type: String, default: "", trim: true },
        recruiterEmail: { type: String, default: "", trim: true },
        salary: { type: String, default: "", trim: true },
        interviewDate: { type: Date, default: null },
        status: {
            type: String,
            enum: ["Interested", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"],
            default: "Applied"
        },
        notes: { type: String, default: "" },
        appliedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

// Compound index for user + job when job exists
applicationSchema.index(
    { user: 1, job: 1 },
    { unique: true, partialFilterExpression: { job: { $type: "objectId" } } }
);

module.exports = mongoose.model("Application", applicationSchema);
