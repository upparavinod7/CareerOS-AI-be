const mongoose = require("mongoose");

const weeklyTaskSchema = new mongoose.Schema(
    {
        week: { type: Number, required: true },
        focus: { type: String, required: true },
        hours: { type: Number, default: 10 },
        deliverable: { type: String, default: "" },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date, default: null }
    },
    { _id: true }
);

const roadmapPhaseSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        durationWeeks: { type: Number, required: true },
        focus: { type: String, default: "" },
        milestone: { type: String, default: "" },
        skills: { type: [String], default: [] }
    },
    { _id: true }
);

const roadmapSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        title: { type: String, required: true, trim: true },
        targetRole: { type: String, required: true, trim: true },
        currentSkillLevel: {
            type: String,
            enum: ["Beginner", "Intermediate", "Advanced"],
            default: "Beginner"
        },
        hoursPerDay: { type: Number, default: 2 },
        months: { type: Number, default: 3 },
        totalHours: { type: Number, default: 180 },
        totalWeeks: { type: Number, default: 12 },
        phases: { type: [roadmapPhaseSchema], default: [] },
        weeklyPlan: { type: [weeklyTaskSchema], default: [] },
        recommendations: { type: [String], default: [] },
        progressPercentage: { type: Number, default: 0, min: 0, max: 100 }
    },
    { timestamps: true }
);

roadmapSchema.methods.updateProgress = function () {
    if (!this.weeklyPlan || this.weeklyPlan.length === 0) {
        this.progressPercentage = 0;
        return 0;
    }
    const completedCount = this.weeklyPlan.filter(task => task.completed).length;
    this.progressPercentage = Math.round((completedCount / this.weeklyPlan.length) * 100);
    return this.progressPercentage;
};

module.exports = mongoose.model("Roadmap", roadmapSchema);

