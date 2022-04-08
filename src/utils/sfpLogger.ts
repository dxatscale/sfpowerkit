import * as fs from 'fs-extra';
import { EOL } from 'os';
import chalk = require('chalk');
export enum LoggerLevel {
    TRACE = 10,
    DEBUG = 20,
    INFO = 30,
    WARN = 40,
    ERROR = 50,
    FATAL = 60,
    HIDE = 70,
}

const enum LoggerType {
    console = 1,
    file = 2,
    void = 3,
}
export class ConsoleLogger implements Logger {
    public logType: LoggerType;
    constructor() {
        this.logType = LoggerType.console;
    }
}
export class VoidLogger implements Logger {
    public logType: LoggerType;
    constructor() {
        this.logType = LoggerType.void;
    }
}
export class FileLogger implements Logger {
    public logType: LoggerType;
    constructor(public path: string) {
        this.logType = LoggerType.file;
    }
}
export interface Logger {
    logType: LoggerType;
    path?: string;
}

export const COLOR_ERROR = chalk.bold.red;
export const COLOR_WARNING = chalk.keyword('orange');
export const COLOR_INFO = chalk.white;
export const COLOR_TRACE = chalk.gray;
export const COLOR_DEBUG = chalk.blue;
export const COLOR_HEADER = chalk.yellowBright.bold;
export const COLOR_SUCCESS = chalk.green.bold;
export const COLOR_TIME = chalk.magentaBright;
export const COLOR_KEY_MESSAGE = chalk.magentaBright.bold;
export const COLOR_KEY_VALUE = chalk.black.bold.bgGreenBright;

export default class SFPLogger {
    public static logLevel: LoggerLevel = LoggerLevel.INFO;

    static enableColor() {
        chalk.level = 2;
    }

    static disableColor() {
        chalk.level = 0;
    }

    static log(message: string, logLevel = LoggerLevel.INFO, logger?: Logger) {
        if (logLevel == null) logLevel = LoggerLevel.INFO;

        if (logLevel < this.logLevel) return;

        //Todo: Proper fix
        if (logger && logger.logType === LoggerType.console) {
            logger = null; //Make it nullable, so it goes to console
        }

        if (logger) {
            if (logger.logType === LoggerType.void) {
                return;
            } else if (logger.logType === LoggerType.file) {
                let fileLogger = logger as FileLogger;
                fs.appendFileSync(fileLogger.path, message + EOL, 'utf8');
            }
        } else {
            switch (logLevel) {
                case LoggerLevel.TRACE:
                    console.log(COLOR_TRACE(message));
                    break;

                case LoggerLevel.DEBUG:
                    console.log(COLOR_DEBUG(message));
                    break;

                case LoggerLevel.INFO:
                    console.log(message);
                    break;

                case LoggerLevel.WARN:
                    console.log(COLOR_WARNING(message));
                    break;

                case LoggerLevel.ERROR:
                    console.log(COLOR_ERROR(message));
                    break;
            }
        }
    }
    static getLogLevelAsString() {
        return LoggerLevel[this.logLevel];
    }
}
