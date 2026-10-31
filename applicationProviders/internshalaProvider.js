const BaseProvider = require("./baseProvider");

class InternshalaProvider extends BaseProvider {
    constructor() {
        super({
            id: "internshala",
            name: "Internshala",
            authType: "guided"
        });
    }

    getCapabilities() {
        return {
            providerId: "internshala",
            providerName: "Internshala",
            authType: "guided",
            authentication: false,
            profileRetrieval: false,
            jobDiscovery: true,
            applicationPreparation: true,
            applicationSubmission: false, // Internshala requires interactive assignment responses and candidate sign-in
            submissionMethod: "guided",
            statusRetrieval: false,
            disclaimer: "Internshala integration prepares tailored assignment answers, availability confirmations, and ATS resumes for seamless 1-click guided application."
        };
    }

    async generateGuidedPackage(applicationData) {
        return {
            submissionMethod: "guided",
            destinationUrl: applicationData.jobUrl || "https://internshala.com",
            preparedAnswers: applicationData.questionAnswers || [],
            coverLetter: applicationData.coverLetter || "",
            resumeName: applicationData.resumeName || "Tailored ATS Resume",
            instructions: [
                "1. Click 'Open Job Application' to view the listing on Internshala.",
                "2. Click 'Apply Now' and review employer assignment questions.",
                "3. Copy the prepared answers from the side panel directly into each assignment question.",
                "4. Confirm immediate availability and submit.",
                "5. Return here and click 'Confirm Submission' to track your application."
            ]
        };
    }
}

module.exports = new InternshalaProvider();
