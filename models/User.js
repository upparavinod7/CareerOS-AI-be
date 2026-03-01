const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, minlength: 6 },
        role: { type: String, default: "user", enum: ["user", "admin"] },
        experienceYears: { type: Number, default: 0, min: 0 },
        skills: { type: [String], default: [] },
        targetRole: { type: String, default: "" },
        resumeText: { type: String, default: "" }
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
