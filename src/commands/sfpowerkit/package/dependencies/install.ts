//Code is basically same from https://github.com/texei/texei-sfdx-plugin
// Just updated it for the revised cli core

import { core, flags, SfdxCommand } from "@salesforce/command";
import { JsonArray, JsonMap } from "@salesforce/ts-types";
import { SfdxProject } from "@salesforce/core";

const spawn = require("child-process-promise").spawn;
const exec = require("child-process-promise").exec;

const packageIdPrefix = "0Ho";
const packageVersionIdPrefix = "04t";
const packageAliasesMap = [];
const defaultWait = 60;

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "install");

export default class Install extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    '$ sfdx sfpowerkit:package:dependencies:install -u MyScratchOrg -v MyDevHub -k "MyPackage1:Key MyPackage3:Key" -b "DEV"'
  ];

  protected static flagsConfig = {
    individualpackage: flags.string({
      char: "p",
      required: false,
      description: "Installs a specific package especially for upgrade scenario"
    }),
    installationkeys: flags.string({
      char: "k",
      required: false,
      description:
        "installation key for key-protected packages (format is packagename:key --> core:key nCino:key vlocity:key to allow some packages without installation key)"
    }),
    branch: flags.string({
      char: "b",
      required: false,
      description: "the package version’s branch"
    }),
    wait: flags.string({
      char: "w",
      required: false,
      description:
        "number of minutes to wait for installation status (also used for publishwait). Default is 10"
    }),
    noprompt: flags.boolean({
      char: "r",
      required: false,
      description:
        "allow Remote Site Settings and Content Security Policy websites to send or receive data without confirmation"
    }),
    updateall: flags.boolean({
      char: "o",
      required: false,
      description:
        "Update all packages even if they are installed in the target org"
    }),
    apexcompileonlypackage: flags.boolean({
      char: "a",
      required: false,
      description:
        "Compile the apex only in the package, by default only the compilation of the apex in the entire org is triggered"
    }),
    createdwithdependency: flags.boolean({
      required: false,
      description:
        "when installing with .LATEST buildnumber, pick the lastest package created with dependencies."
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not require a hub org username
  protected static requiresDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public async run(): Promise<any> {
    const result = { installedPackages: {} };

    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    const username = this.org.getUsername();

    // Getting Project config
    const projectMain = await SfdxProject.resolve();
    const project = await projectMain.retrieveSfdxProjectJson();

    // Getting a list of alias
    const packageAliases = project.get("packageAliases") || {};
    if (typeof packageAliases !== undefined) {
      Object.entries(packageAliases).forEach(([key, value]) => {
        packageAliasesMap[key] = value;
      });
    }

    //Validate Packages  installed in the target org
    let installedpackages = await this.getInstalledPackages(username);

    let individualpackage = this.flags.individualpackage;

    // Getting Package
    const packagesToInstall = [];

    const packageDirectories =
      (project.get("packageDirectories") as JsonArray) || [];

    for (let packageDirectory of packageDirectories) {
      packageDirectory = packageDirectory as JsonMap;

      const dependencies = packageDirectory.dependencies || [];

      if (dependencies && dependencies[0] !== undefined) {
        this.ux.log(
          `\nPackage dependencies found for package directory ${packageDirectory.path}`
        );
        for (const dependency of dependencies as JsonArray) {
          const packageInfo = {} as JsonMap;

          const {
            package: dependentPackage,
            versionNumber
          } = dependency as JsonMap;

          packageInfo.dependentPackage = dependentPackage;

          packageInfo.versionNumber = versionNumber;

          const packageVersionId = await this.getPackageVersionId(
            dependentPackage,
            versionNumber
          );

          packageInfo.packageVersionId = packageVersionId;

          if (individualpackage) {
            if (
              packageInfo.dependentPackage.toString() === individualpackage ||
              packageInfo.packageVersionId.toString() === individualpackage
            ) {
              packagesToInstall.push(packageInfo);
              continue;
            }
          } else {
            if (this.flags.updateall) {
              packagesToInstall.push(packageInfo);
            } else {
              if (!installedpackages.includes(packageVersionId)) {
                packagesToInstall.push(packageInfo);
              }
            }
          }

          this.ux.log(
            `    ${packageInfo.packageVersionId} : ${
              packageInfo.dependentPackage
            }${
              packageInfo.versionNumber === undefined
                ? ""
                : " " + packageInfo.versionNumber
            }`
          );
        }
      } else {
        this.ux.log(
          `\nNo dependencies found for package directory ${packageDirectory.path}`
        );
      }
    }

    if (packagesToInstall.length > 0) {
      // Installing Packages
      let installationKeyMap: Map<string, string> = new Map<string, string>();

      // Getting Installation Key(s)
      let installationKeys = this.flags.installationkeys;
      if (installationKeys) {
        installationKeys = installationKeys.trim();
        installationKeys = installationKeys.split(" ");

        for (let installKey of installationKeys) {
          let packageKeySplit = installKey.split(":");
          if (packageKeySplit.length === 2) {
            installationKeyMap.set(packageKeySplit[0], packageKeySplit[1]);
          } else {
            // Format is not correct, throw an error
            throw new core.SfdxError(
              "Installation Key should have this format: core:key nCino:key vlocity:key"
            );
          }
        }
      }

      this.ux.log("\n");

      for (let packageInfo of packagesToInstall) {
        packageInfo = packageInfo as JsonMap;
        if (
          result.installedPackages.hasOwnProperty(packageInfo.packageVersionId)
        ) {
          this.ux.log(
            `PackageVersionId ${packageInfo.packageVersionId} already installed. Skipping...`
          );
          continue;
        }

        // Split arguments to use spawn
        const args = [];
        args.push("force:package:install");

        // USERNAME
        args.push("--targetusername");
        args.push(`${username}`);

        // PACKAGE ID
        args.push("--package");
        args.push(`${packageInfo.packageVersionId}`);

        // INSTALLATION KEY
        if (installationKeyMap.has(packageInfo.dependentPackage.toString())) {
          let key = installationKeyMap.get(
            packageInfo.dependentPackage.toString()
          );
          args.push("-k");
          args.push(`${key}`);
        }

        // WAIT
        const wait = this.flags.wait ? this.flags.wait.trim() : defaultWait;
        args.push("-w");
        args.push(`${wait}`);
        args.push("-b");
        args.push(`${wait}`);

        // NOPROMPT
        if (this.flags.noprompt) {
          args.push("--noprompt");
        }

        if (this.flags.apexcompileonlypackage) {
          args.push("-a");
          args.push(`package`);
        }

        this.ux.log(
          `Installing package ${packageInfo.packageVersionId} : ${
            packageInfo.dependentPackage
          }${
            packageInfo.versionNumber === undefined
              ? ""
              : " " + packageInfo.versionNumber
          }`
        );

        var startTime = new Date().valueOf();
        await spawn("sfdx", args, { stdio: "inherit" });

        var endTime = new Date().valueOf();

        var timeElapsed = (endTime - startTime) / 1000;

        this.ux.log(
          `Elapsed time in installing package  ${packageInfo.packageVersionId} is ${timeElapsed} seconds`
        );

        this.ux.log("\n");

        result.installedPackages[packageInfo.packageVersionId] = packageInfo;
      }
    } else {
      this.ux.log(
        "\n \n Looks like there is nothing to be updated in this org"
      );
    }

    return { message: result };
  }

  private async getPackageVersionId(name, version) {
    let packageId;

    // Keeping original name so that it can be used in error message if needed
    let packageName = name;

    // TODO: Some stuff are duplicated here, some code don't need to be executed for every package
    // First look if it's an alias
    if (typeof packageAliasesMap[packageName] !== "undefined") {
      packageName = packageAliasesMap[packageName];
    }

    if (packageName.startsWith(packageVersionIdPrefix)) {
      // Package2VersionId is set directly
      packageId = packageName;
    } else if (packageName.startsWith(packageIdPrefix)) {
      if (!version) {
        throw new core.SfdxError(`version number is mandatory for ${name}`);
      }

      // Get Package version id from package + versionNumber
      const vers = version.split(".");
      let query =
        "Select SubscriberPackageVersionId, IsPasswordProtected, IsReleased ";
      query += "from Package2Version ";
      query += `where Package2Id='${packageName}' and MajorVersion=${vers[0]} and MinorVersion=${vers[1]} and PatchVersion=${vers[2]} `;

      // If Build Number isn't set to LATEST, look for the exact Package Version
      if (vers[3] !== "LATEST") {
        query += `and BuildNumber=${vers[3]} `;
      } else if (this.flags.createdwithdependency) {
        query += `and ValidationSkipped = false `;
      }

      // If Branch is specified, use it to filter
      if (this.flags.branch) {
        query += `and Branch='${this.flags.branch.trim()}' `;
      }

      query += "ORDER BY BuildNumber,Createddate DESC Limit 1";

      // Query DevHub to get the expected Package2Version
      const conn = this.hubOrg.getConnection();
      const resultPackageId = (await conn.tooling.query(query)) as any;

      if (resultPackageId.size === 0) {
        // Query returned no result
        const errorMessage = `Unable to find SubscriberPackageVersionId for dependent package ${name}`;
        throw new core.SfdxError(errorMessage);
      } else {
        packageId = resultPackageId.records[0].SubscriberPackageVersionId;
      }
    }

    return packageId;
  }

  private async getInstalledPackages(targetOrg: string) {
    let packages = [];
    let installedPackagesQuery =
      "SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, " +
      "SubscriberPackageVersion.Id, SubscriberPackageVersion.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, " +
      "SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber FROM InstalledSubscriberPackage " +
      "ORDER BY SubscriberPackageId";
    const conn = this.org.getConnection();
    await conn.tooling.query(installedPackagesQuery).then(queryResult => {
      const records = queryResult.records;
      if (records && records.length > 0) {
        this.ux.log(`Installed Packages in the org ${targetOrg}`);
        const output = [];
        records.forEach(record => {
          packages.push(record["SubscriberPackageVersion"]["Id"]);
          output.push({
            name: record["SubscriberPackage"]["Name"],
            package_version_name: record["SubscriberPackageVersion"]["Name"],
            package_version_id: record["SubscriberPackageVersion"]["Id"],
            versionNumber: `${record["SubscriberPackageVersion"]["MajorVersion"]}.${record["SubscriberPackageVersion"]["MinorVersion"]}.${record["SubscriberPackageVersion"]["PatchVersion"]}.${record["SubscriberPackageVersion"]["BuildNumber"]}`
          });
        });
        this.ux.table(output, [
          "name",
          "package_version_name",
          "package_version_id",
          "versionNumber"
        ]);
      }
    });
    return packages;
  }
}
