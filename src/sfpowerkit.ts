import { UX } from "@salesforce/command";
import { SfdxProject } from "@salesforce/core";
import { isNullOrUndefined } from "util";

export class SFPowerkit {
  static ux: UX;
  private static defaultFolder: string;
  private static projectDirectories: string[];
  private static pluginConfig;
  private static logLevel: string;

  public static setLogLevel(logLevel: string) {
    if (!isNullOrUndefined(logLevel)) this.logLevel = logLevel.toUpperCase();
    else this.logLevel = "WARN";
  }

  public static async getProjectDirectories() {
    if (!SFPowerkit.projectDirectories) {
      SFPowerkit.projectDirectories = [];
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();

      let packages = (project.get("packageDirectories") as any[]) || [];
      packages.forEach(element => {
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

  public static async getApiVersion(): Promise<any> {
    const dxProject = await SfdxProject.resolve();
    const project = await dxProject.retrieveSfdxProjectJson();
    return project.get("sourceApiVersion");
  }

  /**
   * Print log only if the log level for this commamnd matches the log level for the message
   * @param message Message to print
   * @param messageLoglevel Log level for the message
   */
  public static log(message: string, messageLoglevel: string) {
    if (messageLoglevel == this.logLevel) this.ux.log(message);
  }

  /**
   * Print log only if the log level for this commamnd matches the log level for the message
   * @param message Message to print in JSON Format
   * @param messageLoglevel  Log level for the message
   */
  public static logJson(message: Object, messageLoglevel: string) {
    if (!isNullOrUndefined(this.logLevel)) {
      if (messageLoglevel == this.logLevel) this.ux.logJson(message);
    }
  }
}
