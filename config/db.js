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

const bcrypt = require("bcryptjs");

async function seedDefaultData() {
    try {
        const User = require("../models/User");
        const Job = require("../models/Job");
        const { mockJobs } = require("../utils/mockJobs");

        // Seed demo user if not present
        const demoEmail = "demo@careeros.ai";
        const existingDemo = await User.findOne({ email: demoEmail });
        if (!existingDemo) {
            const hashedPassword = await bcrypt.hash("password123", 10);
            await User.create({
                name: "Demo Candidate",
                email: demoEmail,
                password: hashedPassword,
                targetRole: "Full Stack Engineer",
                headline: "Full Stack Software Engineer & AI Systems Architect",
                bio: "Passionate software engineer building resilient cloud services and AI career workflows.",
                skills: ["javascript", "react", "node.js", "python", "docker", "mongodb", "fastapi"],
                experienceYears: 4,
                preferredWorkType: "Remote",
                resumeText: "Demo Candidate\nFull Stack Engineer\nEmail: demo@careeros.ai\nLocation: San Francisco, CA\n\nExperience:\nFull Stack Engineer at Tech Corp (2022 - Present)\n• Built scalable backend services with Node.js and Python\n• Developed modern responsive UI components with React\n\nEducation:\nB.S. in Computer Science (2022)"
            });
            console.log("[Database] Seeded default demo account: demo@careeros.ai / password123");
        }

        // Seed initial jobs if empty
        const jobCount = await Job.countDocuments();
        if (jobCount === 0 && Array.isArray(mockJobs) && mockJobs.length > 0) {
            await Job.bulkWrite(
                mockJobs.map(job => ({
                    updateOne: {
                        filter: { providerId: job.providerId },
                        update: { $set: job },
                        upsert: true
                    }
                }))
            );
            console.log(`[Database] Seeded ${mockJobs.length} initial opportunities.`);
        }
    } catch (seedErr) {
        console.warn("[Database] Seed notice:", seedErr.message);
    }
}

function scheduleReconnect() {
    if (reconnectTimer || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") return;

    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        if (databaseMode === "in-memory") {
            return;
        }
        try {
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
            await connectDB();
            await seedDefaultData();
            console.log("[Database] Reconnected to external MongoDB successfully");
        } catch (error) {
            console.warn(`[Database] Reconnect attempt failed: ${error.message}`);
            scheduleReconnect();
        }
    }, 30000);
}

async function connectDBWithRetry() {
    try {
        await connectDB();
        await seedDefaultData();
    } catch (error) {
        console.warn(`[Database] External MongoDB connection failed: ${error.message}`);

        if (process.env.NODE_ENV === "production") {
            throw error;
        }

        try {
            await startInMemoryMongo();
            await seedDefaultData();
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
