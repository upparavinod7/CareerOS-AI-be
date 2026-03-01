const express = require("express");
const {
    createApplication,
    listApplications,
    updateApplication
} = require("../controllers/applicationController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, listApplications);
router.post("/", auth, createApplication);
router.patch("/:id", auth, updateApplication);

module.exports = router;
