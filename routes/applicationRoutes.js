const express = require("express");
const {
    createApplication,
    listApplications,
    updateApplication,
    deleteApplication
} = require("../controllers/applicationController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.use(auth);

router.post("/", createApplication);
router.get("/", listApplications);
router.patch("/:id", updateApplication);
router.put("/:id", updateApplication);
router.delete("/:id", deleteApplication);

module.exports = router;
