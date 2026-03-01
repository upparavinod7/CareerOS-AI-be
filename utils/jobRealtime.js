const { EventEmitter } = require("events");

const bus = new EventEmitter();
const clients = new Set();

let latest = {
    type: "bootstrap",
    timestamp: new Date().toISOString(),
    payload: { message: "Job realtime channel ready" }
};

function publish(type, payload) {
    latest = {
        type,
        timestamp: new Date().toISOString(),
        payload
    };

    bus.emit("event", latest);
}

function stream(req, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (event) => {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    send(latest);
    clients.add(send);

    const onEvent = (event) => send(event);
    bus.on("event", onEvent);

    const heartbeat = setInterval(() => {
        res.write(`event: heartbeat\n`);
        res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
    }, 25000);

    req.on("close", () => {
        clearInterval(heartbeat);
        bus.off("event", onEvent);
        clients.delete(send);
    });
}

function connectedClients() {
    return clients.size;
}

module.exports = {
    publish,
    stream,
    connectedClients
};
