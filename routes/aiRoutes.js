const express = require("express");
const {
    analyzeFit,
    analyzeRoleFit,
    createRoadmap,
    optimizeResume,
    interviewGuidance
} = require("../controllers/aiController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.post("/fit", auth, analyzeFit);
router.post("/fit-role", auth, analyzeRoleFit);
router.post("/roadmap", auth, createRoadmap);
router.post("/resume-optimize", auth, optimizeResume);
router.post("/interview-guidance", auth, interviewGuidance);

module.exports = router;
