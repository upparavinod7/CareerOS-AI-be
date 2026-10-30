const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const {
    getIntegrations,
    getConnectedAccounts,
    getConnectUrl,
    handleOAuthCallback,
    disconnectAccount
} = require("../controllers/integrationController");

const router = express.Router();

router.get("/", authenticateToken, getIntegrations);
router.get("/accounts", authenticateToken, getConnectedAccounts);
router.get("/:provider/connect", authenticateToken, getConnectUrl);
router.post("/:provider/callback", authenticateToken, handleOAuthCallback);
router.delete("/:provider", authenticateToken, disconnectAccount);

module.exports = router;
