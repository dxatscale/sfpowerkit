import { AnyJson } from "@salesforce/ts-types";
import fs from "fs-extra";
import { core, flags, SfdxCommand } from "@salesforce/command";
import rimraf = require("rimraf");
import {
  RetrieveResultLocator,
  AsyncResult,
  Callback,
  AsyncResultLocator,
  Connection,
  RetrieveResult,
  SaveResult,
  DeployResult
} from "jsforce";
import { AsyncResource } from "async_hooks";
import { SfdxError } from "@salesforce/core";
import xml2js = require("xml2js");
import util = require("util");
// tslint:disable-next-line:ordered-imports
var jsforce = require("jsforce");
var path = require("path");
import { checkRetrievalStatus } from "../../../../utils/checkRetrievalStatus";
import { checkDeploymentStatus } from "../../../../utils/checkDeploymentStatus";
import { extract } from "../../../../utils/extract";
import { zipDirectory } from "../../../../utils/zipDirectory";
import { getFilesInDirectory } from "../../../../utils/searchFilesInDirectory";
// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "email_updatelink");

export default class Updatelink extends SfdxCommand {
  public connectedapp_consumerKey: string;
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:email:updatelink -n "sampleFolder/sample_email" -t "https://www.test.salesforce.com" -r "https://www.login.salesforce.com" -u sandbox
    Polling for Retrieval Status
    --------------retrieved emails from the org------------------
    temp_sfpowerkitemail/sampleFolder/sample_email.email
    temp_sfpowerkit/email/sampleFolder/sample_email.email-meta.xml
    -----------------------------------------------------------------
    Updated link in:         temp_sfpowerkit/email/sampleFolder/sample_email.email
    Updated link in:         temp_sfpowerkit/emailsampleFolder/sample_email.email-meta.xml
    Deploying Email templates with ID  0Af0w000007HU7FCAW to sample.user@example.com
    Polling for Deployment Status
    Email templates updated successfully.
  `
  ];

  protected static flagsConfig = {
    name: flags.array({
      required: false,
      char: "n",
      description: messages.getMessage("nameFlagDescription")
    }),
    targetlink: flags.string({
      required: false,
      char: "t",
      description: messages.getMessage("targetlinkFlagDescription")
    }),
    replacelink: flags.string({
      required: false,
      char: "r",
      description: messages.getMessage("replacelinkFlagDescription")
    }),
    jsonpath: flags.string({
      required: false,
      char: "j",
      description: messages.getMessage("jsonpathDescription")
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");

    //Connect to the org
    await this.org.refreshAuth();
    const conn = this.org.getConnection();
    const apiversion = await conn.retrieveMaxApiVersion();

    let retrieveRequest = {
      apiVersion: apiversion
    };

    //check required params
    if (!this.flags.name && !this.flags.jsonpath) {
      throw new SfdxError(
        `Required falgs are missing, specifiy either name or jsonpath.`
      );
    } else if (
      this.flags.name &&
      (!this.flags.targetlink || !this.flags.replacelink)
    ) {
      throw new SfdxError(
        `Required falgs are missing, specifiy targetlink and replacelink when name is passed.`
      );
    }
    //set email temaplate in package.xml
    let emailName = [];
    if (this.flags.name) {
      emailName = this.flags.name;
    }
    let target = "";
    if (this.flags.targetlink) {
      target = this.flags.targetlink;
    }
    let replace = "";
    if (this.flags.replacelink) {
      replace = this.flags.replacelink;
    }

    let jsonSchemePath = "";
    let requestedEmails: any[];
    if (this.flags.jsonpath) {
      jsonSchemePath = this.flags.jsonpath;
      if (!fs.existsSync(path.resolve(jsonSchemePath)))
        throw new SfdxError(
          `no such file or directory, open ${jsonSchemePath}`
        );

      let jsonScheme = fs.readFileSync(jsonSchemePath);
      requestedEmails = JSON.parse(jsonScheme.toString());
      requestedEmails.forEach(emailTemp => {
        emailName.push(emailTemp.name);
      });
    }

    //Retrieve Duplicate Rule
    retrieveRequest["singlePackage"] = true;
    retrieveRequest["unpackaged"] = {
      types: { name: "EmailTemplate", members: emailName }
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
      retrievedId
    );
    if (!metadata_retrieve_result.zipFile)
      throw new SfdxError("Unable to find the requested Email Template");

    //Extract Matching Rule
    var zipFileName = "temp_sfpowerkit/unpackaged.zip";
    fs.mkdirSync("temp_sfpowerkit");
    fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, {
      encoding: "base64"
    });
    await extract("temp_sfpowerkit");
    fs.unlinkSync(zipFileName);

    let resultFilePath = `temp_sfpowerkit/email/`;
    if (fs.existsSync(path.resolve(resultFilePath))) {
      let emailTemplates: any[] = getFilesInDirectory(resultFilePath, ".email");

      let textEmailTemplates: any[] = getFilesInDirectory(
        resultFilePath,
        ".xml"
      );

      if (textEmailTemplates) {
        textEmailTemplates.forEach(element => {
          emailTemplates.push(element);
        });
      }
      this.ux.log(
        `\n --------------retrieved emails from the org------------------`
      );

      emailTemplates.sort();
      emailTemplates.forEach(element => {
        this.ux.log(element);
      });
      this.ux.log(
        `-----------------------------------------------------------------`
      );

      let isEmailUpdated = false;

      if (this.flags.name && this.flags.targetlink && this.flags.replacelink) {
        isEmailUpdated = await this.updateEmail(
          emailTemplates,
          target,
          replace
        );
      }
      if (this.flags.jsonpath) {
        isEmailUpdated = await this.processJsonRequest(
          emailTemplates,
          requestedEmails,
          resultFilePath
        );
      }
      if (isEmailUpdated) {
        var zipFile = "temp_sfpowerkit/package.zip";
        await zipDirectory("temp_sfpowerkit", zipFile);
        //Deploy patch using mdapi
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
          `Deploying Email templates with ID  ${
            deployId.id
          } to ${this.org.getUsername()}`
        );
        let metadata_deploy_result: DeployResult = await checkDeploymentStatus(
          conn,
          deployId.id
        );

        if (!metadata_deploy_result.success)
          throw new SfdxError(
            `Unable to deploy the Email templates : ${metadata_deploy_result.details["componentFailures"]}`
          );

        this.ux.log(`Email templates updated successfully.`);
      } else {
        this.ux.log(`target link not found in requested emails`);
      }
    } else {
      this.ux.log(`requested emails are not found in the org`);
    }
    rimraf.sync("temp_sfpowerkit");
    return { status: 1 };
  }
  public async updateEmail(
    emailTemplates: any[],
    target: string,
    replace: string
  ) {
    let isEmailUpdated = false;
    const regex = new RegExp(target);
    emailTemplates.forEach(element => {
      let fileContent = fs.readFileSync(element);
      if (regex.test(fileContent.toString())) {
        fileContent = fileContent.toString().replace(target, replace);
        fs.writeFileSync(element, fileContent);
        this.ux.log("Updated link in:         " + element);

        if (!isEmailUpdated) isEmailUpdated = true;
      }
    });
    return isEmailUpdated;
  }
  public async processJsonRequest(
    emailTemplates: any[],
    requestedEmails: any[],
    resultFilePath: string
  ) {
    let isEmailUpdated = false;
    for (const emailTemp of requestedEmails) {
      let retrievedEmail = [];
      if (
        fs.existsSync(path.resolve(resultFilePath + emailTemp.name + ".email"))
      ) {
        emailTemplates.forEach(element => {
          if (
            path.resolve(element) ===
            path.resolve(resultFilePath + emailTemp.name + ".email")
          )
            retrievedEmail.push(element);
        });
      }
      if (
        fs.existsSync(
          path.resolve(resultFilePath + emailTemp.name + ".email-meta.xml")
        )
      ) {
        emailTemplates.forEach(element => {
          if (
            path.resolve(element) ===
            path.resolve(resultFilePath + emailTemp.name + ".email-meta.xml")
          )
            retrievedEmail.push(element);
        });
      }
      if (retrievedEmail.length > 0) {
        retrievedEmail.sort();
        await emailTemp.link.forEach(async element => {
          if (element.targetlink && element.replacelink) {
            let isUpdated = await this.updateEmail(
              retrievedEmail,
              element.targetlink,
              element.replacelink
            );
            if (!isEmailUpdated && isUpdated) {
              isEmailUpdated = true;
            }
          }
        });
      }
    }
    return isEmailUpdated;
  }
}
