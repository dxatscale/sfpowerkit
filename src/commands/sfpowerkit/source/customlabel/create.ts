import { core, flags } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as fs from "fs-extra";
import * as rimraf from "rimraf";
import { zipDirectory } from "../../../../utils/zipDirectory";
import { AsyncResult, DeployResult } from "jsforce";
import { checkDeploymentStatus } from "../../../../utils/checkDeploymentStatus";
import { SfdxError } from "@salesforce/core";
import { SFPowerkit } from "../../../../sfpowerkit";
import SFPowerkitCommand from "../../../../sfpowerkitCommand";

const spawn = require("child-process-promise").spawn;

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "source_customlabel_create"
);

export default class Create extends SFPowerkitCommand {
  public customlabel_fullname: string;
  public customlabel_categories: string;
  public customlabel_language: string = "en_US";
  public customlabel_protected: boolean = false;
  public customlabel_shortdescription: string;
  public customlabel_value: string;

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:customlabel:create -u fancyScratchOrg1 -n FlashError -v "Memory leaks aren't for the faint hearted" -s "A flashing error --package core"
  Deployed CustomLabel FlashError in target org with core_  prefix, You may now pull and utilize the customlabel:reconcile command
  `
  ];

  protected static flagsConfig = {
    fullname: flags.string({
      required: true,
      char: "n",
      description: messages.getMessage("fullnameFlagDescription")
    }),
    value: flags.string({
      required: true,
      char: "v",
      description: messages.getMessage("valueFlagDescription")
    }),
    categories: flags.string({
      required: false,
      char: "c",
      description: messages.getMessage("categoriesFlagDescription")
    }),
    language: flags.string({
      required: false,
      char: "l",
      description: messages.getMessage("languageFlagDescription")
    }),
    protected: flags.string({
      required: false,
      char: "p",
      description: messages.getMessage("protectedFlagDescription")
    }),
    shortdescription: flags.string({
      required: true,
      char: "s",
      description: messages.getMessage("shortdescriptionFlagDescription")
    }),
    package: flags.string({
      required: false,
      description: messages.getMessage("packageFlagDescription")
    }),
    ignorepackage: flags.boolean({
      char: "i",
      default: false,
      description: messages.getMessage("ignorepackageFlagDescription")
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
        "FATAL"
      ]
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public async execute(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    await this.org.refreshAuth();

    const conn = this.org.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    // Gives first value in url after https protocol
    const packageName = this.flags.package;

    this.customlabel_fullname = this.flags.ignorepackage
      ? this.flags.fullname
      : `${packageName}_${this.flags.fullname}`;
    this.customlabel_value = this.flags.value;

    this.customlabel_categories = this.flags.categories || null;
    this.customlabel_language =
      this.flags.language || this.customlabel_language;
    this.customlabel_protected =
      this.flags.language || this.customlabel_protected;

    this.customlabel_shortdescription = this.flags.shortdescription;

    var customlabels_metadata: string = `<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
    <labels>
        <fullName>${this.customlabel_fullname}</fullName>${
      this.customlabel_categories != null
        ? `\n<categories>${this.customlabel_categories}</categories>`
        : ""
    }
        <shortDescription>${
          this.customlabel_shortdescription
        }</shortDescription>
        <language>${this.customlabel_language}</language>
        <protected>${this.customlabel_protected.toString()}</protected>
        <value>${this.customlabel_value}</value>
    </labels>
</CustomLabels>`;

    var package_xml: string = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>*</members>
        <name>CustomLabel</name>
    </types>
    <version>${this.flags.apiversion}</version>
</Package>`;

    let targetmetadatapath =
      "temp_sfpowerkit/mdapi/labels/CustomLabels.labels-meta.xml";
    fs.outputFileSync(targetmetadatapath, customlabels_metadata);
    let targetpackagepath = "temp_sfpowerkit/mdapi/package.xml";
    fs.outputFileSync(targetpackagepath, package_xml);

    var zipFile = "temp_sfpowerkit/package.zip";
    await zipDirectory("temp_sfpowerkit/mdapi", zipFile);

    //Deploy Rule
    conn.metadata.pollTimeout = 300;
    let deployId: AsyncResult;

    var zipStream = fs.createReadStream(zipFile);
    await conn.metadata.deploy(
      zipStream,
      { rollbackOnError: true, singlePackage: true },
      function(error, result: AsyncResult) {
        if (error) {
          return console.error(error);
        }
        deployId = result;
      }
    );

    this.ux.log(
      `Deploying Custom Label with ID  ${
        deployId.id
      } to ${this.org.getUsername()}`
    );
    let metadata_deploy_result: DeployResult = await checkDeploymentStatus(
      conn,
      deployId.id
    );

    if (metadata_deploy_result.success) {
      if (!this.flags.ignorepackage)
        this.ux.log(
          `Deployed  Custom Label ${this.customlabel_fullname} in target org with ${this.flags.package}_  prefix, You may now pull and utilize the customlabel:reconcile command `
        );
      else if (metadata_deploy_result.success)
        this.ux.log(
          `Deployed  Custom Label ${this.customlabel_fullname} in target org`
        );
    } else {
      throw new SfdxError(
        `Unable to deploy the Custom Label: ${metadata_deploy_result.details["componentFailures"]["problem"]}`
      );
    }

    rimraf.sync("temp_sfpowerkit");

    return {
      "customlabel.fullname": this.customlabel_fullname
    };
  }
}
