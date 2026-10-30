function notFound(req, res) {
    res.status(404).json({
        success: false,
        error: `Cannot ${req.method} ${req.originalUrl}`,
        message: `Route not found: ${req.originalUrl}`
    });
}

function errorHandler(err, req, res, next) {
    if (process.env.NODE_ENV !== "test") {
        console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal server error";

    res.status(status).json({
        success: false,
        error: message,
        message,
        errors: err.errors || []
    });
}

module.exports = { notFound, errorHandler };
