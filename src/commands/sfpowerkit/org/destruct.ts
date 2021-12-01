import { FlagsConfig, flags } from "@salesforce/command";
import FileUtils from "../../../utils/fileutils";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import SFPowerkitCommand from "../../../sfpowerkitCommand";
import * as xml2js from "xml2js";
import * as rimraf from "rimraf";
import * as util from "util";
import { zipDirectory } from "../../../utils/zipDirectory";
import { AsyncResult, DeployResult } from "jsforce";
import { checkDeploymentStatus } from "../../..//utils/checkDeploymentStatus";
import { Connection, Messages, SfdxError } from "@salesforce/core";
import * as fs from "fs-extra";
import { isEmpty } from "@salesforce/kit";

const path = require("path");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("sfpowerkit", "org_destruct");

export default class Destruct extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:destruct -m destructiveChanges.xml -u prod@prod3.com`
  ];

  protected static flagsConfig: FlagsConfig = {
    manifest: flags.filepath({
      required: false,
      char: "m",
      description: messages.getMessage("destructiveManifestFlagDescription")
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

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async execute(): Promise<any> {

    await this.org.refreshAuth();

    //Connect to the org
    const conn = this.org.getConnection();
    const apiversion = await conn.retrieveMaxApiVersion();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    const existingManifestPath: string = this.flags.manifest.valueOf();
    let workingDirectory = this.generateCacheDirectory();

    try {
      await this.copyAndValidateDestructiveManifest(
        existingManifestPath,
        workingDirectory
      );

      this.generateEmptyPackageXml(workingDirectory, apiversion);
      let zipFile = await this.generateDeploymentZipFile(workingDirectory);

      await this.deployDestructiveManifest(zipFile, conn);
    } catch (e) {
      throw new SfdxError(e.message);
    }

    rimraf.sync(workingDirectory);
    return 0;
  }

  private generateCacheDirectory() {
    //Setup working directory
    let cacheDirectory = FileUtils.getGlobalCacheDir();
    let destructCacheDirectory = path.join(cacheDirectory, "destruct");

    //Clean existing directory
    rimraf.sync(destructCacheDirectory);
    fs.mkdirSync(destructCacheDirectory);

    return destructCacheDirectory;
  }

  private async copyAndValidateDestructiveManifest(
    existingManifestPath: string,
    workingDirectory: string
  ) {
    let destructiveManifestFile = path.join(
      workingDirectory,
      "destructiveChanges.xml"
    );

    //Copy Destructive Manifest File to  Temporary Directory
    fs.copyFileSync(existingManifestPath, destructiveManifestFile);

    //Validate the destructive file for syntax
    const parser = new xml2js.Parser({ explicitArray: false });
    const parseString = util.promisify(parser.parseString);
    let destructiveChanges = await parseString(
      fs.readFileSync(path.resolve(destructiveManifestFile))
    );

    if (isEmpty(destructiveChanges["Package"]["types"])) {
      throw new SfdxError("Invalid Destructive Change Definitiion Encountered");
    }

    SFPowerkit.log(destructiveChanges["Package"]["types"], LoggerLevel.TRACE);
  }

  private generateEmptyPackageXml(
    workingDirectory: string,
    apiversion: string
  ) {
    let packageXml: string = `<?xml version="1.0" encoding="UTF-8"?>
    <Package xmlns="http://soap.sforce.com/2006/04/metadata">
        <types>
            <members>*</members>
            <name>CustomLabel</name>
        </types>
        <version>${apiversion}</version>
    </Package>`;

    let packageXmlPath = path.join(workingDirectory, "package.xml");
    fs.outputFileSync(packageXmlPath, packageXml);

    SFPowerkit.log(
      `Empty Package.xml with ${apiversion} created at ${workingDirectory}`,
      LoggerLevel.DEBUG
    );
  }

  private async generateDeploymentZipFile(workingDirectory: string) {
    let zipFile = path.join(FileUtils.getGlobalCacheDir(), "package.zip");
    await zipDirectory(workingDirectory, zipFile);
    return zipFile;
  }
  private async deployDestructiveManifest(
    zipFile: string,
    conn: Connection
  ) {
    //Deploy Package
    conn.metadata.pollTimeout = 300;
    let deployId: AsyncResult;

    var zipStream = fs.createReadStream(zipFile);
    await conn.metadata.deploy(
      zipStream,
      { rollbackOnError: true, singlePackage: true },
      function(error, result: AsyncResult) {
        if (error) {
          SFPowerkit.log(error.message, LoggerLevel.ERROR);
        }
        deployId = result;
      }
    );

    SFPowerkit.log(
      `Deploying Destructive Changes with ID ${
        deployId.id
      } to ${this.org.getUsername()}`,
      LoggerLevel.INFO
    );
    let metadata_deploy_result: DeployResult = await checkDeploymentStatus(
      conn,
      deployId.id
    );

    if (metadata_deploy_result.success) {
      if (metadata_deploy_result.success)
        SFPowerkit.log(
          `Deployed Destructive Changes  in target org ${this.org.getUsername()} succesfully`,
          LoggerLevel.INFO
        );
    } else {
      let componentFailures =
        metadata_deploy_result.details["componentFailures"];
      let errorResult = [];
      if (componentFailures.constructor === Array) {
        componentFailures.forEach(failure => {
          errorResult.push({
            componentType: failure.componentType,
            fullName: failure.fullName,
            problem: failure.problem
          });
        });
      } else {
        errorResult.push({
          componentType: componentFailures.componentType,
          fullName: componentFailures.fullName,
          problem: componentFailures.problem
        });
      }

      throw new SfdxError(
        "Unable to deploy the Destructive Changes: " +
          JSON.stringify(errorResult)
      );
    }
  }
}
