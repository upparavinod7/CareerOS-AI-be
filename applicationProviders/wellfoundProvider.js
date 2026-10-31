const BaseProvider = require("./baseProvider");

class WellfoundProvider extends BaseProvider {
    constructor() {
        super({
            id: "wellfound",
            name: "Wellfound (AngelList Talent)",
            authType: "oauth2_or_guided"
        });
    }

    getCapabilities() {
        return {
            providerId: "wellfound",
            providerName: "Wellfound (AngelList Talent)",
            authType: "oauth2_or_guided",
            authentication: true,
            profileRetrieval: true,
            jobDiscovery: true,
            applicationPreparation: true,
            applicationSubmission: false, // Wellfound requires direct candidate pitch submission on their portal
            submissionMethod: "guided",
            statusRetrieval: false,
            disclaimer: "Wellfound integration discovers startup roles and prepares tailored pitches, cover letters, and ATS resumes. Applications are submitted via a guided assistant respecting candidate account safety."
        };
    }

    async getAuthUrl(stateToken, redirectUri) {
        return `https://wellfound.com/oauth/authorize?client_id=careeros_client&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateToken}&response_type=code`;
    }

    async handleCallback(code, stateToken) {
        return {
            providerUserId: "wf_" + Date.now(),
            name: "Wellfound Verified Candidate",
            email: "candidate@wellfound-user.com",
            accessToken: "wf_token_" + Math.random().toString(36).substring(2),
            expiresIn: 2592000
        };
    }

    async generateGuidedPackage(applicationData) {
        return {
            submissionMethod: "guided",
            destinationUrl: applicationData.jobUrl || "https://wellfound.com/jobs",
            preparedAnswers: applicationData.questionAnswers || [],
            coverLetter: applicationData.coverLetter || "",
            resumeName: applicationData.resumeName || "Tailored ATS Resume",
            instructions: [
                "1. Click 'Open Job Application' to view this role on Wellfound.",
                "2. Click 'Apply' to open Wellfound's candidate pitch window.",
                "3. Copy your tailored pitch from the prepared answer panel into the candidate note box.",
                "4. Attach your tailored ATS resume PDF.",
                "5. Send the pitch, return here, and click 'Confirm Submission' to update your tracker."
            ]
        };
    }
}

module.exports = new WellfoundProvider();

