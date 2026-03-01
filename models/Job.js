const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
    {
        providerId: { type: String, unique: true, sparse: true },
        title: { type: String, required: true, trim: true },
        company: { type: String, required: true, trim: true },
        location: { type: String, required: true, trim: true },
        role: { type: String, required: true, trim: true },
        experienceLevel: {
            type: String,
            enum: ["Intern", "Junior", "Mid", "Senior", "Lead"],
            default: "Junior"
        },
        minSalary: { type: Number, default: 0 },
        maxSalary: { type: Number, default: 0 },
        currency: { type: String, default: "USD" },
        description: { type: String, required: true },
        skills: { type: [String], default: [] },
        sourcePlatform: { type: String, default: "internal" },
        sourceLabel: { type: String, default: "CareerOS" },
        sourceUrl: { type: String, default: "" },
        demandScore: { type: Number, default: 50, min: 0, max: 100 },
        isActive: { type: Boolean, default: true },
        postedAt: { type: Date, default: Date.now },
        syncedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

jobSchema.index({ title: "text", company: "text", description: "text", skills: "text" });
jobSchema.index({ role: 1, location: 1, experienceLevel: 1, minSalary: 1, maxSalary: 1 });

module.exports = mongoose.model("Job", jobSchema);
