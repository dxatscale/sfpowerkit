import { AnyJson } from "@salesforce/ts-types";
import fs from "fs-extra";
import { core, flags, SfdxCommand } from "@salesforce/command";
import rimraf = require("rimraf");
import { SfdxProject } from "@salesforce/core";
import {
  getPackageInfo,
  getDefaultPackageInfo
} from "../../../../shared/getPackageInfo";
import { searchFilesInDirectory } from "../../../../shared/searchFilesInDirectory";
import DiffUtil from "../../../../impl/project/diff/diffutils";
import { zipDirectory } from "../../../../shared/zipDirectory";

var path = require("path");
const spawn = require("child-process-promise").spawn;

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "source_permissionset_generatepatch"
);

export default class Generatepatch extends SfdxCommand {
  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:permissionset:generatepatch -p Core -d src/core/main/default/permissionsets`
  ];

  protected static flagsConfig = {
    package: flags.string({
      required: false,
      char: "p",
      description: messages.getMessage("packageFlagDescription")
    }),
    permsetdir: flags.string({
      required: false,
      char: "d",
      description: messages.getMessage("permsetDirFlagDescription")
    }),
    apiversion: flags.builtin({
      description: messages.getMessage("apiversion")
    })
  };

  public async run(): Promise<AnyJson> {
    //clean any existing temp sf powerkit source folder
    rimraf.sync("temp_sfpowerkit");

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

    this.flags.apiversion = this.flags.apiversion || "46.0";

    //set permset directory
    let permsetDirPath;
    if (this.flags.permsetdir) permsetDirPath = this.flags.permsetdir;
    else {
      permsetDirPath = packageToBeUsed.path + `/main/default/permissionsets/`;
    }

    this.ux.log("Scanning for Permissionsets");

    let permissionsetList: any[] = searchFilesInDirectory(
      permsetDirPath,
      "</PermissionSet>",
      ".xml"
    );

    if (permissionsetList && permissionsetList.length > 0) {
      this.ux.log("Found " + `${permissionsetList.length}` + " Permissionsets");

      let diffUtils = new DiffUtil("0", "0");

      fs.mkdirSync("temp_sfpowerkit");

      permissionsetList.forEach(file => {
        diffUtils.copyFile(file, "temp_sfpowerkit");
      });

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
        "temp_sfpowerkit/" +
        `${packageToBeUsed.package}` +
        "_permissionsets.zip";
      await zipDirectory("temp_sfpowerkit/mdapi", zipFile);

      //Create Static Resource Directory if not exist
      let dir = packageToBeUsed.path + `/main/default/staticresources/`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      fs.copyFileSync(
        zipFile,
        packageToBeUsed.path +
          `/main/default/staticresources/${packageToBeUsed.package}_permissionsets.zip`
      );

      //Store it to static resources
      var metadata: string = `<?xml version="1.0" encoding="UTF-8"?>
      <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
          <cacheControl>Public</cacheControl>
          <contentType>application/zip</contentType>
      </StaticResource>`;
      let targetmetadatapath =
        packageToBeUsed.path +
        `/main/default/staticresources/${packageToBeUsed.package}_permissionsets.resource-meta.xml`;

      this.ux.log(
        "Generating static resource file : " + `${targetmetadatapath}`
      );

      fs.outputFileSync(targetmetadatapath, metadata);

      this.ux.log(
        `Patch ${packageToBeUsed.package}_permissionsets generated successfully.`
      );

      //clean temp sf powerkit source folder
      rimraf.sync("temp_sfpowerkit");
    } else {
      this.ux.log("No permissionsets found");
    }

    return 0;
  }
}
