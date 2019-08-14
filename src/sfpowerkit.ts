import { UX } from "@salesforce/command";
import { SfdxProject } from "@salesforce/core";

export class SfPowerKit {
  static ux: UX;
  static defaultFolder: string;
  private static pluginConfig;
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
