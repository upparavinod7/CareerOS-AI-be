const express = require("express");
const {
    analyzeFit,
    analyzeRoleFit,
    getFitHistory,
    predictCareer,
    createRoadmap,
    getRoadmaps,
    toggleRoadmapTask,
    optimizeResume,
    interviewGuidance,
    generateCoverLetter,
    getSavedCoverLetters,
    chatMockInterview
} = require("../controllers/aiController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.use(auth);

// Fit Analysis
router.post("/fit", analyzeFit);
router.post("/fit-role", analyzeRoleFit);
router.get("/fit-history", getFitHistory);

// Career Role Predictor
router.post("/career-predict", predictCareer);

// Learning Roadmap
router.post("/roadmap", createRoadmap);
router.get("/roadmaps", getRoadmaps);
router.patch("/roadmaps/:roadmapId/tasks/:taskId", toggleRoadmapTask);

// Resume & ATS
router.post("/resume-optimize", optimizeResume);

// Interview Preparation
router.post("/interview-guidance", interviewGuidance);
router.post("/chat-mock-interview", chatMockInterview);

// Cover Letter
router.post("/cover-letter", generateCoverLetter);
router.get("/cover-letters", getSavedCoverLetters);

module.exports = router;
