import { AnyJson } from "@salesforce/ts-types";
import * as fs from "fs-extra";
import {  flags } from "@salesforce/command";
import SFPowerkitCommand from "../../../../sfpowerkitCommand";
import * as rimraf from "rimraf";
import { AsyncResult } from "jsforce";
import { Messages, SfdxError } from "@salesforce/core";
import * as xml2js from "xml2js";
import * as util from "util";
// tslint:disable-next-line:ordered-imports
let path = require("path");
import { checkRetrievalStatus } from "../../../../utils/checkRetrievalStatus";
import { extract } from "../../../../utils/extract";
import getDefaults from "../../../../utils/getDefaults";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "sfpowerkit",
  "connectedapp_retrieve"
);

export default class Retrieve extends SFPowerkitCommand {
  public connectedapp_consumerKey: string;
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:connectedapp:retrieve -n AzurePipelines -u azlam@sfdc.com 
  Retrived AzurePipelines Consumer Key : XSD21Sd23123w21321
  `
  ];

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  protected static flagsConfig = {
    name: flags.string({
      required: true,
      char: "n",
      description: messages.getMessage("nameFlagDescription")
    })
  };

  public async execute(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");
    let retrieveRequest = {
      apiVersion: getDefaults.getApiVersion()
    };

    retrieveRequest["singlePackage"] = true;
    retrieveRequest["unpackaged"] = {
      types: { name: "ConnectedApp", members: this.flags.name }
    };

    // if(!this.flags.json)
    // this.ux.logJson(retrieveRequest);

    await this.org.refreshAuth();

    const conn = this.org.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    retrieveRequest.apiVersion = this.flags.apiversion;

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

    // if(!this.flags.json)
    // console.log(retrievedId);

    let metadata_retrieve_result = await checkRetrievalStatus(
      conn,
      retrievedId,
      !this.flags.json
    );
    if (!metadata_retrieve_result.zipFile)
      throw new SfdxError("Unable to find the requested ConnectedApp");

    var zipFileName = "temp_sfpowerkit/unpackaged.zip";

    fs.mkdirSync("temp_sfpowerkit");
    fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, {
      encoding: "base64"
    });

    await extract(`./temp_sfpowerkit/unpackaged.zip`, "temp_sfpowerkit");

    let resultFile = `temp_sfpowerkit/connectedApps/${this.flags.name}.connectedApp`;
    // if(!this.flags.json)
    // this.ux.log(`Checking for file ${resultFile}`);

    // this.ux.log(path.resolve(resultFile));
    let retrieved_connectedapp;

    if (fs.existsSync(path.resolve(resultFile))) {
      const parser = new xml2js.Parser({ explicitArray: false });
      const parseString = util.promisify(parser.parseString);

      retrieved_connectedapp = await parseString(
        fs.readFileSync(path.resolve(resultFile))
      );
      // if(!this.flags.json)
      // this.ux.logJson(retrieved_connectedapp);
      this.ux.log(
        `Retrieved ConnectedApp Succesfully  with Consumer Key : ${retrieved_connectedapp.ConnectedApp.oauthConfig.consumerKey}`
      );
      return { connectedapp: retrieved_connectedapp.ConnectedApp };
    } else {
      throw new SfdxError("Unable to process");
    }
  }
}
