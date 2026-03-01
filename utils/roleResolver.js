const roles = require("../data/rolesData");

function resolveRoleName(inputRole) {
    if (typeof inputRole !== "string") return null;

    const normalized = inputRole.trim().toLowerCase();
    if (!normalized) return null;

    const availableRoles = Object.keys(roles);
    const exactMatch = availableRoles.find(
        role => role.toLowerCase() === normalized
    );

    if (exactMatch) return exactMatch;

    const partialMatch = availableRoles.find(role =>
        role.toLowerCase().includes(normalized)
    );

    return partialMatch || null;
}

module.exports = { resolveRoleName };
