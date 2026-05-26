const app = require("../app");
const mongoose = require("mongoose");
const { connectDBWithRetry } = require("../config/db");

// Vercel handles environment variables via the Vercel dashboard.
// Ensure you add MONGO_URI, JWT_SECRET, and CLIENT_ORIGINS to Vercel Settings -> Environment Variables.

// Connect to MongoDB (Vercel reuses execution environments context when "warm")
let isConnected = false;

if (!isConnected) {
  connectDBWithRetry()
    .then(() => {
      isConnected = true;
    })
    .catch((error) => {
      console.error("Vercel Serverless Mongo connection failed:", error);
    });
}

// Note: Background processes like `startJobsSyncScheduler()` cannot run continuously 
// in a Vercel serverless environment. They will be frozen. 
// You must migrate long-running jobs to Vercel Cron by creating a dedicated API endpoint
// that Vercel calls on a schedule.

module.exports = app;
