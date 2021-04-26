import { core, flags, SfdxCommand } from "@salesforce/command";
import { Connection } from "@salesforce/core";
import * as fs from "fs-extra";

const packageIdPrefix = "0Ho";
const packageVersionIdPrefix = "04t";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "dependency_versionlist"
);

export default class List extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    "$ sfdx sfpowerkit:package:dependencies:list -v MyDevHub -s src/dreamhouse",
    "$ sfdx sfpowerkit:package:dependencies:list -v MyDevHub --updateproject",
    "$ sfdx sfpowerkit:package:dependencies:list -v MyDevHub -s --usedependencyvalidatedpackages",
  ];

  protected static flagsConfig = {
    filterpaths: flags.array({
      char: "p",
      required: false,
      description: messages.getMessage("filterpathsDescription"),
    }),
    updateproject: flags.boolean({
      char: "w",
      required: false,
      description: messages.getMessage("updateprojectDescription"),
    }),
    usedependencyvalidatedpackages: flags.boolean({
      required: false,
      description: messages.getMessage(
        "usedependencyvalidatedpackagesDescription"
      ),
    }),
  };

  // Comment this out if your command does not require a hub org username
  protected static requiresDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public async run(): Promise<any> {
    const conn = this.hubOrg.getConnection();
    let projectConfig = JSON.parse(
      fs.readFileSync("sfdx-project.json", "utf8")
    );

    let filterpaths = [];
    if (this.flags.filterpaths) {
      this.flags.filterpaths.forEach((path) => {
        filterpaths.push(path.split("\\").join("/"));
      });
    }

    for (let packageDirectory of projectConfig.packageDirectories) {
      if (
        filterpaths.length == 0 ||
        filterpaths.includes(packageDirectory.path)
      ) {
        if (
          packageDirectory.dependencies &&
          packageDirectory.dependencies[0] !== undefined
        ) {
          this.ux.log(
            `Package dependencies for the given package directory ${packageDirectory.path}`
          );
          for (let dependency of packageDirectory.dependencies) {
            if (projectConfig.packageAliases[dependency.package]) {
              await this.getPackageVersionDetails(
                conn,
                dependency,
                projectConfig.packageAliases
              );

              this.ux.log(
                `    ${dependency.versionId} : ${dependency.package}${
                  dependency.versionNumber === undefined
                    ? ""
                    : " " + dependency.versionNumber
                }`
              );
            } else {
              this.ux.warn(
                `Alias for Package ${dependency.package} is not found in packageAliases section in sfdx-project.json, Please check and retry`
              );
            }
          }
        } else {
          this.ux.log(
            `\nNo dependencies found for package directory ${packageDirectory.path}`
          );
        }
      }
    }

    if (this.flags.updateproject) {
      fs.writeFileSync(
        "sfdx-project.json",
        JSON.stringify(
          projectConfig,
          (key: string, value: any) => {
            if (key == "versionId") return undefined;
            else return value;
          },
          2
        )
      );
    }

    return projectConfig;
  }

  private async getPackageVersionDetails(
    conn: Connection,
    dependency: any,
    packageAliases: any
  ) {
    let packageId = packageAliases[dependency.package];
    if (packageId.startsWith(packageVersionIdPrefix)) {
      // Package2VersionId is set directly
      dependency["versionId"] = packageId;
    } else if (packageId.startsWith(packageIdPrefix)) {
      if (!dependency.versionNumber) {
        throw new core.SfdxError(
          `version number is mandatory for ${dependency.package}`
        );
      }

      // Get Package version id from package + versionNumber
      const vers = dependency.versionNumber.split(".");
      this.validateVersionNumber(dependency.package,vers)
      let query =
        "Select SubscriberPackageVersionId, IsPasswordProtected, IsReleased, MajorVersion, MinorVersion, PatchVersion,BuildNumber ";
      query += "from Package2Version ";
      query += `where Package2Id='${packageId}' and MajorVersion=${vers[0]} and MinorVersion=${vers[1]} and PatchVersion=${vers[2]} `;

      // If Build Number isn't set to LATEST, look for the exact Package Version
      if (vers.length === 4 && vers[3] !== "LATEST" && typeof(vers[3]) === 'number') {
        query += `and BuildNumber=${vers[3]} `;
      } else if (this.flags.usedependencyvalidatedpackages) {
        query += `and ValidationSkipped = false `;
      }

      query += "ORDER BY BuildNumber DESC, createddate DESC Limit 1";

      // Query DevHub to get the expected Package2Version
      const resultPackageId = (await conn.tooling.query(query)) as any;

      if (resultPackageId.size === 0) {
        // Query returned no result
        const errorMessage = `Unable to find package ${
          dependency.package
        } of version ${
          dependency.versionNumber
        } in devhub ${this.hubOrg.getUsername()}. Are you sure it is created yet?`;
        throw new core.SfdxError(errorMessage);
      } else {
        let versionId = resultPackageId.records[0].SubscriberPackageVersionId;
        let versionNumber = `${resultPackageId.records[0].MajorVersion}.${resultPackageId.records[0].MinorVersion}.${resultPackageId.records[0].PatchVersion}.${resultPackageId.records[0].BuildNumber}`;
        dependency["versionId"] = versionId;
        dependency["versionNumber"] = versionNumber;
      }
    }
  }
  private validateVersionNumber(packageName,versionParts){
    if(!(versionParts.length > 1)){
      throw new core.SfdxError(`Invalid dependency version number ${versionParts.join('.')} for package ${packageName}. Valid format is 1.0.0.1 (or) 1.0.0.LATEST`);
    }
    else if((versionParts.length === 4 && versionParts[3] === 'NEXT')){
      throw new core.SfdxError(`Invalid dependency version number ${versionParts.join('.')} for package ${packageName}, NEXT is not allowed. Valid format is 1.0.0.1 (or) 1.0.0.LATEST`);
    }
  }
}
