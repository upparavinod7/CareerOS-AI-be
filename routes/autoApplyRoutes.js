const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const {
    getOverview,
    getMatchingJobs,
    getQueue,
    prepareApplication,
    approveApplication,
    updateApplicationAnswers,
    submitApplication,
    confirmGuidedSubmission,
    rejectApplication,
    getHistory,
    getSettings,
    updateSettings
} = require("../controllers/autoApplyController");

const router = express.Router();

router.use(authenticateToken);

router.get("/overview", getOverview);
router.get("/jobs", getMatchingJobs);
router.get("/queue", getQueue);
router.post("/prepare", prepareApplication);
router.post("/:id/approve", approveApplication);
router.patch("/:id/answers", updateApplicationAnswers);
router.post("/:id/submit", submitApplication);
router.post("/:id/confirm-guided", confirmGuidedSubmission);
router.post("/:id/reject", rejectApplication);
router.get("/history", getHistory);
router.get("/settings", getSettings);
router.patch("/settings", updateSettings);

module.exports = router;
