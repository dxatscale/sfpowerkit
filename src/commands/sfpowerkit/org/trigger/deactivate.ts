import { AnyJson } from "@salesforce/ts-types";
import * as fs from "fs-extra";
import { core, flags } from "@salesforce/command";
import * as rimraf from "rimraf";
import { AsyncResult, DeployResult } from "jsforce";
import { SfdxError } from "@salesforce/core";
import * as xml2js from "xml2js";
import * as util from "util";
// tslint:disable-next-line:ordered-imports
var jsforce = require("jsforce");
var path = require("path");

import { checkRetrievalStatus } from "../../../../utils/checkRetrievalStatus";
import { checkDeploymentStatus } from "../../../../utils/checkDeploymentStatus";
import { extract } from "../../../../utils/extract";
import { zipDirectory } from "../../../../utils/zipDirectory";
import { SFPowerkit } from "../../../../sfpowerkit";
import SFPowerkitCommand from "../../../../sfpowerkitCommand"

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "trigger_deactivate");

export default class Deactivate extends SFPowerkitCommand {
  public connectedapp_consumerKey: string;
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:trigger:deactivate -n AccountTrigger -u sandbox
    Polling for Retrieval Status
    Preparing Deactivation
    Deploying Deactivated ApexTrigger with ID  0Af4Y000003Q7GySAK
    Polling for Deployment Status
    Polling for Deployment Status
    ApexTrigger AccountTrigger deactivated
  `
  ];

  protected static flagsConfig = {
    name: flags.string({
      required: true,
      char: "n",
      description: messages.getMessage("nameFlagDescription")
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

  public async execute(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    //Connect to the org

    //Connect to the org
    await this.org.refreshAuth();
    const conn = this.org.getConnection();
    const apiversion = await conn.retrieveMaxApiVersion();

    let retrieveRequest = {
      apiVersion: apiversion
    };

    //Retrieve Duplicate Rule
    retrieveRequest["singlePackage"] = true;
    retrieveRequest["unpackaged"] = {
      types: { name: "ApexTrigger", members: this.flags.name }
    };
    conn.metadata.pollTimeout = 60;
    let retrievedId;
    await conn.metadata.retrieve(retrieveRequest, function(
      error,
      result: AsyncResult
    ) {
      if (error) {
        return console.error(error);
      }
      retrievedId = result.id;
    });

    let metadata_retrieve_result = await checkRetrievalStatus(
      conn,
      retrievedId,
      !this.flags.json
    );
    if (!metadata_retrieve_result.zipFile)
      throw new SfdxError("Unable to find the requested Trigger");

    //Extract Matching Rule
    var zipFileName = "temp_sfpowerkit/unpackaged.zip";
    fs.mkdirSync("temp_sfpowerkit");
    fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, {
      encoding: "base64"
    });

    await extract(`./temp_sfpowerkit/unpackaged.zip`, "temp_sfpowerkit");
    fs.unlinkSync(zipFileName);
    let resultFile = `temp_sfpowerkit/triggers/${this.flags.name}.trigger-meta.xml`;

    if (fs.existsSync(path.resolve(resultFile))) {
      const parser = new xml2js.Parser({ explicitArray: false });
      const parseString = util.promisify(parser.parseString);

      let retrieve_apextrigger = await parseString(
        fs.readFileSync(path.resolve(resultFile))
      );

      this.ux.log(`Retrieved ApexTrigger : ${this.flags.name}`);

      //Deactivate Rule
      this.ux.log(`Preparing Deactivation`);
      retrieve_apextrigger.ApexTrigger.status = "Inactive";

      let builder = new xml2js.Builder();
      var xml = builder.buildObject(retrieve_apextrigger);
      fs.writeFileSync(resultFile, xml);

      var zipFile = "temp_sfpowerkit/package.zip";
      await zipDirectory("temp_sfpowerkit", zipFile);

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
        `Deploying Deactivated ApexTrigger with ID  ${
          deployId.id
        } to ${this.org.getUsername()}`
      );
      let metadata_deploy_result: DeployResult = await checkDeploymentStatus(
        conn,
        deployId.id
      );

      if (!metadata_deploy_result.success)
        throw new SfdxError(
          `Unable to deploy the deactivated Apex Trigger: ${metadata_deploy_result.details["componentFailures"]["problem"]}`
        );

      this.ux.log(`ApexTrigger ${this.flags.name} deactivated`);
      return 0;
    } else {
      throw new SfdxError("Duplicate Rule not found in the org");
    }
  }
}
