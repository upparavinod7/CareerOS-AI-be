const express = require("express");
const {
    checkFit,
    generateRoadmap,
    getRoles,
    getAllJobs,
    getJobs,
    streamRealtime,
    getRealtimeMetrics
} = require("../controllers");

const router = express.Router();

router.post("/fit", checkFit);
router.post("/roadmap", generateRoadmap);
router.get("/roles", getRoles);
router.get("/jobs", getAllJobs);
router.get("/jobs/:role", getJobs);
router.get("/realtime/stream", streamRealtime);
router.get("/realtime/metrics", getRealtimeMetrics);

module.exports = router;
