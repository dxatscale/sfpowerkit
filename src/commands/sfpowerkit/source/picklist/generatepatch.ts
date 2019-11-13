import { AnyJson, JsonArray, asJsonArray } from "@salesforce/ts-types";
import fs from "fs-extra";
import { core, flags, SfdxCommand } from "@salesforce/command";
import rimraf = require("rimraf");
import { SfdxProject } from "@salesforce/core";
import xml2js = require("xml2js");
import util = require("util");
import {
  getPackageInfo,
  getDefaultPackageInfo
} from "../../../../utils/getPackageInfo";
import { searchFilesInDirectory } from "../../../../utils/searchFilesInDirectory";

import { zipDirectory } from "../../../../utils/zipDirectory";
import MetadataFiles from "../../../../impl/metadata/metadataFiles";
import { SFPowerkit } from "../../../../sfpowerkit";

var path = require("path");
const spawn = require("child-process-promise").spawn;

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "source_picklist_generatepatch"
);

export default class Generatepatch extends SfdxCommand {
  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:picklist:generatepatch -p sfpowerkit_test -d force-app/main/default/objects/ -f`
  ];

  protected static flagsConfig = {
    package: flags.string({
      required: false,
      char: "p",
      description: messages.getMessage("packageFlagDescription")
    }),
    objectsdir: flags.string({
      required: false,
      char: "d",
      description: messages.getMessage("objectDirFlagDescription")
    }),
    fixstandardvalueset: flags.boolean({
      required: false,
      char: "f",
      description: messages.getMessage("fixStandardValueSetDescription")
    }),
    fixrecordtypes: flags.boolean({
      required: false,
      char: "r",
      description: messages.getMessage("fixRecordTypes")
    }),
    movestandardvalueset: flags.boolean({
      required: false,
      char: "m",
      description: messages.getMessage("movestandardvalueSetDescription")
    }),
    apiversion: flags.builtin({
      description: messages.getMessage("apiversion")
    })
  };

  public async run(): Promise<AnyJson> {
    //clean any existing temp sf powerkit source folder
    rimraf.sync("temp_sfpowerkit");

    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);
    //

    // Getting Project config
    const project = await SfdxProject.resolve();
    const projectJson = await project.retrieveSfdxProjectJson();

    //Retrieve the package
    let packageToBeUsed;
    if (this.flags.package)
      packageToBeUsed = getPackageInfo(projectJson, this.flags.package);
    else {
      packageToBeUsed = getDefaultPackageInfo(projectJson);
    }

    this.flags.apiversion = this.flags.apiversion || "47.0";

    //set objects directory
    let objectsDirPath;
    if (this.flags.objectsdir) objectsDirPath = this.flags.objectsdir;
    else {
      objectsDirPath = packageToBeUsed.path + `/main/default/objects/`;
    }

    let status = await this.generatePatchForCustomPicklistField(
      objectsDirPath,
      this.flags.fixstandardvalueset
    );

    if (!status) return 1;

    this.ux.log(
      "--------------------------------------------------------------------------------"
    );

    if (this.flags.fixrecordtypes) {
      let status = await this.generatePatchForBusinessProcess(objectsDirPath);
      if (!status) return 1;
      status = await this.generatePatchForRecordTypes(objectsDirPath);
      if (!status) return 1;
    }

    if (this.flags.movestandardvalueset) {
      status = await this.generatePatchForStandardValuset(objectsDirPath);
      if (!status) return 1;
    }

    // sfdx project json file running force source command
    var sfdx_project_json: string = `{
        "packageDirectories": [
          {
            "path": "${packageToBeUsed.path}",
            "default": true
          }
        ],
        "namespace": "",
        "sourceApiVersion": "${this.flags.apiversion}"
      }`;

    fs.outputFileSync("temp_sfpowerkit/sfdx-project.json", sfdx_project_json);

    //force ignore file to ignore custom metadata
    var forceIgnoreFile: string = `**__mdt/`;

    fs.outputFileSync("temp_sfpowerkit/.forceignore", forceIgnoreFile);

    if (
      fs.existsSync(path.resolve(`temp_sfpowerkit/${packageToBeUsed.path}`))
    ) {
      //Convert to mdapi
      const args = [];
      args.push("force:source:convert");
      args.push("-r");
      args.push(`${packageToBeUsed.path}`);
      args.push("-d");
      args.push(`mdapi`);
      await spawn("sfdx", args, {
        stdio: "inherit",
        cwd: "temp_sfpowerkit"
      });

      //Generate zip file
      var zipFile =
        "temp_sfpowerkit/" + `${packageToBeUsed.package}` + "_picklist.zip";
      await zipDirectory("temp_sfpowerkit/mdapi", zipFile);

      //Create Static Resource Directory if not exist
      let dir = packageToBeUsed.path + `/main/default/staticresources/`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      fs.copyFileSync(
        zipFile,
        packageToBeUsed.path +
          `/main/default/staticresources/${packageToBeUsed.package}_picklist.zip`
      );

      //Store it to static resources
      var metadata: string = `<?xml version="1.0" encoding="UTF-8"?>
        <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
            <cacheControl>Public</cacheControl>
            <contentType>application/zip</contentType>
        </StaticResource>`;
      let targetmetadatapath =
        packageToBeUsed.path +
        `/main/default/staticresources/${packageToBeUsed.package}_picklist.resource-meta.xml`;

      this.ux.log(
        "Generating static resource file : " + `${targetmetadatapath}`
      );

      fs.outputFileSync(targetmetadatapath, metadata);

      this.ux.log(
        `Patch ${packageToBeUsed.package}_picklist generated successfully.`
      );
    } else {
      this.ux.log(`No picklist or recordtype found to create a Patch `);
    }
    //clean temp sf powerkit source folder
    rimraf.sync("temp_sfpowerkit");
    return 0;
  }

  private async generatePatchForCustomPicklistField(
    objectsDirPath: string,
    isStandardValueSetToBeFixed: boolean
  ): Promise<boolean> {
    if (isStandardValueSetToBeFixed) {
      this.ux
        .log(`Warning, your package source code will be modified to remove references to standard value set and will be 
      added into the patch`);
    }

    this.ux.log("Scanning for fields of type picklist");

    //search picklist
    let customFieldsWithPicklist: any[] = searchFilesInDirectory(
      objectsDirPath,
      "<type>Picklist</type>",
      ".xml"
    );

    //search MultiselectPicklist
    let customFieldsWithMultiPicklist: any[] = searchFilesInDirectory(
      objectsDirPath,
      "<type>MultiselectPicklist</type>",
      ".xml"
    );

    if (
      customFieldsWithMultiPicklist &&
      customFieldsWithMultiPicklist.length > 0
    ) {
      customFieldsWithPicklist = customFieldsWithPicklist.concat(
        customFieldsWithMultiPicklist
      );
    }

    if (customFieldsWithPicklist && customFieldsWithPicklist.length > 0) {
      this.ux.log(
        "Found " +
          `${customFieldsWithPicklist.length}` +
          " fields of type picklist"
      );

      this.ux.log("Processing and adding the following fields to patch");

      let in_patch_count = 0;
      let modified_source_count = 0;
      for (const file of customFieldsWithPicklist) {
        const parser = new xml2js.Parser({ explicitArray: false });
        const parseString = util.promisify(parser.parseString);
        let field_metadata;
        try {
          field_metadata = await parseString(
            fs.readFileSync(path.resolve(file))
          );
        } catch (e) {
          this.ux.log(`Unable to parse file ${file} due to ${e}`);
          return Promise.reject(e);
        }

        let controllingField: string = (
          field_metadata.CustomField.valueSet || {}
        ).controllingField;

        //Skip mdt pick fields as its non upgradeable if owned by a package
        if (!String(file).includes("__mdt\\fields")) {
          //A controlling field with a standarad value set, patch source and copy original to patch
          if (
            controllingField != undefined &&
            !controllingField.endsWith("__c")
          ) {
            if (isStandardValueSetToBeFixed) {
              in_patch_count++;
              this.ux.log("Copied Original to Patch:         " + file);
              MetadataFiles.copyFile(file, "temp_sfpowerkit");

              modified_source_count++;

              let builder = new xml2js.Builder();
              delete field_metadata.CustomField.valueSet.controllingField;
              delete field_metadata.CustomField.valueSet.valueSettings;
              var xml = builder.buildObject(field_metadata);
              fs.writeFileSync(file, xml);
              this.ux.log("Modified Original in Packaging:         " + file);
            }
          } else {
            in_patch_count++;
            this.ux.log("Copied Original to Patch:         " + file);
            MetadataFiles.copyFile(file, "temp_sfpowerkit");
          }
        }
      }

      this.ux.log(
        `Added  ${in_patch_count} fields of field type picklist into patch after'removing fields picklist fields in cmdt objects`
      );
      if (this.flags.fixstandardvalueset)
        this.ux.log(
          `Modified  ${modified_source_count} fields of field type picklist that have standard value sets as controlling types in packaging folder`
        );
    }
    return Promise.resolve(true);
  }

  private async generatePatchForRecordTypes(
    objectsDirPath: string
  ): Promise<boolean> {
    this.ux
      .log(`Warning, your package source code will be modified to remove references to standard value set and the orginal source code
    will be  added into the patch`);
    this.ux.log("Scanning for recordtypes");
    let recordTypes: any[] = searchFilesInDirectory(
      objectsDirPath,
      '<RecordType xmlns="http://soap.sforce.com/2006/04/metadata">',
      ".xml"
    );

    if (recordTypes && recordTypes.length > 0) {
      this.ux.log("Found " + `${recordTypes.length}` + " RecordTypes");

      this.ux.log("Processing and adding the following fields to patch");

      let in_patch_count = 0;
      let modified_source_count = 0;
      for (const file of recordTypes) {
        in_patch_count++;
        modified_source_count++;

        const parser = new xml2js.Parser({ explicitArray: false });
        const parseString = util.promisify(parser.parseString);
        let recordtype_metadata;
        try {
          recordtype_metadata = await parseString(
            fs.readFileSync(path.resolve(file))
          );
        } catch (e) {
          this.ux.log(`Unable to parse file ${file} due to ${e}`);
          return false;
        }

        this.ux.log("Copied Original to Patch:         " + file);
        MetadataFiles.copyFile(file, "temp_sfpowerkit");
        delete recordtype_metadata.RecordType.picklistValues;

        let builder = new xml2js.Builder();
        var xml = builder.buildObject(recordtype_metadata);
        fs.writeFileSync(file, xml);
        this.ux.log("Modified Original in Packaging:         " + file);
      }

      this.ux.log(`Added  ${in_patch_count}  RecordType to patch`);
      this.ux.log(
        `Modified  ${modified_source_count} RecordTypes in packaging folder`
      );
    }
    this.ux.log(
      "--------------------------------------------------------------------------------"
    );
    return true;
  }

  private async generatePatchForBusinessProcess(
    objectsDirPath: string
  ): Promise<boolean> {
    let patch_value = {
      fullName: "New",
      default: "true"
    };

    this.ux
      .log(`Warning, your package source code will be modified to remove references to standard value set and the orginal source code
    will be  added into the patch`);
    this.ux.log("Scanning for BusinessProcess");
    let businessProcess: any[] = searchFilesInDirectory(
      objectsDirPath,
      '<BusinessProcess xmlns="http://soap.sforce.com/2006/04/metadata">',
      ".xml"
    );

    if (businessProcess && businessProcess.length > 0) {
      this.ux.log("Found " + `${businessProcess.length}` + " BusinessProcess");

      this.ux.log("Processing and adding the following fields to patch");

      let in_patch_count = 0;
      let modified_source_count = 0;
      for (const file of businessProcess) {
        in_patch_count++;
        modified_source_count++;

        const parser = new xml2js.Parser({ explicitArray: false });
        const parseString = util.promisify(parser.parseString);
        let businessProcess_metadata;
        try {
          businessProcess_metadata = await parseString(
            fs.readFileSync(path.resolve(file))
          );
        } catch (e) {
          this.ux.log(`Unable to parse file ${file} due to ${e}`);
          return false;
        }

        this.ux.log("Copied Original to Patch:         " + file);
        MetadataFiles.copyFile(file, "temp_sfpowerkit");
        businessProcess_metadata.BusinessProcess.values = [];
        businessProcess_metadata.BusinessProcess.values.push(patch_value);

        let builder = new xml2js.Builder();
        var xml = builder.buildObject(businessProcess_metadata);
        fs.writeFileSync(file, xml);
        this.ux.log("Modified Original in Packaging:         " + file);
      }

      this.ux.log(`Added  ${in_patch_count}  BusinessProcess to patch`);
      this.ux.log(
        `Modified  ${modified_source_count} BusinessProcess in packaging folder`
      );
    }
    this.ux.log(
      "--------------------------------------------------------------------------------"
    );
    return true;
  }

  private async generatePatchForStandardValuset(
    objectsDirPath: string
  ): Promise<boolean> {
    this.ux
      .log(`Warning, your package source code will be modified to remove standard valueset. The modified source will be 
    added into the patch`);

    let standardValueSetPath = objectsDirPath.replace("objects", "");
    if (standardValueSetPath.includes("//")) {
      standardValueSetPath = standardValueSetPath.replace("//", "/");
    }
    standardValueSetPath = standardValueSetPath + "standardValueSets/";

    if (fs.existsSync(path.resolve(standardValueSetPath))) {
      let standardValueSets: any[] = searchFilesInDirectory(
        standardValueSetPath,
        '<StandardValueSet xmlns="http://soap.sforce.com/2006/04/metadata">',
        ".xml"
      );
      if (standardValueSets.length > 0) {
        this.ux.log(
          `Found ${standardValueSets.length} Standard valueset in ${standardValueSetPath}`
        );
        for (const file of standardValueSets) {
          this.ux.log("Copied Original to Patch:         " + file);
          MetadataFiles.copyFile(file, "temp_sfpowerkit");
        }
      }
      this.ux.log(`Removing ${standardValueSetPath} from source`);
      rimraf.sync(standardValueSetPath);
      this.ux.log(
        "--------------------------------------------------------------------------------"
      );
    }
    return Promise.resolve(true);
  }
}
