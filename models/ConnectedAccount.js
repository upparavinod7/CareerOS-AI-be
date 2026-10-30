const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/crypto");

const connectedAccountSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        provider: {
            type: String,
            required: true,
            enum: ["linkedin", "indeed", "greenhouse", "lever"]
        },
        accountEmail: { type: String, default: "", trim: true },
        accountName: { type: String, default: "", trim: true },
        status: {
            type: String,
            enum: ["connected", "expired", "revoked", "error"],
            default: "connected"
        },
        encryptedAccessToken: { type: String, default: "" },
        encryptedRefreshToken: { type: String, default: "" },
        tokenExpiresAt: { type: Date, default: null },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        connectedAt: { type: Date, default: Date.now },
        lastSyncAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

// One account per provider per user
connectedAccountSchema.index({ user: 1, provider: 1 }, { unique: true });

// Setter helpers for tokens
connectedAccountSchema.methods.setTokens = function ({ accessToken, refreshToken, expiresIn }) {
    if (accessToken) {
        this.encryptedAccessToken = encrypt(accessToken);
    }
    if (refreshToken) {
        this.encryptedRefreshToken = encrypt(refreshToken);
    }
    if (expiresIn) {
        this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    }
    this.status = "connected";
    this.lastSyncAt = new Date();
};

// Getter for decrypted access token (used strictly during internal authorized API requests)
connectedAccountSchema.methods.getAccessToken = function () {
    if (!this.encryptedAccessToken) return "";
    return decrypt(this.encryptedAccessToken);
};

// Safe representation for frontend JSON response (never leaks encrypted or raw tokens)
connectedAccountSchema.methods.toSafeObject = function () {
    return {
        _id: this._id,
        provider: this.provider,
        accountEmail: this.accountEmail || "",
        accountName: this.accountName || "",
        status: this.status,
        hasAccessToken: Boolean(this.encryptedAccessToken),
        tokenExpiresAt: this.tokenExpiresAt,
        connectedAt: this.connectedAt,
        lastSyncAt: this.lastSyncAt,
        metadata: {
            boardToken: this.metadata?.boardToken ? "configured" : undefined,
            site: this.metadata?.site ? "configured" : undefined
        }
    };
};

module.exports = mongoose.model("ConnectedAccount", connectedAccountSchema);
