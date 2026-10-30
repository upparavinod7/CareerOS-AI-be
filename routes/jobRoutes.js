const express = require("express");
const {
    searchJobs,
    getJobById,
    saveJob,
    unsaveJob,
    getSavedJobs,
    streamJobs,
    syncJobs,
    getSyncStatus
} = require("../controllers/jobController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", searchJobs);
router.get("/saved", auth, getSavedJobs);
router.get("/stream", streamJobs);
router.get("/sync/status", getSyncStatus);
router.post("/sync", syncJobs);
router.get("/:id", getJobById);
router.post("/:id/save", auth, saveJob);
router.delete("/:id/save", auth, unsaveJob);

module.exports = router;
