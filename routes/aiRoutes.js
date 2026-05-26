const express = require("express");
const {
    analyzeFit,
    analyzeRoleFit,
    createRoadmap,
    optimizeResume,
    interviewGuidance,
    generateCoverLetter,
    chatMockInterview
} = require("../controllers/aiController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.post("/fit", auth, analyzeFit);
router.post("/fit-role", auth, analyzeRoleFit);
router.post("/roadmap", auth, createRoadmap);
router.post("/resume-optimize", auth, optimizeResume);
router.post("/resume-optimize", auth, optimizeResume);
router.post("/interview-guidance", auth, interviewGuidance);
router.post("/cover-letter", auth, generateCoverLetter);
router.post("/chat-mock-interview", auth, chatMockInterview);

module.exports = router;
