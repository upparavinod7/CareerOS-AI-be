const express = require("express");
const {
    searchJobs,
    getJobById,
    streamJobs,
    syncJobs,
    getSyncStatus
} = require("../controllers/jobController");

const router = express.Router();

router.get("/", searchJobs);
router.get("/stream", streamJobs);
router.get("/sync/status", getSyncStatus);
router.post("/sync", syncJobs);
router.get("/:id", getJobById);

module.exports = router;
