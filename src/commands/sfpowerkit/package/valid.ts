import { flags } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { JsonArray } from "@salesforce/ts-types";
import { SfdxProject, SfdxError, Messages } from "@salesforce/core";
import * as fs from "fs-extra";
import * as rimraf from "rimraf";
import * as path from "path";
import { SFPowerkit, LoggerLevel, COLOR_WARNING, COLOR_SUCCESS, COLOR_KEY_MESSAGE } from "../../../sfpowerkit";
import SFPowerkitCommand from "../../../sfpowerkitCommand";
import { loadSFDX } from "../../../sfdxnode/GetNodeWrapper";
import { MetadataResolver } from '@salesforce/source-deploy-retrieve'



// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("sfpowerkit", "valid");

export default class Valid extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:package:valid -n testPackage
  Now analyzing testPackage
Converting package testPackage
Elements supported included in your package testPackage
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
    }),
    apiversion: flags.builtin({
      description: messages.getMessage("apiversion")
    }),
    loglevel: flags.enum({
      description: "loglevel to execute the command",
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

  protected static requiresProject = true;

  private coverageJSON;

  public async execute(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");

    loadSFDX();

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

    let fileData = fs.readFileSync(resourcePath, "utf8");
    this.coverageJSON = JSON.parse(fileData);

    if (this.isNotDefaultApiVersion()) {
      this.useCustomCoverageJSON();
    }

    let packageToBeScanned = this.flags.package;

    const packageDirectories =
      (projectJson.get("packageDirectories") as JsonArray) || [];
    const result_store: SFDXPackage[] = [];

    if (packageToBeScanned != undefined) {
      SFPowerkit.log(`Analyzing ${packageToBeScanned}`, LoggerLevel.INFO);
      for (const sf_package of packageDirectories as JsonArray) {
        if (
          packageToBeScanned != undefined &&
          packageToBeScanned === sf_package["package"]
        ) {
          SFPowerkit.log(
            `Located ${packageToBeScanned} in project ${sf_package["path"]}`,
            LoggerLevel.DEBUG
          );

          try {
            const result = await this.validate(sf_package);
            result_store.push(result);
          } catch (e) {
            SFPowerkit.log(
              `Unable to analyze ${sf_package["package"]} due to ${e.message}`,
              LoggerLevel.ERROR
            );
          }

          break;
        }
      }
    } else {
      SFPowerkit.log(
        "All packaging directories are  being analyzed",
        LoggerLevel.INFO
      );

      for (const sf_package of packageDirectories as JsonArray) {
        if (sf_package["package"] != undefined) {
          SFPowerkit.log(
            `Analyzing ${sf_package["package"]}`,
            LoggerLevel.DEBUG
          );
          try {
            const result = await this.validate(sf_package);
            result_store.push(result);
          } catch (e) {
            SFPowerkit.log(
              `Unable to analyze ${sf_package["package"]}, Skipping ${sf_package["package"]}. try running sfdx force:source:convert -r ${sf_package["path"]}`,
              LoggerLevel.ERROR
            );
          }
        }
      }
    }

    if (!this.flags.json) {
      result_store.forEach(element => {
        if (element.valid == false)
          throw new SfdxError("Analysis Failed, Unsupported metadata present");
      });
    }
    return { packages: result_store } as unknown as AnyJson;
  }

  public async validate(packageToBeScanned: AnyJson) {
    SFPowerkit.log(
      `Utilizing Version of the metadata coverage ${this.coverageJSON.versions.selected}`,
      LoggerLevel.DEBUG
    );
    SFPowerkit.log(
      `Converting package ${packageToBeScanned["package"]}`,
      LoggerLevel.INFO
    );

    var sfdx_package = new SFDXPackage();
    sfdx_package.packageName = packageToBeScanned["package"];

    const resolver = new MetadataResolver();
    const components = resolver.getComponentsFromPath(packageToBeScanned["path"]);


    //Bypass package validation
    if (this.flags.bypass) {
      sfdx_package.typesToBypass = this.flags.bypass;
    }


      if (Array.isArray(components)) {
        for (const component of components) {
            if (
              this.coverageJSON.types[component.type.name].channels
                .unlockedPackagingWithoutNamespace
            )
              sfdx_package.supportedTypes.push(`${COLOR_KEY_MESSAGE(component.type.name)}: ${component.name}   ${component.name}`);
            else sfdx_package.unsupportedtypes.push(`${COLOR_KEY_MESSAGE(component.type.name)}: ${component.name}`);
        }
      }
      sfdx_package.processed = true;

      if (sfdx_package.supportedTypes.length > 0) {
        this.ux.log(
          COLOR_SUCCESS(`Supported metadata in package ${packageToBeScanned["package"]}`)
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
            COLOR_WARNING(`Unsupported metadata in package ${packageToBeScanned["package"]}  to bypass`)
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
        this.ux.log(
          COLOR_WARNING(`Unsupported metadata in package ${packageToBeScanned["package"]}`)
        );
        sfdx_package.unsupportedtypes.forEach(element => {
          this.ux.log(element);
        });
        sfdx_package.valid = false;
        this.ux.log(
          `--------------------------------------------------------------------------------`
        );
      }
    


    return sfdx_package;
  }

  public useCustomCoverageJSON(): void {
    try {
      let resourcePath = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "resources",
        `metadata_v${this.flags.apiversion}.json`
      );
      let fileData = fs.readFileSync(resourcePath, "utf8");
      this.coverageJSON = JSON.parse(fileData);
    } catch (fileError) {
      throw new SfdxError(
        `Unable to read version ${this.flags.apiversion} of metadata coverage JSON`
      );
    }
  }

  public isNotDefaultApiVersion(): boolean {
    return (
      this.flags.apiversion &&
      this.coverageJSON.versions.selected != this.flags.apiversion
    );
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
