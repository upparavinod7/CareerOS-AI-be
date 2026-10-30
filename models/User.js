const mongoose = require("mongoose");

const educationSchema = new mongoose.Schema(
    {
        degree: { type: String, default: "" },
        field: { type: String, default: "" },
        school: { type: String, default: "" },
        year: { type: String, default: "" }
    },
    { _id: true }
);

const experienceSchema = new mongoose.Schema(
    {
        title: { type: String, default: "" },
        company: { type: String, default: "" },
        duration: { type: String, default: "" },
        description: { type: String, default: "" }
    },
    { _id: true }
);

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, minlength: 6 },
        role: { type: String, default: "user", enum: ["user", "admin"] },
        headline: { type: String, default: "", trim: true },
        bio: { type: String, default: "", trim: true },
        experienceYears: { type: Number, default: 0, min: 0 },
        skills: { type: [String], default: [] },
        targetRole: { type: String, default: "", trim: true },
        preferredLocations: { type: [String], default: [] },
        preferredWorkType: {
            type: String,
            enum: ["Remote", "Hybrid", "On-site", "Any"],
            default: "Any"
        },
        resumeText: { type: String, default: "" },
        education: { type: [educationSchema], default: [] },
        experience: { type: [experienceSchema], default: [] },
        certifications: { type: [String], default: [] },
        savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }]
    },
    { timestamps: true }
);

// Method to calculate profile completion percentage
userSchema.methods.getProfileCompletion = function () {
    let score = 0;
    if (this.name) score += 15;
    if (this.email) score += 15;
    if (this.headline) score += 10;
    if (this.targetRole) score += 15;
    if (this.skills && this.skills.length > 0) score += 15;
    if (this.resumeText && this.resumeText.length > 50) score += 15;
    if ((this.experience && this.experience.length > 0) || this.experienceYears > 0) score += 10;
    if (this.education && this.education.length > 0) score += 5;
    return Math.min(100, score);
};

module.exports = mongoose.model("User", userSchema);
