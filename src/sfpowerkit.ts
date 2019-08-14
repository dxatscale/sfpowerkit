import { UX } from "@salesforce/command";
import { SfdxProject } from "@salesforce/core";

export class SfPowerKit {
  static ux: UX;
  private static defaultFolder: string;
  private static projectDirectories: string[];
  private static pluginConfig;

  public static async getProjectDirectories() {
    if (!SfPowerKit.projectDirectories) {
      SfPowerKit.projectDirectories = [];
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();

      let packages = (project.get("packageDirectories") as any[]) || [];
      packages.forEach(element => {
        SfPowerKit.projectDirectories.push(element.path);
        if (element.default) {
          SfPowerKit.defaultFolder = element.path;
        }
      });
    }
    return SfPowerKit.projectDirectories;
  }
  public static async getDefaultFolder() {
    if (!SfPowerKit.defaultFolder) {
      await SfPowerKit.getProjectDirectories();
    }
    return SfPowerKit.defaultFolder;
  }
  public static setDefaultFolder(defaultFolder: string) {
    SfPowerKit.defaultFolder = defaultFolder;
  }

  public static async getConfig() {
    if (!SfPowerKit.pluginConfig) {
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();
      let plugins = project.get("plugins");
      let sfpowerkitConfig = plugins["sfpowerkit"];
      SfPowerKit.pluginConfig = sfpowerkitConfig || {};
    }
    return SfPowerKit.pluginConfig;
  }
}
