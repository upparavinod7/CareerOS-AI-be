function calculateFit(requiredSkills, userSkills) {
    const safeRequired = Array.isArray(requiredSkills) ? requiredSkills : [];
    const safeUser = Array.isArray(userSkills) ? userSkills : [];

    const normalizedRequired = safeRequired.map(skill =>
        String(skill).trim().toLowerCase()
    );
    const normalizedUser = safeUser.map(skill =>
        String(skill).trim().toLowerCase()
    );

    const matched = normalizedUser.filter(skill =>
        normalizedRequired.includes(skill)
    );

    const fitScore =
        normalizedRequired.length === 0
            ? 0
            : (matched.length / normalizedRequired.length) * 100;

    return {
        fitScore,
        strongSkills: matched,
        missingSkills: normalizedRequired.filter(
            skill => !normalizedUser.includes(skill)
        )
    };
}

module.exports = { calculateFit };
