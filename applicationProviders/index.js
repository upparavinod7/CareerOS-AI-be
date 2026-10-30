const linkedinProvider = require("./linkedinProvider");
const indeedProvider = require("./indeedProvider");
const greenhouseProvider = require("./greenhouseProvider");
const leverProvider = require("./leverProvider");
const genericApplicationProvider = require("./genericApplicationProvider");

const providers = {
    linkedin: linkedinProvider,
    indeed: indeedProvider,
    greenhouse: greenhouseProvider,
    lever: leverProvider,
    generic: genericApplicationProvider
};

/**
 * Returns all registered providers and their declared capabilities
 */
function getRegisteredCapabilities() {
    return Object.values(providers).map(p => p.getCapabilities());
}

/**
 * Resolves appropriate provider instance for a platform key or job URL
 * @param {string} platformOrUrl
 */
function getProvider(platformOrUrl = "") {
    const key = String(platformOrUrl).toLowerCase();
    if (key.includes("linkedin")) return linkedinProvider;
    if (key.includes("indeed")) return indeedProvider;
    if (key.includes("greenhouse") || key.includes("gh_") || key.includes("grnh.se")) return greenhouseProvider;
    if (key.includes("lever") || key.includes("jobs.lever.co")) return leverProvider;
    return genericApplicationProvider;
}

module.exports = {
    providers,
    getProvider,
    getRegisteredCapabilities
};
