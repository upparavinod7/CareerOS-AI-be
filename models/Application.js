const mongoose = require("mongoose");

const questionAnswerSchema = new mongoose.Schema(
    {
        question: { type: String, required: true },
        answer: { type: String, default: "" },
        fieldType: { type: String, default: "text" }
    },
    { _id: true }
);

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
            enum: [
                "Discovered",
                "Shortlisted",
                "Preparing",
                "Awaiting Approval",
                "Ready to Submit",
                "Submitted",
                "Submission Failed",
                "Assessment",
                "Interview",
                "Offer",
                "Rejected",
                "Withdrawn",
                // Backward compatibility alias for legacy data
                "Interested",
                "Applied"
            ],
            default: "Awaiting Approval"
        },
        platform: { type: String, default: "Generic", trim: true },
        submissionMethod: { type: String, enum: ["direct", "guided"], default: "guided" },
        resumeVersionId: { type: String, default: null },
        resumeTitle: { type: String, default: "Default Resume" },
        resumeSnapshot: { type: String, default: "" },
        coverLetter: { type: String, default: "" },
        questionAnswers: { type: [questionAnswerSchema], default: [] },
        approvalRecord: {
            approved: { type: Boolean, default: false },
            approvedAt: { type: Date, default: null },
            notes: { type: String, default: "" }
        },
        providerConfirmation: {
            confirmationId: { type: String, default: null },
            responseMessage: { type: String, default: "" },
            submittedAt: { type: Date, default: null }
        },
        matchScore: { type: Number, default: 0, min: 0, max: 100 },
        matchingSkills: { type: [String], default: [] },
        missingSkills: { type: [String], default: [] },
        eligibilityConcerns: { type: [String], default: [] },
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
