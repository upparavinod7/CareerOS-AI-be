// Built-in security headers and simple memory rate limiting

function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline';"
    );
    next();
}

// Lightweight rate limiting: max 120 requests per minute per IP for general endpoints
const requestCounts = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 200;

function rateLimiter(req, res, next) {
    if (process.env.NODE_ENV === "test") return next();

    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const now = Date.now();
    const clientRecord = requestCounts.get(ip) || { count: 0, resetTime: now + WINDOW_MS };

    if (now > clientRecord.resetTime) {
        clientRecord.count = 1;
        clientRecord.resetTime = now + WINDOW_MS;
    } else {
        clientRecord.count += 1;
    }

    requestCounts.set(ip, clientRecord);

    if (clientRecord.count > MAX_REQUESTS) {
        return res.status(429).json({
            success: false,
            error: "Too many requests. Please slow down.",
            message: "Too many requests. Please slow down."
        });
    }

    next();
}

// Periodically prune stale IPs every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of requestCounts.entries()) {
        if (now > record.resetTime) {
            requestCounts.delete(ip);
        }
    }
}, 5 * 60 * 1000).unref();

module.exports = {
    securityHeaders,
    rateLimiter
};
