const roles = require("../data/rolesData");

const clients = new Set();

const state = {
    startedAt: new Date().toISOString(),
    requestsServed: 0,
    fitChecks: 0,
    roadmapsGenerated: 0,
    jobsFetched: 0,
    lastEvent: null
};

function snapshot() {
    return {
        ...state,
        connectedClients: clients.size,
        serverTime: new Date().toISOString()
    };
}

function sendEvent(res, event, payload) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(event, payload) {
    clients.forEach(client => sendEvent(client, event, payload));
}

function publishEvent(type, payload) {
    const event = {
        id: Date.now(),
        type,
        timestamp: new Date().toISOString(),
        payload
    };

    state.lastEvent = event;
    broadcast("update", event);
    broadcast("metrics", snapshot());
}

function pickRandomJob() {
    const roleNames = Object.keys(roles);
    const role = roleNames[Math.floor(Math.random() * roleNames.length)];
    const jobs = roles[role].jobs;
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    return {
        ...job,
        role
    };
}

function startRealtimeStream(req, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    clients.add(res);
    sendEvent(res, "metrics", snapshot());
    if (state.lastEvent) {
        sendEvent(res, "update", state.lastEvent);
    }

    const heartbeat = setInterval(() => {
        sendEvent(res, "heartbeat", { timestamp: new Date().toISOString() });
    }, 25000);

    const ticker = setInterval(() => {
        publishEvent("job_highlight", pickRandomJob());
    }, 12000);

    req.on("close", () => {
        clearInterval(heartbeat);
        clearInterval(ticker);
        clients.delete(res);
    });
}

function trackAction(action, payload = {}) {
    state.requestsServed += 1;

    if (action === "fit_check") state.fitChecks += 1;
    if (action === "roadmap_generate") state.roadmapsGenerated += 1;
    if (action === "jobs_fetch") state.jobsFetched += 1;

    publishEvent(action, payload);
}

module.exports = {
    startRealtimeStream,
    getMetrics: snapshot,
    trackAction
};
