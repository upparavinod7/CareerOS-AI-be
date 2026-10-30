require("dotenv").config();

const { connectDBWithRetry } = require("../config/db");
const Job = require("../models/Job");
const { mockJobs } = require("../utils/mockJobs");

async function seed() {
    await connectDBWithRetry();

    const operations = mockJobs.map(job => ({
        updateOne: {
            filter: { providerId: job.providerId },
            update: { $set: job },
            upsert: true
        }
    }));

    const result = await Job.bulkWrite(operations);
    console.log(`[Seed] Seeded ${mockJobs.length} jobs successfully (${result.upsertedCount} inserted, ${result.modifiedCount} updated).`);
    process.exit(0);
}

seed().catch(error => {
    console.error("[Seed Error]", error);
    process.exit(1);
});
