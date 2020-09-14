import { SfdxProject } from "@salesforce/core";
import { isNullOrUndefined } from "util";
import { UX } from "@salesforce/command";
import cli from "cli-ux";
const Logger = require("pino");
export enum LoggerLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60,
}
export class SFPowerkit {
  private static defaultFolder: string;
  private static projectDirectories: string[];
  private static pluginConfig;
  public static isJsonFormatEnabled: boolean;
  private static ux: UX;
  private static sourceApiVersion: any;
  private static logger;
  public static logLevel;
  private static packageInfos: any[];

  public static setLogLevel(logLevel: string, isJsonFormatEnabled: boolean) {
    logLevel = logLevel.toLowerCase();
    this.isJsonFormatEnabled = isJsonFormatEnabled;
    if (!isJsonFormatEnabled) {
      SFPowerkit.logger = Logger({
        name: "sfpowerkit",
        level: logLevel,
        prettyPrint: {
          levelFirst: true, // --levelFirst
          colorize: true,
          translateTime: true,
          ignore: "pid,hostname", // --ignore
        },
      });
    } else {
      //do nothing for now, need to put pino to move to file
    }
    switch (logLevel) {
      case "trace":
        SFPowerkit.logLevel = LoggerLevel.TRACE;
        break;
      case "debug":
        SFPowerkit.logLevel = LoggerLevel.DEBUG;
        break;
      case "info":
        SFPowerkit.logLevel = LoggerLevel.INFO;
        break;
      case "warn":
        SFPowerkit.logLevel = LoggerLevel.WARN;
        break;
      case "error":
        SFPowerkit.logLevel = LoggerLevel.ERROR;
        break;
      case "fatal":
        SFPowerkit.logLevel = LoggerLevel.FATAL;
        break;
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
  public static async getPackageName(filePath: string) {
    if (!SFPowerkit.packageInfos) {
      SFPowerkit.packageInfos = [];
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();
      let packages = (project.get("packageDirectories") as any[]) || [];
      SFPowerkit.packageInfos = packages;
    }
    let packageName = "";
    SFPowerkit.packageInfos.forEach((packageInfo) => {
      if (filePath.includes(packageInfo.path) && packageInfo.package) {
        packageName = packageInfo.package;
      }
    });
    return packageName;
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
    if (isNullOrUndefined(this.logger)) return;
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
    if (isNullOrUndefined(this.logger)) return;
    if (this.isJsonFormatEnabled) return;

    this.ux.setSpinnerStatus(status);
  }
  public static startSpinner(message: string) {
    if (isNullOrUndefined(this.logger)) return;
    if (this.isJsonFormatEnabled) return;

    this.ux.startSpinner(message);
  }
  public static stopSpinner(message: string) {
    if (isNullOrUndefined(this.logger)) return;
    if (this.isJsonFormatEnabled) return;

    this.ux.stopSpinner(message);
  }
}
