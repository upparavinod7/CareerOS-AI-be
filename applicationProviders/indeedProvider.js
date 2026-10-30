const BaseProvider = require("./baseProvider");

class IndeedProvider extends BaseProvider {
    constructor() {
        super({
            id: "indeed",
            name: "Indeed",
            authType: "partner_oauth"
        });
        this.clientId = process.env.INDEED_CLIENT_ID || "";
        this.clientSecret = process.env.INDEED_CLIENT_SECRET || "";
    }

    getCapabilities() {
        return {
            providerId: "indeed",
            providerName: "Indeed",
            authType: "partner_oauth",
            authentication: true,
            profileRetrieval: false,
            jobDiscovery: true,
            applicationPreparation: true,
            applicationSubmission: false, // Indeed Apply API is strictly restricted to certified enterprise ATS partners
            submissionMethod: "guided",
            statusRetrieval: false,
            disclaimer: "Indeed integration provides job discovery and guided submission assistance. Direct Indeed Apply submission requires formal enterprise partner certification."
        };
    }

    async getAuthUrl(stateToken, redirectUri) {
        return `https://secure.indeed.com/oauth/v2/authorize?client_id=${this.clientId || "MOCK_INDEED_ID"}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${stateToken}&scope=job_search`;
    }

    async handleCallback(code, stateToken, redirectUri) {
        return {
            providerUserId: "indeed_user_" + Math.random().toString(36).substring(7),
            name: "Indeed Connected Candidate",
            email: "candidate@indeed-verified.org",
            accessToken: "ind_at_" + Math.random().toString(36).substring(2),
            refreshToken: "ind_rt_" + Math.random().toString(36).substring(2),
            expiresIn: 2592000
        };
    }
}

module.exports = new IndeedProvider();
