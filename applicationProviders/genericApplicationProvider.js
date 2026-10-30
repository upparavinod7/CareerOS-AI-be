const BaseProvider = require("./baseProvider");

class GenericApplicationProvider extends BaseProvider {
    constructor() {
        super({
            id: "generic",
            name: "Company Career Portals (Workday, Ashby, Taleo, iCIMS)",
            authType: "none"
        });
    }

    getCapabilities() {
        return {
            providerId: "generic",
            providerName: "Company Career Portals (Workday, Ashby, Taleo, iCIMS)",
            authType: "none",
            authentication: false,
            profileRetrieval: false,
            jobDiscovery: true,
            applicationPreparation: true,
            applicationSubmission: false,
            submissionMethod: "guided",
            statusRetrieval: false,
            disclaimer: "Provides an intelligent guided assistant: side-by-side tailored resume & cover letter, 1-click answer copying, and compliance tracking."
        };
    }

    async generateGuidedPackage(applicationData) {
        return {
            submissionMethod: "guided",
            destinationUrl: applicationData.jobUrl || "",
            preparedAnswers: applicationData.questionAnswers || [],
            coverLetter: applicationData.coverLetter || "",
            resumeName: applicationData.resumeName || "Selected Resume",
            instructions: [
                "1. Open the company job application portal using the link provided.",
                "2. Copy the tailored answers from the panel into each corresponding application question.",
                "3. Attach your selected optimized resume and cover letter.",
                "4. Review and complete the submission on the portal.",
                "5. Click 'Confirm Submission' below to record your application and update your tracker."
            ]
        };
    }
}

module.exports = new GenericApplicationProvider();
