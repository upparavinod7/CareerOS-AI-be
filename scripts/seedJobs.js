require("dotenv").config();

const { connectDB } = require("../config/db");
const Job = require("../models/Job");
const { mockJobs } = require("../utils/mockJobs");

async function seed() {
    await connectDB();

    const operations = mockJobs.map(job => ({
        updateOne: {
            filter: { providerId: job.providerId },
            update: { $set: job },
            upsert: true
        }
    }));

    await Job.bulkWrite(operations);
    console.log(`Seeded ${mockJobs.length} jobs`);
    process.exit(0);
}

seed().catch(error => {
    console.error(error);
    process.exit(1);
});
