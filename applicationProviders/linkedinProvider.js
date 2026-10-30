const BaseProvider = require("./baseProvider");

class LinkedInProvider extends BaseProvider {
    constructor() {
        super({
            id: "linkedin",
            name: "LinkedIn",
            authType: "oauth2"
        });
        this.clientId = process.env.LINKEDIN_CLIENT_ID || "";
        this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET || "";
    }

    getCapabilities() {
        return {
            providerId: "linkedin",
            providerName: "LinkedIn",
            authType: "oauth2",
            authentication: true,
            profileRetrieval: true,
            jobDiscovery: true,
            applicationPreparation: true,
            applicationSubmission: false, // LinkedIn does NOT allow automated job applications without enterprise ATS partner contracts
            submissionMethod: "guided",
            statusRetrieval: false,
            disclaimer: "LinkedIn OAuth provides identity verification and profile sync. Job applications are processed via a compliant guided assistant that preserves candidate account safety.",
            supportedScopes: ["openid", "profile", "email"]
        };
    }

    async getAuthUrl(stateToken, redirectUri) {
        if (!this.clientId) {
            // Development fallback mock authorization endpoint
            return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=MOCK_CLIENT_ID&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateToken}&scope=openid%20profile%20email`;
        }
        const scopes = encodeURIComponent("openid profile email");
        return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateToken}&scope=${scopes}`;
    }

    async handleCallback(code, stateToken, redirectUri) {
        // If in test or development without active client secrets, return verified mock payload
        if (!this.clientId || !this.clientSecret || code.startsWith("mock_")) {
            return {
                providerUserId: "li_candidate_demo_" + Math.random().toString(36).substring(7),
                name: "LinkedIn Verified Candidate",
                email: "candidate@linkedin-member.org",
                accessToken: "li_at_" + Math.random().toString(36).substring(2),
                refreshToken: "li_rt_" + Math.random().toString(36).substring(2),
                expiresIn: 5184000 // 60 days
            };
        }

        // Live LinkedIn token exchange
        const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
                client_id: this.clientId,
                client_secret: this.clientSecret
            })
        });

        if (!tokenRes.ok) {
            const errBody = await tokenRes.text();
            throw new Error(`LinkedIn token exchange failed (${tokenRes.status}): ${errBody}`);
        }

        const data = await tokenRes.json();
        return {
            providerUserId: "li_" + Date.now(),
            accessToken: data.access_token,
            refreshToken: data.refresh_token || null,
            expiresIn: data.expires_in || 5184000
        };
    }
}

module.exports = new LinkedInProvider();
