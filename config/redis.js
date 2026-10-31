/**
 * Redis & Queue Connection Manager
 * Manages ioredis connection with automatic error recovery and resilient in-memory fallback.
 */

const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI || "redis://127.0.0.1:6379";
let redisClient = null;
let isConnected = false;
let isConnecting = false;

function getRedisClient() {
    if (redisClient) return redisClient;

    if (process.env.DISABLE_REDIS === "true" || process.env.NODE_ENV === "test") {
        return null;
    }

    try {
        isConnecting = true;
        redisClient = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy(times) {
                if (process.env.NODE_ENV === "test" || !process.env.REDIS_URL || times > 1) {
                    return null;
                }
                return Math.min(times * 100, 1000);
            },
            reconnectOnError: () => false,
            lazyConnect: true
        });

        redisClient.on("connect", () => {
            isConnected = true;
            isConnecting = false;
            console.log("[Queue] Connected to Redis at", REDIS_URL);
        });

        redisClient.on("error", (err) => {
            isConnected = false;
            isConnecting = false;
            if (process.env.NODE_ENV !== "test") {
                console.warn("[Queue] Redis connection offline:", err.message);
            }
            if (err.code === "ECONNREFUSED" || process.env.NODE_ENV === "test") {
                try {
                    redisClient.disconnect(false);
                } catch {
                    // ignore
                }
            }
        });
    } catch (err) {
        isConnected = false;
        isConnecting = false;
    }

    return redisClient;
}

function isRedisConnected() {
    return isConnected;
}

function getQueueMode() {
    return isConnected ? "redis_bullmq" : "in_memory_resilient";
}

async function closeRedis() {
    if (redisClient) {
        try {
            redisClient.disconnect(false);
            redisClient = null;
        } catch {
            // ignore
        }
    }
    isConnected = false;
    isConnecting = false;
}

module.exports = {
    getRedisClient,
    isRedisConnected,
    getQueueMode,
    closeRedis
};
