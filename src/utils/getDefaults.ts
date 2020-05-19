import * as fs from "fs-extra";
import * as path from "path";

export default class GetDefaults {
  public static defaultConfig: any;
  public static init() {
    let resourcePath = path.join(
      __dirname,
      "..",
      "..",
      "resources",
      "default-config.json"
    );
    let fileData = fs.readFileSync(resourcePath, "utf8");
    this.defaultConfig = JSON.parse(fileData);
  }
  public static getApiVersion() {
    return this.defaultConfig.apiversion;
  }
}
