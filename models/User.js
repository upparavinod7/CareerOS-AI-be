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

const projectSchema = new mongoose.Schema(
    {
        name: { type: String, default: "", trim: true },
        description: { type: String, default: "" },
        role: { type: String, default: "" },
        technologies: { type: [String], default: [] },
        link: { type: String, default: "" }
    },
    { _id: true }
);

const resumeVersionSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        targetRole: { type: String, default: "", trim: true },
        isDefault: { type: Boolean, default: false },
        resumeText: { type: String, required: true },
        skills: { type: [String], default: [] },
        fileName: { type: String, default: "resume.pdf" },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    },
    { _id: true }
);

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, minlength: 6 },
        role: { type: String, default: "user", enum: ["user", "admin"] },
        phone: { type: String, default: "", trim: true },
        location: { type: String, default: "", trim: true },
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
        noticePeriod: { type: String, default: "Immediate", trim: true },
        expectedSalary: { type: Number, default: 0, min: 0 },
        resumeText: { type: String, default: "" },
        resumes: { type: [resumeVersionSchema], default: [] },
        education: { type: [educationSchema], default: [] },
        experience: { type: [experienceSchema], default: [] },
        projects: { type: [projectSchema], default: [] },
        certifications: { type: [String], default: [] },
        savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }]
    },
    { timestamps: true }
);

// Method to calculate profile completion percentage
userSchema.methods.getProfileCompletion = function () {
    let score = 0;
    if (this.name) score += 10;
    if (this.email) score += 10;
    if (this.headline) score += 10;
    if (this.targetRole) score += 10;
    if (this.skills && this.skills.length > 0) score += 15;
    if (this.phone) score += 5;
    if (this.location) score += 5;
    if ((this.resumeText && this.resumeText.length > 50) || (this.resumes && this.resumes.length > 0)) score += 15;
    if ((this.experience && this.experience.length > 0) || this.experienceYears > 0) score += 10;
    if (this.education && this.education.length > 0) score += 5;
    if (this.projects && this.projects.length > 0) score += 5;
    return Math.min(100, score);
};

module.exports = mongoose.model("User", userSchema);
