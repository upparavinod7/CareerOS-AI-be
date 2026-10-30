const express = require("express");
const { getMe, updateMe, changePassword } = require("../controllers/userController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/me", auth, getMe);
router.patch("/me", auth, updateMe);
router.post("/change-password", auth, changePassword);

module.exports = router;
