import path from "path";
import fs from "fs-extra";

export class DXProjectManifestUtils {
  private sfdxProjectManifestJSON: any;

  public constructor(private projectFolder: string) {}

  public removePackagesNotInDirectory(): void {
    //Validate projectJson Path
    let sfdxProjectManifestPath = path.join(
      this.projectFolder,
      "sfdx-project.json"
    );

    if (!fs.existsSync(sfdxProjectManifestPath))
      throw new Error(
        `sfdx-project.json doesn't exist at ${sfdxProjectManifestPath}`
      );

    // Read sfdx-projec.json
    const sfdxProjectManifest = fs.readFileSync(
      sfdxProjectManifestPath,
      "utf8"
    );
    this.sfdxProjectManifestJSON = JSON.parse(sfdxProjectManifest);

    //Filter sfdx-project.json of unwanted directories
    this.sfdxProjectManifestJSON.packageDirectories = this.sfdxProjectManifestJSON.packageDirectories.filter(
      el => this.isElementExists(el)
    );

    //write back sfdx-project.json back
    fs.writeJSONSync(sfdxProjectManifestPath, this.sfdxProjectManifestJSON);
  }

  private isElementExists(element) {
    return fs.existsSync(path.join(this.projectFolder, element.path));
  }
}
