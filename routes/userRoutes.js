const express = require("express");
const { getMe, updateMe, changePassword } = require("../controllers/userController");
const {
    listResumes,
    addResume,
    setDefaultResume,
    deleteResume
} = require("../controllers/resumeController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/me", auth, getMe);
router.patch("/me", auth, updateMe);
router.post("/change-password", auth, changePassword);

// Multi-resume versions
router.get("/resumes", auth, listResumes);
router.post("/resumes", auth, addResume);
router.patch("/resumes/:id/default", auth, setDefaultResume);
router.delete("/resumes/:id", auth, deleteResume);

module.exports = router;
