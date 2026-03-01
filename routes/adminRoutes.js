const express = require("express");
const { seedMockJobs } = require("../controllers/adminController");

const router = express.Router();

router.post("/seed-jobs", seedMockJobs);

module.exports = router;
