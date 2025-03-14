const { format, transports, createLogger } = require('winston');
const MongoDB = require('winston-mongodb').MongoDB;
const { LOG_LEVEL, LOG_FILE_PATH, CONNECTION_STRING } = require("../../config");

// 03-13-2025 22:14:12 INFO: [email:abc] [location:abc] [procType:abc] [log:{}]
const formats = format.combine(
    format.timestamp({ format: "MM-DD-YYYY HH:mm:ss.SSS" }),
    format.simple(),
    format.splat(),
    format.printf(info => `${info.timestamp} ${info.level.toUpperCase()} [email:${info.message.email}] [location:${info.message.location}] [proc_type:${info.message.proc_type}] [log:${JSON.stringify(info.message.log)}]`)
);

// Console logging is enabled by default for immediate feedback during development and debugging.
const logger = createLogger({
    level: LOG_LEVEL,
    transports: [
        new transports.Console({ format: formats }),

        /* -- File Storage Option (Uncomment to enable) --
           File logging is suitable for persistent storage of logs for long-term analysis. */
        // new transports.File({ filename: LOG_FILE_PATH, format: formats }),

        /* -- MongoDB Storage Option (Uncomment to enable) --
           MongoDB logging provides centralized log storage and advanced querying capabilities.
           Note: Ensure the CONNECTION_STRING is securely stored. */
        // new MongoDB({
        //     db: CONNECTION_STRING, // MongoDB connection URI
        //     collection: 'logs', // Collection name for logs
        //     format: formats
        // })
    ]
});

module.exports = logger;