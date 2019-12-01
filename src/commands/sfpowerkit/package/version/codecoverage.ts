import { core, flags, SfdxCommand, Result } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { SFPowerkit } from "../../../../sfpowerkit";
import { LoggerLevel, SfdxError } from "@salesforce/core";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "package_codecoverage"
);

export default class CodeCoverage extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:package:version:codecoverage -u myOrg@example.com -i 04tXXXXXXXXXXXXXXX \n` +
      `$ sfdx sfpowerkit:package:version:codecoverage -u myOrg@example.com -p core -n 1.2.0.45`
  ];

  protected static flagsConfig = {
    package: flags.string({
      required: false,
      char: "p",
      description: messages.getMessage("packageName")
    }),
    versionnumber: flags.string({
      required: false,
      char: "n",
      description: messages.getMessage("packageVersionNumber")
    }),
    versionid: flags.string({
      required: false,
      char: "i",
      description: messages.getMessage("packageVersionId")
    }),
    apiversion: flags.builtin({
      description: messages.getMessage("apiversion")
    }),
    loglevel: flags.enum({
      description: messages.getMessage("loglevel"),
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
        "FATAL"
      ]
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;
  public async run(): Promise<AnyJson> {
    var packageCoverage = new PackageCoverage();

    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    await this.org.refreshAuth();

    const conn = this.org.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    let versionId;
    if (this.flags.versionid) {
      versionId = this.flags.versionid;
    }
    let versionNumber;
    if (this.flags.versionnumber) {
      versionNumber = this.flags.versionnumber;
    }
    let packageName;
    if (this.flags.package) {
      packageName = this.flags.package;
    }

    var whereClause;
    if (versionId) {
      whereClause = `SubscriberPackageVersionId = '${versionId}'`;
    } else if (versionNumber && packageName) {
      let versionNumberList = versionNumber.split(".");
      if (versionNumberList.length === 4) {
        whereClause = `Package2.Name = '${packageName}' AND MajorVersion = ${versionNumberList[0]} AND MinorVersion = ${versionNumberList[1]} AND PatchVersion = ${versionNumberList[2]} AND BuildNumber = ${versionNumberList[3]}`;
      } else {
        throw new SfdxError(
          "Provide complete version number format in major.minor.patch (Beta build)—for example, 1.2.0.5"
        );
      }
    }

    if (!whereClause) {
      throw new SfdxError(
        "Either versionId or versionNumber and packageName is mandatory"
      );
    } else {
      var querystring = `SELECT SubscriberPackageVersionId,Package2Id, Package2.Name,MajorVersion,MinorVersion,PatchVersion,BuildNumber, CodeCoverage, HasPassedCodeCoverageCheck, Name FROM Package2Version WHERE ${whereClause} LIMIT 1`;

      SFPowerkit.log(
        `Retrieving package version details ..........[INPROGRESS]`,
        LoggerLevel.INFO
      );
      const result = (await conn.tooling.query(querystring)) as any;
      if (result && result.size > 0) {
        let record = result.records[0];
        packageCoverage.HasPassedCodeCoverageCheck =
          record.HasPassedCodeCoverageCheck;
        packageCoverage.coverage = record.CodeCoverage
          ? record.CodeCoverage.apexCodeCoveragePercentage
          : 0;
        packageCoverage.packageId = record.Package2Id;
        packageCoverage.packageName = record.Package2.Name;
        packageCoverage.packageVersionId = record.SubscriberPackageVersionId;
        packageCoverage.packageVersionNumber = `${record.MajorVersion}.${record.MinorVersion}.${record.PatchVersion}.${record.BuildNumber}`;

        SFPowerkit.log(
          `Successfully Retrieved the Apex Test Coverage of the package version`,
          LoggerLevel.INFO
        );

        var output = [];
        output.push(packageCoverage);
        this.ux.table(output, [
          "packageName",
          "packageId",
          "packageVersionNumber",
          "packageVersionId",
          "coverage",
          "HasPassedCodeCoverageCheck"
        ]);
      } else {
        throw new SfdxError(
          `Package version doesnot exist, Please check the version details`
        );
      }
    }
    return JSON.stringify(packageCoverage);
  }
}
export class PackageCoverage {
  public coverage: number;
  public packageName: String;
  public packageId: String;
  public packageVersionNumber: String;
  public packageVersionId: String;
  public HasPassedCodeCoverageCheck: Boolean;
}
