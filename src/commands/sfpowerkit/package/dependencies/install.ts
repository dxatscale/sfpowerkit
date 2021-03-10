//Code initially based from https://github.com/texei/texei-sfdx-plugin
//Updated to reflect mono repo (mpd), handle tags, individual package and skip install if already installed scenarios

import { core, flags, SfdxCommand } from "@salesforce/command";
import { JsonArray, JsonMap } from "@salesforce/ts-types";
import { SfdxProject } from "@salesforce/core";
import { loadSFDX } from "../../../../sfdxnode/GetNodeWrapper";
import { sfdx } from "../../../..//sfdxnode/parallel";
import { SFPowerkit, LoggerLevel } from "../../../../sfpowerkit";
import { isNullOrUndefined } from "util";
import { get18DigitSalesforceId } from "./../../../../utils/get18DigitSalesforceId";
let retry = require("async-retry");

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
    '$ sfdx sfpowerkit:package:dependencies:install -u MyScratchOrg -v MyDevHub -k "MyPackage1:Key MyPackage3:Key" -b "DEV"',
  ];

  protected static flagsConfig = {
    individualpackage: flags.string({
      char: "p",
      required: false,
      description:
        "Installs a specific package especially for upgrade scenario",
    }),
    installationkeys: flags.string({
      char: "k",
      required: false,
      description:
        "installation key for key-protected packages (format is packagename:key --> core:key nCino:key vlocity:key to allow some packages without installation key)",
    }),
    branch: flags.string({
      char: "b",
      required: false,
      description:
        "the package version’s branch (format is packagename:branchname --> core:branchname consumer:branchname packageN:branchname)",
    }),
    tag: flags.string({
      char: "t",
      required: false,
      description:
        "the package version’s tag (format is packagename:tag --> core:tag consumer:tag packageN:tag)",
    }),
    wait: flags.string({
      char: "w",
      required: false,
      description:
        "number of minutes to wait for installation status (also used for publishwait). Default is 10",
    }),
    noprompt: flags.boolean({
      char: "r",
      required: false,
      description:
        "allow Remote Site Settings and Content Security Policy websites to send or receive data without confirmation",
    }),
    updateall: flags.boolean({
      char: "o",
      required: false,
      description:
        "update all packages even if they are installed in the target org",
    }),
    apexcompileonlypackage: flags.boolean({
      char: "a",
      required: false,
      description:
        "compile the apex only in the package, by default only the compilation of the apex in the entire org is triggered",
    }),
    usedependencyvalidatedpackages: flags.boolean({
      required: false,
      description:
        "use dependency validated packages that matches the version number schema provide",
    }),
    filterpaths: flags.array({
      char: "f",
      required: false,
      description:
        "in a mono repo project, filter packageDirectories using path and install dependent packages only for the specified path",
    }),
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ],
    }),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not require a hub org username
  protected static requiresDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  private tagMap: Map<string, string>;
  private branchMap: Map<string, string>;

  public async run(): Promise<any> {
    const result = { installedPackages: {} };

    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    const username = this.org.getUsername();

    // Getting Project config
    const projectMain = await SfdxProject.resolve();
    const project = await projectMain.retrieveSfdxProjectJson();

    // Getting a list of alias
    const packageAliases = project.get("packageAliases") || {};
    Object.entries(packageAliases).forEach(([key, value]) => {
      packageAliasesMap[key] = value;
    });

    //Validate Packages  installed in the target org
    let installedpackages = [];
    try {
      installedpackages = await this.getInstalledPackages(username);
    } catch (error) {
      SFPowerkit.log(
        "Unable to retrieve the packages installed in the org, Proceeding",
        LoggerLevel.WARN
      );
    }

    if (isNullOrUndefined(installedpackages) || installedpackages.length == 0) {
      this.flags.updateall = true;
      installedpackages = [];
    }

    let individualpackage = this.flags.individualpackage;

    const packageDirectories =
      (project.get("packageDirectories") as JsonArray) || [];

    // get branch filter
    this.branchMap = new Map<string, string>();
    if (this.flags.branch) {
      this.branchMap = this.parseKeyValueMapfromString(
        this.flags.branch,
        "Branch",
        "core:branchname consumer:branchname packageN:branchname"
      );
    }

    //get tag filter
    this.tagMap = new Map<string, string>();
    if (this.flags.tag) {
      this.tagMap = this.parseKeyValueMapfromString(
        this.flags.tag,
        "Tag",
        "core:tag consumer:tag packageN:tag"
      );
    }

    // get all packages in the mono repo project
    let monoRepoPackages = [];
    for (let packageDirectory of packageDirectories) {
      packageDirectory = packageDirectory as JsonMap;
      if (
        packageDirectory.path &&
        packageDirectory.package &&
        !monoRepoPackages.includes(packageDirectory.package.toString())
      ) {
        monoRepoPackages.push(packageDirectory.package.toString());
      }
    }

    // Getting Package
    let packagesToInstall: Map<String, JsonMap> = new Map<String, JsonMap>();

    for (let packageDirectory of packageDirectories) {
      packageDirectory = packageDirectory as JsonMap;

      const dependencies = packageDirectory.dependencies || [];

      if (
        this.flags.filterpaths &&
        this.flags.filterpaths.length > 0 &&
        !this.flags.filterpaths.includes(packageDirectory.path.toString())
      ) {
        continue;
      }

      if (dependencies && dependencies[0] !== undefined) {
        this.ux.log(
          `\nPackage dependencies found for package directory ${packageDirectory.path}`
        );
        for (const dependency of dependencies as JsonArray) {
          let packageInfo = {} as JsonMap;

          const { package: packageName, versionNumber } = dependency as JsonMap;

          packageInfo.packageName = packageName;

          packageInfo.versionNumber = versionNumber;

          if (
            !individualpackage &&
            !this.flags.updateall &&
            monoRepoPackages.includes(packageInfo.packageName)
          ) {
            continue;
          }

          let packageVersionDetail: {
            versionId;
            versionNumber;
          } = await this.getPackageVersionDetails(packageName, versionNumber);

          packageInfo.packageVersionId = packageVersionDetail.versionId;
          packageInfo.versionNumber = packageVersionDetail.versionNumber;

          if (individualpackage) {
            if (
              packageInfo.packageName.toString() === individualpackage ||
              packageInfo.packageVersionId.toString() === individualpackage
            ) {
              packagesToInstall.set(
                packageInfo.packageVersionId.toString(),
                packageInfo
              );
            }
          } else if (this.flags.updateall) {
            packagesToInstall.set(
              packageInfo.packageVersionId.toString(),
              packageInfo
            );
          } else if (
            !installedpackages.includes(packageInfo.packageVersionId)
          ) {
            packagesToInstall.set(
              packageInfo.packageVersionId.toString(),
              packageInfo
            );
          }

          this.ux.log(
            `    ${packageInfo.packageVersionId} : ${packageInfo.packageName}${
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

    if (packagesToInstall.size > 0) {
      //Load SFDX
      loadSFDX();

      // Installing Packages
      let installationKeyMap: Map<string, string> = new Map<string, string>();

      // Getting Installation Key(s)
      if (this.flags.installationkeys) {
        installationKeyMap = this.parseKeyValueMapfromString(
          this.flags.installationkeys,
          "Installation Key",
          "core:key nCino:key vlocity:key"
        );
      }

      let packagesToInstallArray = Array.from(packagesToInstall.values());

      this.ux.log(
        `\nThe following dependencies will be installed in the org ${username} in below order`
      );
      this.ux.table(packagesToInstallArray, [
        "packageName",
        "versionNumber",
        "packageVersionId",
      ]);

      this.ux.log(`\n`);

      for (let packageInfo of packagesToInstallArray) {
        packageInfo = packageInfo as JsonMap;
        if (
          result.installedPackages.hasOwnProperty(
            packageInfo.packageVersionId.toString()
          )
        ) {
          this.ux.log(
            `PackageVersionId ${packageInfo.packageVersionId} already installed. Skipping...`
          );
          continue;
        }

        //Build up options
        let flags = {};
        // USERNAME
        flags["targetusername"] = username;
        // PACKAGE ID
        flags["package"] = packageInfo.packageVersionId;

        // INSTALLATION KEY
        if (
          installationKeyMap &&
          installationKeyMap.has(packageInfo.packageName.toString())
        ) {
          let key = installationKeyMap.get(packageInfo.packageName.toString());
          flags["installationkey"] = key;
        }

        // WAIT
        const wait = this.flags.wait ? this.flags.wait.trim() : defaultWait;
        flags["wait"] = wait;
        flags["publishwait"] = wait;

        if (this.flags.apexcompileonlypackage) {
          flags["apexcompile"] = "package";
        }

        let opts = [];
        // NOPROMPT
        if (this.flags.noprompt) {
          opts.push("--noprompt");
        }

        let startTime = new Date().valueOf();

        this.ux.log(
          `Installing package ${packageInfo.packageVersionId} : ${
            packageInfo.packageName
          }${
            packageInfo.versionNumber === undefined
              ? ""
              : " " + packageInfo.versionNumber
          }`
        );

        await sfdx.force.package.install(flags, opts);

        var endTime = new Date().valueOf();

        var timeElapsed = (endTime - startTime) / 1000;

        this.ux.log(
          `Elapsed time in installing package  ${packageInfo.packageVersionId} is ${timeElapsed} seconds`
        );

        this.ux.log("\n");

        result.installedPackages[
          packageInfo.packageVersionId.toString()
        ] = packageInfo;
      }
    } else {
      this.ux.log(
        "\n \n Looks like there is nothing to be updated in this org"
      );
    }

    return { message: result };
  }

  private async getPackageVersionDetails(
    name,
    version
  ): Promise<{ versionId; versionNumber }> {
    let packageDetail: { versionId; versionNumber };

    // Keeping original name so that it can be used in error message if needed
    let packageName = name;

    // TODO: Some stuff are duplicated here, some code don't need to be executed for every package
    // First look if it's an alias
    if (packageAliasesMap[packageName]) {
      packageName = packageAliasesMap[packageName];
    }

    if (packageName.startsWith(packageVersionIdPrefix)) {
      // Package2VersionId is set directly
      packageDetail = {
        versionId: get18DigitSalesforceId(packageName),
        versionNumber: version,
      };
    } else if (packageName.startsWith(packageIdPrefix)) {
      if (!version) {
        throw new core.SfdxError(`version number is mandatory for ${name}`);
      }

      // Get Package version id from package + versionNumber
      const vers = version.split(".");
      let query =
        "Select SubscriberPackageVersionId, IsPasswordProtected, IsReleased, MajorVersion, MinorVersion, PatchVersion,BuildNumber ";
      query += "from Package2Version ";
      query += `where Package2Id='${packageName}' and MajorVersion=${vers[0]} and MinorVersion=${vers[1]} and PatchVersion=${vers[2]} `;

      // If Build Number isn't set to LATEST, look for the exact Package Version
      if (vers[3] !== "LATEST") {
        query += `and BuildNumber=${vers[3]} `;
      } else if (this.flags.usedependencyvalidatedpackages) {
        query += `and ValidationSkipped = false `;
      }

      // If Branch is specified, use it to filter
      if (this.flags.branch && this.branchMap.has(name)) {
        query += `and Branch='${this.branchMap.get(name).trim()}' `;
      }

      // If tag is specified, use it to filter
      if (this.flags.tag && this.tagMap.has(name)) {
        query += `and Tag='${this.tagMap.get(name).trim()}' `;
      }

      query += "ORDER BY BuildNumber DESC, createddate DESC Limit 1";

      // Query DevHub to get the expected Package2Version
      const conn = this.hubOrg.getConnection();
      const resultPackageId = (await conn.tooling.query(query)) as any;

      if (resultPackageId.size === 0) {
        // Query returned no result
        const errorMessage = `Unable to find SubscriberPackageVersionId for dependent package ${name}`;
        throw new core.SfdxError(errorMessage);
      } else {
        let versionId = resultPackageId.records[0].SubscriberPackageVersionId;
        let versionNumber = `${resultPackageId.records[0].MajorVersion}.${resultPackageId.records[0].MinorVersion}.${resultPackageId.records[0].PatchVersion}.${resultPackageId.records[0].BuildNumber}`;
        packageDetail = { versionId: versionId, versionNumber: versionNumber };
      }
    }

    return packageDetail;
  }

  private async getInstalledPackages(targetOrg: string) {
    let packages = [];
    let installedPackagesQuery =
      "SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, " +
      "SubscriberPackageVersion.Id, SubscriberPackageVersion.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, " +
      "SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber FROM InstalledSubscriberPackage " +
      "ORDER BY SubscriberPackageId";
    const conn = this.org.getConnection();

    return await retry(
      async (bail) => {
        SFPowerkit.log("QUERY:" + installedPackagesQuery, LoggerLevel.TRACE);

        const results = (await conn.tooling.query(
          installedPackagesQuery
        )) as any;

        const records = results.records;
        if (records && records.length > 0) {
          this.ux.log(`Installed Packages in the org ${targetOrg}`);
          const output = [];
          records.forEach((record) => {
            packages.push(record["SubscriberPackageVersion"]["Id"]);
            output.push({
              name: record["SubscriberPackage"]["Name"],
              package_version_name: record["SubscriberPackageVersion"]["Name"],
              package_version_id: record["SubscriberPackageVersion"]["Id"],
              versionNumber: `${record["SubscriberPackageVersion"]["MajorVersion"]}.${record["SubscriberPackageVersion"]["MinorVersion"]}.${record["SubscriberPackageVersion"]["PatchVersion"]}.${record["SubscriberPackageVersion"]["BuildNumber"]}`,
            });
          });
          this.ux.table(output, [
            "name",
            "package_version_name",
            "package_version_id",
            "versionNumber",
          ]);

          return packages;
        }
      },
      { retries: 3, minTimeout: 3000 }
    );
  }
  private parseKeyValueMapfromString(
    request: string,
    item: string,
    format: string
  ) {
    let response: Map<string, string> = new Map<string, string>();

    request = request.trim();
    let requestList = request.split(" ");

    for (let element of requestList) {
      let packageNameWithValue = element.split(":");
      if (packageNameWithValue.length === 2) {
        response.set(packageNameWithValue[0], packageNameWithValue[1]);
      } else {
        // Format is not correct, throw an error
        throw new core.SfdxError(
          `Error in parsing ${item}, format should be: ${format}`
        );
      }
    }

    return response;
  }
}
