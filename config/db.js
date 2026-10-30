const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let reconnectTimer = null;
let memoryServer = null;
let databaseMode = "disconnected";

function isDatabaseConnected() {
    return mongoose.connection.readyState === 1;
}

async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error("MONGO_URI environment variable is required.");
    }

    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, {
        dbName: process.env.MONGO_DB_NAME || "careeros_ai",
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
    });

    databaseMode = "external";
    console.log(`[Database] Connected to external MongoDB (${process.env.MONGO_DB_NAME || "careeros_ai"})`);
}

async function startInMemoryMongo() {
    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "[Database] In-memory MongoDB is disabled in production. A persistent MongoDB URI is required."
        );
    }

    if (memoryServer) {
        return;
    }

    console.warn("[Database] Development mode: Starting in-memory MongoDB fallback server...");
    memoryServer = await MongoMemoryServer.create({
        instance: { dbName: process.env.MONGO_DB_NAME || "careeros_ai" }
    });

    const memoryUri = memoryServer.getUri();
    await mongoose.connect(memoryUri, {
        dbName: process.env.MONGO_DB_NAME || "careeros_ai",
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
    });

    databaseMode = "in-memory";
    console.warn("⚠️  [Database] Running in-memory MongoDB fallback. Data will reset upon process restart!");
}

function scheduleReconnect() {
    if (reconnectTimer || process.env.NODE_ENV === "production") return;

    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        try {
            await connectDB();
            console.log("[Database] Reconnected to external MongoDB successfully");
        } catch (error) {
            console.warn(`[Database] Reconnect attempt failed: ${error.message}`);
            scheduleReconnect();
        }
    }, 10000);
}

async function connectDBWithRetry() {
    try {
        await connectDB();
    } catch (error) {
        console.warn(`[Database] External MongoDB connection failed: ${error.message}`);

        if (process.env.NODE_ENV === "production") {
            throw error;
        }

        try {
            await startInMemoryMongo();
        } catch (memoryError) {
            console.error(`[Database] In-memory MongoDB fallback failed: ${memoryError.message}`);
            scheduleReconnect();
        }
    }
}

async function disconnectDB() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    await mongoose.disconnect();
    if (memoryServer) {
        await memoryServer.stop();
        memoryServer = null;
    }
    databaseMode = "disconnected";
}

module.exports = {
    connectDB,
    connectDBWithRetry,
    disconnectDB,
    isDatabaseConnected,
    getDatabaseMode: () => databaseMode
};
