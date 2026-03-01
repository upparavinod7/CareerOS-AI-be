const { startRealtimeStream, getMetrics } = require("../utils/realtimeHub");

exports.streamRealtime = (req, res) => {
    startRealtimeStream(req, res);
};

exports.getRealtimeMetrics = (req, res) => {
    res.json(getMetrics());
};
