const roles = require("../data/rolesData");
const { calculateFit } = require("../utils/scoringEngine");
const { resolveRoleName } = require("../utils/roleResolver");
const { trackAction } = require("../utils/realtimeHub");

exports.checkFit = (req, res) => {
    const { role, skills } = req.body;
    const resolvedRole = resolveRoleName(role);

    if (!role || typeof role !== "string")
        return res.status(400).json({ error: "Valid role is required" });

    if (!Array.isArray(skills))
        return res.status(400).json({ error: "skills must be an array" });

    if (!resolvedRole || !roles[resolvedRole])
        return res.status(404).json({ error: "Role not found" });

    const result = calculateFit(
        roles[resolvedRole].requiredSkills,
        skills
    );

    const response = {
        role: resolvedRole,
        ...result
    };

    trackAction("fit_check", {
        role: resolvedRole,
        fitScore: result.fitScore
    });

    res.json(response);
};
