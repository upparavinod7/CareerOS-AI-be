require("dotenv").config();

const app = require("./app");
const { connectDBWithRetry } = require("./config/db");
const { startJobsSyncScheduler } = require("./utils/jobFeedService");

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
    console.log(`CareerOS AI API running on port ${PORT}`);
});

connectDBWithRetry().catch(error => {
    console.error("Mongo retry bootstrap failed", error);
});

startJobsSyncScheduler();
