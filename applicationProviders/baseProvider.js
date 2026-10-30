/**
 * Base Application Provider
 * Defines standard interface and capability contract for all job platform integrations.
 */
class BaseProvider {
    constructor(config = {}) {
        this.id = config.id || "base";
        this.name = config.name || "Base Provider";
        this.authType = config.authType || "oauth2"; // oauth2 | api_key | none
    }

    /**
     * Declares explicit capabilities of this integration
     */
    getCapabilities() {
        return {
            providerId: this.id,
            providerName: this.name,
            authType: this.authType,
            authentication: false,
            profileRetrieval: false,
            jobDiscovery: false,
            applicationPreparation: true,
            applicationSubmission: false,
            submissionMethod: "guided", // 'direct' | 'guided'
            statusRetrieval: false,
            disclaimer: "Guided application workflow complying with platform terms."
        };
    }

    /**
     * Returns authorization URL for initiating connection flow
     */
    async getAuthUrl(stateToken, redirectUri) {
        throw new Error(`getAuthUrl not supported by provider: ${this.id}`);
    }

    /**
     * Validates callback code and returns token payload
     */
    async handleCallback(code, stateToken) {
        throw new Error(`handleCallback not supported by provider: ${this.id}`);
    }

    /**
     * Prepares answers and documents for submission
     */
    async prepareApplication(candidateProfile, jobDetails, resume) {
        throw new Error(`prepareApplication not implemented by provider: ${this.id}`);
    }

    /**
     * Submits application directly via official API
     */
    async submitDirect(applicationData, credentials) {
        throw new Error(`Direct submission is not supported or authorized by provider: ${this.id}`);
    }

    /**
     * Prepares guided application package for external completion
     */
    async generateGuidedPackage(applicationData) {
        return {
            submissionMethod: "guided",
            destinationUrl: applicationData.jobUrl || "",
            preparedAnswers: applicationData.questionAnswers || [],
            coverLetter: applicationData.coverLetter || "",
            resumeName: applicationData.resumeName || "Default Resume",
            instructions: [
                "1. Click 'Open Job Application' to visit the original posting on " + this.name,
                "2. Use the prepared tailored answers provided in the side panel",
                "3. Copy and attach your tailored cover letter and resume",
                "4. Complete any required platform security checks (CAPTCHA/MFA)",
                "5. Return here and click 'Confirm Submission' with your external confirmation number"
            ]
        };
    }
}

module.exports = BaseProvider;
