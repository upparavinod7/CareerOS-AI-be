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
        throw new Error("MONGO_URI is required");
    }

    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, {
        dbName: process.env.MONGO_DB_NAME || "careeros_ai",
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
    });

    databaseMode = "external";
}

async function startInMemoryMongo() {
    if (memoryServer) {
        return;
    }

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
    console.warn("Using in-memory MongoDB fallback (data resets on restart).");
}

function scheduleReconnect() {
    if (reconnectTimer) return;

    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        try {
            await connectDB();
            console.log("MongoDB reconnected");
        } catch (error) {
            console.error("MongoDB reconnect failed:", error.message);
            scheduleReconnect();
        }
    }, 5000);
}

async function connectDBWithRetry() {
    try {
        await connectDB();
        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB initial connect failed:", error.message);

        try {
            await startInMemoryMongo();
            console.log("In-memory MongoDB connected");
        } catch (memoryError) {
            console.error("In-memory MongoDB fallback failed:", memoryError.message);
            scheduleReconnect();
        }
    }
}

module.exports = {
    connectDB,
    connectDBWithRetry,
    isDatabaseConnected,
    getDatabaseMode: () => databaseMode
};
