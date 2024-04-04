var winston = require('winston');

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

const logFormat = printf(info => {
    return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
});
const logger = createLogger({
    format: combine(
        format(info => {
            info.level = info.level.toUpperCase()
            return info;
        })(),
        label({ label: 'HTML Maker' }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
                logFormat)
        }),

        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/info.log' })
    ]
});

module.exports = logger;