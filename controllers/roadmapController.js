const { generateRoadmap } = require("../utils/aiEngine");
const { trackAction } = require("../utils/realtimeHub");

exports.generateRoadmap = (req, res) => {
    const { role, hoursPerDay, months } = req.body;

    if (!role || typeof role !== "string") {
        return res.status(400).json({ error: "Valid role is required" });
    }

    if (
        typeof hoursPerDay !== "number" ||
        typeof months !== "number" ||
        hoursPerDay <= 0 ||
        months <= 0
    ) {
        return res.status(400).json({
            error: "hoursPerDay and months must be positive numbers"
        });
    }

    const roadmap = generateRoadmap(role, Number(hoursPerDay), Number(months));

    trackAction("roadmap_generate", {
        role: roadmap.resolvedRole || role,
        totalHours: roadmap.totalHours
    });

    res.json(roadmap);
};
