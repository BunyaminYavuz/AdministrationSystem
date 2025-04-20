module.exports = {
    "PORT": process.env.PORT || "3000",
    "CONNECTION_STRING": process.env.CONNECTION_STRING || "mongodb://127.0.0.1:27017/administration_system",
    "LOG_LEVEL": process.env.LOG_LEVEL || "debug",
    "LOG_FILE_PATH": process.env.LOG_FILE_PATH || "./logs/app.log",
    "JWT": {
        "SECRET": process.env.JWT_SECRET_KEY || "secret_key",
        "EXPIRE_TIME": !isNaN(parseInt(process.env.JWT_TOKEN_EXPIRE_TIME)) ? parseInt(process.env.JWT_TOKEN_EXPIRE_TIME) : 24 * 60 * 60,
    },
    "DEFAULT_LANG": process.env.DEFAULT_LANG || "EN"
};