const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey() {
    const rawSecret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "careeros-ai-default-encryption-secret-32-chars-long";
    // Ensure exactly 32 bytes using SHA-256
    return crypto.createHash("sha256").update(rawSecret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param {string} text - Plaintext to encrypt
 * @returns {string} - Encrypted string in format iv:tag:ciphertext (hex)
 */
function encrypt(text) {
    if (!text || typeof text !== "string") return "";
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an encrypted string created with encrypt()
 * @param {string} payload - iv:tag:ciphertext (hex)
 * @returns {string} - Decrypted plaintext string
 */
function decrypt(payload) {
    if (!payload || typeof payload !== "string") return "";
    const parts = payload.split(":");
    if (parts.length !== 3) return "";

    const [ivHex, tagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    try {
        let decrypted = decipher.update(encryptedHex, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (err) {
        console.error("[Crypto] Decryption failed:", err.message);
        return "";
    }
}

module.exports = {
    encrypt,
    decrypt
};
