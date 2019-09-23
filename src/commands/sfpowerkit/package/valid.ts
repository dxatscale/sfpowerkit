import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { JsonArray } from "@salesforce/ts-types";
import { SfdxProject, SfdxError } from "@salesforce/core";
import xml2js = require("xml2js");
import util = require("util");
import fs = require("fs-extra");
import rimraf = require("rimraf");
import * as path from "path";

const spawn = require("child-process-promise").spawn;

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "valid");

export default class Valid extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:package:valid -n testPackage
  Now analyzing testPackage
Converting package testPackage
Elements supported included in your package testPackage are
[
  "AuraDefinitionBundle",
  "CustomApplication",
  "ApexClass",
  "ContentAsset",
  "WorkflowRule"
]
  `
  ];

  protected static flagsConfig = {
    package: flags.string({
      required: false,
      char: "n",
      description: messages.getMessage("packageFlagDescription")
    }),
    bypass: flags.array({
      required: false,
      char: "b",
      description: messages.getMessage("itemsToBypassValidationDescription")
    })
  };

  // Comment this out if your command does not require an org username
  //protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  private coverageJSON;

  public async run(): Promise<AnyJson> {
    // Getting Project config
    const project = await SfdxProject.resolve();

    const projectJson = await project.retrieveSfdxProjectJson();

    let resourcePath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "resources",
      "metadata.json"
    );

    const fileData = fs.readFileSync(resourcePath, "utf8");
    this.coverageJSON = JSON.parse(fileData);

    let packageToBeScanned = this.flags.package;
    this.ux.log("package:" + packageToBeScanned);

    const packageDirectories =
      (projectJson.get("packageDirectories") as JsonArray) || [];
    const result_store = [];

    if (packageToBeScanned != undefined) {
      for (const sf_package of packageDirectories as JsonArray) {
        if (
          packageToBeScanned != undefined &&
          packageToBeScanned === sf_package["package"]
        ) {
          this.ux.log("Package to be analyzed located");
          let result = await this.validate(sf_package);
          result_store.push(result);
          if (result.valid == false && !this.flags.json)
            throw new SfdxError(
              "Analysis Failed, Unsupported metadata present"
            );
          break;
        }
      }
    } else {
      this.ux.log("All packaging directories are  being analyzed");

      for (const sf_package of packageDirectories as JsonArray) {
        if (sf_package["package"] != undefined) {
          this.ux.log(`Now analyzing ${sf_package["package"]}`);
          let result;
          try {
            result = await this.validate(sf_package);
          } catch (e) {
            this.ux.log("Error Occured Unable to analyze");
          }
          result_store.push(result);
        }
      }
    }

    if (!this.flags.json) {
      result_store.forEach(element => {
        if (element.valid == false)
          throw new SfdxError("Analysis Failed, Unsupported metadata present");
      });
    }
    this.clearDirectory();
    return { packages: result_store };
  }

  public async validate(packageToBeScanned: AnyJson) {
    var sfdx_package = new SFDXPackage();

    sfdx_package.packageName = packageToBeScanned["package"];

    // Split arguments to use spawn
    const args = [];
    args.push("force:source:convert");

    // outputdir
    args.push("-d");
    args.push("temp_sfpowerkit/mdapi");

    // package name
    args.push("-n");
    args.push(`${packageToBeScanned["package"]}`);

    args.push("-r");
    args.push(`${packageToBeScanned["path"]}`);

    // INSTALL PACKAGE
    this.ux.log(
      `Utilizing Version of the metadata coverage ${this.coverageJSON.versions.selected}`
    );
    this.ux.log(`Converting package ${packageToBeScanned["package"]}`);

    //Bypass package validation
    if (this.flags.bypass) {
      sfdx_package.typesToBypass = this.flags.bypass;
    }

    var startTime = new Date().valueOf();
    await spawn("sfdx", args, { stdio: "inherit" });

    let targetFilename = "temp_sfpowerkit/mdapi/package.xml";

    if (fs.existsSync(targetFilename)) {
      const parser = new xml2js.Parser({ explicitArray: false });
      const parseString = util.promisify(parser.parseString);
      const existing = await parseString(fs.readFileSync(targetFilename));

      if (Array.isArray(existing.Package.types)) {
        for (const types of existing.Package.types as JsonArray) {
          if (this.coverageJSON.types[types["name"]] != undefined)
            if (
              this.coverageJSON.types[types["name"]].channels
                .unlockedPackagingWithoutNamespace
            )
              sfdx_package.supportedTypes.push(`${types["name"]}`);
            else sfdx_package.unsupportedtypes.push(`${types["name"]}`);
        }
      } else {
        if (
          this.coverageJSON.types[existing.Package.types["name"]] != undefined
        )
          if (
            this.coverageJSON.types[existing.Package.types["name"]].channels
              .unlockedPackagingWithoutNamespace
          )
            sfdx_package.supportedTypes.push(
              `${existing.Package.types["name"]}`
            );
          else
            sfdx_package.unsupportedtypes.push(
              `${existing.Package.types["name"]}`
            );
      }

      sfdx_package.processed = true;

      if (sfdx_package.supportedTypes.length > 0) {
        this.ux.log(
          `Elements supported included in your package ${packageToBeScanned["package"]} are`
        );
        sfdx_package.supportedTypes.forEach(element => {
          this.ux.log(element);
        });
        sfdx_package.valid = true;
        this.ux.log(
          `--------------------------------------------------------------------------------`
        );
      }

      //Bypass metadata in package validator
      if (
        sfdx_package.typesToBypass.length > 0 &&
        sfdx_package.unsupportedtypes.length > 0
      ) {
        let itemsToRemove = [];

        sfdx_package.typesToBypass = sfdx_package.typesToBypass.map(element =>
          element.toLowerCase()
        );
        sfdx_package.unsupportedtypes = sfdx_package.unsupportedtypes.map(
          element => element.toLowerCase()
        );

        itemsToRemove = sfdx_package.typesToBypass.filter(element =>
          sfdx_package.unsupportedtypes.includes(element)
        );

        if (itemsToRemove.length > 0) {
          this.ux.log(
            `Unsupported elements to bypass in your package ${packageToBeScanned["package"]} are`
          );
          itemsToRemove.forEach(element => {
            this.ux.log(element);
          });
          sfdx_package.unsupportedtypes = sfdx_package.unsupportedtypes.filter(
            element => !itemsToRemove.includes(element)
          );
          this.ux.log(
            `--------------------------------------------------------------------------------`
          );
        }
      }

      if (sfdx_package.unsupportedtypes.length > 0) {
        this.ux.log("Elements not supported are ");
        sfdx_package.unsupportedtypes.forEach(element => {
          this.ux.log(element);
        });
        sfdx_package.valid = false;
        this.ux.log(
          `--------------------------------------------------------------------------------`
        );
      }
    }

    return sfdx_package;
  }

  public async clearDirectory() {
    rimraf.sync("temp_sfpowerkit");
  }
}

export class SFDXPackage {
  public unsupportedtypes = [];
  public supportedTypes = [];
  public typesToBypass = [];
  public packageName: string;
  public valid: boolean;
  public processed: boolean;
}
