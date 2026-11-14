const express = require("express");
const { getMe, updateMe, changePassword } = require("../controllers/userController");
const {
    listResumes,
    addResume,
    uploadResumePdf,
    tailorResume,
    downloadResumePdf,
    setDefaultResume,
    deleteResume
} = require("../controllers/resumeController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/me", auth, getMe);
router.patch("/me", auth, updateMe);
router.post("/change-password", auth, changePassword);

// Multi-resume versions & PDF Ingestion + LLM Tailoring
router.get("/resumes", auth, listResumes);
router.post("/resumes", auth, addResume);
router.post("/resumes/upload-pdf", auth, uploadResumePdf);
router.post("/resumes/:id/tailor", auth, tailorResume);
router.get("/resumes/:id/download-pdf", auth, downloadResumePdf);
router.patch("/resumes/:id/default", auth, setDefaultResume);
router.delete("/resumes/:id", auth, deleteResume);

module.exports = router;
