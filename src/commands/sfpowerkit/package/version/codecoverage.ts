import { core, flags } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { SFPowerkit } from "../../../../sfpowerkit";
import { SfdxError } from "@salesforce/core";
import PackageVersionCoverage from "../../../../impl/package/version/packageVersionCoverage";
import SFPowerkitCommand from "../../../../sfpowerkitCommand";
// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "package_codecoverage"
);

export default class CodeCoverage extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:package:version:codecoverage -v myOrg@example.com -i 04tXXXXXXXXXXXXXXX \n`,
    `$ sfdx sfpowerkit:package:version:codecoverage -v myOrg@example.com -i 04tXXXXXXXXXXXXXXX,04tXXXXXXXXXXXXXXX,04tXXXXXXXXXXXXXXX \n`,
    `$ sfdx sfpowerkit:package:version:codecoverage -v myOrg@example.com -p core -n 1.2.0.45 \n`,
    `$ sfdx sfpowerkit:package:version:codecoverage -v myOrg@example.com -p 0HoXXXXXXXXXXXXXXX -n 1.2.0.45`
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
    versionid: flags.array({
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
  protected static requiresDevhubUsername = true;
  public async execute(): Promise<AnyJson> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    await this.hubOrg.refreshAuth();

    const conn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    let versionId = [];
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

    let packageVersionCoverageImpl: PackageVersionCoverage = new PackageVersionCoverage();

    const result = (await packageVersionCoverageImpl.getCoverage(
      versionId,
      versionNumber,
      packageName,
      conn
    )) as any;

    this.ux.table(result, [
      "packageName",
      "packageId",
      "packageVersionNumber",
      "packageVersionId",
      "coverage",
      "HasPassedCodeCoverageCheck"
    ]);
    return result;
  }
}
