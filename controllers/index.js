const { checkFit } = require("./fitController");
const { generateRoadmap } = require("./roadmapController");
const { getRoles, getAllJobs, getJobs } = require("./jobController");
const { streamRealtime, getRealtimeMetrics } = require("./realtimeController");

module.exports = {
    checkFit,
    generateRoadmap,
    getRoles,
    getAllJobs,
    getJobs,
    streamRealtime,
    getRealtimeMetrics
};
