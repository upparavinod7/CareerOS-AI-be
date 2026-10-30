const crypto = require("crypto");
const ConnectedAccount = require("../models/ConnectedAccount");
const { providers, getRegisteredCapabilities } = require("../applicationProviders");

// In-memory CSRF state cache (with 10-minute TTL)
const stateStore = new Map();

function cleanExpiredStates() {
    const now = Date.now();
    for (const [state, entry] of stateStore.entries()) {
        if (now - entry.createdAt > 600000) {
            stateStore.delete(state);
        }
    }
}

/**
 * GET /api/v1/integrations
 * Returns registered platform providers and their true capabilities
 */
async function getIntegrations(req, res, next) {
    try {
        const capabilities = getRegisteredCapabilities();
        return res.json({
            success: true,
            data: capabilities
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/integrations/accounts
 * Returns user's currently connected integration accounts
 */
async function getConnectedAccounts(req, res, next) {
    try {
        const accounts = await ConnectedAccount.find({ user: req.user._id });
        return res.json({
            success: true,
            data: accounts.map(acc => acc.toSafeObject())
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/v1/integrations/:provider/connect
 * Generates authorization URL with CSRF state token
 */
async function getConnectUrl(req, res, next) {
    try {
        cleanExpiredStates();
        const { provider } = req.params;
        const providerInstance = providers[provider.toLowerCase()];

        if (!providerInstance) {
            return res.status(404).json({
                success: false,
                message: `Unknown provider: ${provider}`
            });
        }

        // Generate high-entropy state token for CSRF protection
        const stateToken = crypto.randomBytes(24).toString("hex");
        stateStore.set(stateToken, {
            userId: String(req.user._id),
            provider: provider.toLowerCase(),
            createdAt: Date.now()
        });

        const redirectUri = `${req.protocol}://${req.get("host")}/api/v1/integrations/${provider}/callback`;
        const authUrl = await providerInstance.getAuthUrl(stateToken, redirectUri);

        return res.json({
            success: true,
            data: {
                authUrl,
                stateToken,
                provider: provider.toLowerCase()
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/v1/integrations/:provider/callback
 * Handles OAuth callback code exchange or API credentials registration
 */
async function handleOAuthCallback(req, res, next) {
    try {
        const { provider } = req.params;
        const { code, state, boardToken, site, apiKey } = req.body;
        const providerLower = provider.toLowerCase();
        const providerInstance = providers[providerLower];

        if (!providerInstance) {
            return res.status(404).json({
                success: false,
                message: `Unsupported provider: ${provider}`
            });
        }

        // Verify CSRF state token if state was supplied
        if (state) {
            const stored = stateStore.get(state);
            if (!stored || stored.userId !== String(req.user._id) || stored.provider !== providerLower) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired OAuth CSRF state parameter."
                });
            }
            stateStore.delete(state);
        }

        let account = await ConnectedAccount.findOne({
            user: req.user._id,
            provider: providerLower
        });

        if (!account) {
            account = new ConnectedAccount({
                user: req.user._id,
                provider: providerLower
            });
        }

        // If credentials/tokens passed directly (e.g. for Greenhouse or Lever employer tokens)
        if (boardToken || site || apiKey) {
            account.metadata = {
                boardToken: boardToken || undefined,
                site: site || undefined
            };
            if (apiKey) {
                account.setTokens({ accessToken: apiKey, expiresIn: 31536000 });
            }
            account.accountName = `${providerInstance.name} (Configured)`;
            account.accountEmail = req.user.email;
            account.status = "connected";
            await account.save();

            return res.json({
                success: true,
                message: `${providerInstance.name} connected successfully.`,
                data: account.toSafeObject()
            });
        }

        // Process OAuth code exchange via provider
        const redirectUri = `${req.protocol}://${req.get("host")}/api/v1/integrations/${providerLower}/callback`;
        const tokenData = await providerInstance.handleCallback(code || "mock_code", state, redirectUri);

        account.accountEmail = tokenData.email || req.user.email;
        account.accountName = tokenData.name || `${providerInstance.name} Account`;
        account.setTokens({
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            expiresIn: tokenData.expiresIn
        });

        await account.save();

        return res.json({
            success: true,
            message: `${providerInstance.name} account connected successfully.`,
            data: account.toSafeObject()
        });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/v1/integrations/:provider
 * Disconnects and removes integration account
 */
async function disconnectAccount(req, res, next) {
    try {
        const { provider } = req.params;
        const result = await ConnectedAccount.findOneAndDelete({
            user: req.user._id,
            provider: provider.toLowerCase()
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: `No active ${provider} account found to disconnect.`
            });
        }

        return res.json({
            success: true,
            message: `${provider} account disconnected successfully.`
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getIntegrations,
    getConnectedAccounts,
    getConnectUrl,
    handleOAuthCallback,
    disconnectAccount
};
