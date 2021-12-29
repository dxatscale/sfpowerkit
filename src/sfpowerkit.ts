import { SfdxProject } from "@salesforce/core";
import { isNullOrUndefined } from "util";
import { UX } from "@salesforce/command";
import chalk = require("chalk");
const Logger = require("pino");
//import pino from 'pino'
const NodeCache = require("node-cache");

export enum LoggerLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60,
}

export const COLOR_ERROR = chalk.bold.red;
export const COLOR_WARNING = chalk.keyword("orange");
export const COLOR_INFO = chalk.white;
export const COLOR_TRACE = chalk.gray;
export const COLOR_DEBUG = chalk.blue;
export const COLOR_HEADER = chalk.yellowBright.bold;
export const COLOR_SUCCESS = chalk.green.bold;
export const COLOR_TIME = chalk.magentaBright
export const COLOR_KEY_MESSAGE = chalk.magentaBright.bold
export const COLOR_KEY_VALUE = chalk.black.bold.bgGreenBright;

export class SFPowerkit {
  private static defaultFolder: string;
  private static projectDirectories: string[];
  private static pluginConfig;
  public static isJsonFormatEnabled: boolean;
  private static ux: UX;
  private static sourceApiVersion: any;
  private static logger;
  public static logLevel;
  public static logLevelString;
  private static cache;

  static enableColor() {
    chalk.level = 2;
  }

  static disableColor() {
    chalk.level = 0;
  }


  public static getCache() {
    if (SFPowerkit.cache == null) {
      SFPowerkit.cache = new NodeCache();
    }
    return SFPowerkit.cache;
  }

  public static setLogLevel(logLevel: string, isJsonFormatEnabled: boolean) {
    logLevel = logLevel.toLowerCase();
    this.logLevelString=logLevel;
    this.isJsonFormatEnabled = isJsonFormatEnabled;
    if (!isJsonFormatEnabled) {
      
      SFPowerkit.logger = Logger({
        name: "sfpowerkit",
        level: logLevel,
        transport: {
          target: 'pino-pretty',
          options: {
            levelFirst: true, // --levelFirst
            colorize: true,
            translateTime: true,
            ignore: "pid,hostname", // --ignore
          }
        }
      });
    } else {
      //do nothing for now, need to put pino to move to file
    }
  }

  public static setProjectDirectories(packagedirectories: string[]) {
    SFPowerkit.projectDirectories = packagedirectories;
  }

  public static async getProjectDirectories() {
    if (!SFPowerkit.projectDirectories) {
      SFPowerkit.projectDirectories = [];
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();
      let packages = (project.get("packageDirectories") as any[]) || [];
      packages.forEach((element) => {
        SFPowerkit.projectDirectories.push(element.path);
        if (element.default) {
          SFPowerkit.defaultFolder = element.path;
        }
      });
    }
    return SFPowerkit.projectDirectories;
  }

  public static async getDefaultFolder() {
    if (!SFPowerkit.defaultFolder) {
      await SFPowerkit.getProjectDirectories();
    }
    return SFPowerkit.defaultFolder;
  }
  public static setDefaultFolder(defaultFolder: string) {
    SFPowerkit.defaultFolder = defaultFolder;
  }

  public static async getConfig() {
    if (!SFPowerkit.pluginConfig) {
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();
      let plugins = project.get("plugins") || {};
      let sfpowerkitConfig = plugins["sfpowerkit"];
      SFPowerkit.pluginConfig = sfpowerkitConfig || {};
    }
    return SFPowerkit.pluginConfig;
  }
  public static setapiversion(apiversion: any) {
    SFPowerkit.sourceApiVersion = apiversion;
  }

  public static async getApiVersion(): Promise<any> {
    if (!SFPowerkit.sourceApiVersion) {
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();
      SFPowerkit.sourceApiVersion = project.get("sourceApiVersion");
    }
    return SFPowerkit.sourceApiVersion;
  }
  /**
   * Print log only if the log level for this commamnd matches the log level for the message
   * @param message Message to print
   * @param messageLoglevel Log level for the message
   */
  public static log(message: any, logLevel: LoggerLevel) {
    if (!this.logger) return;
    if (this.isJsonFormatEnabled) return;
    switch (logLevel) {
      case LoggerLevel.TRACE:
        this.logger.trace(message);
        break;
      case LoggerLevel.DEBUG:
        this.logger.debug(message);
        break;
      case LoggerLevel.INFO:
        this.logger.info(message);
        break;
      case LoggerLevel.WARN:
        this.logger.warn(message);
        break;
      case LoggerLevel.ERROR:
        this.logger.error(message);
        break;
      case LoggerLevel.FATAL:
        this.logger.fatal(message);
        break;
    }
  }
  public static setUx(ux: UX) {
    this.ux = ux;
  }

  public static setStatus(status: string) {
    this.ux.setSpinnerStatus(status);
  }
}
