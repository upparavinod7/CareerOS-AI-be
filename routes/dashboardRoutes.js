const express = require("express");
const { getDashboard } = require("../controllers/dashboardController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, getDashboard);

module.exports = router;
