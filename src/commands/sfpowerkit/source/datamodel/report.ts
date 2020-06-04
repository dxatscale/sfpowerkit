import { AnyJson } from "@salesforce/ts-types";
import fs from "fs-extra";
import { core, flags, SfdxCommand } from "@salesforce/command";
import { SfdxProject, SfdxError } from "@salesforce/core";
import { SFPowerkit } from "../../../../sfpowerkit";
import { LoggerLevel } from "@salesforce/core";
import FileUtils from "../../../../utils/fileutils";
import { METADATA_INFO } from "../../../../impl/metadata/metadataInfo";
import * as _ from "lodash";

var path = require("path");

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);
// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "datamodel_report");

export default class Report extends SfdxCommand {
  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:datamodel:report`,
    `$ sfdx sfpowerkit:source:datamodel:report -p force-app/main/default/objects -d result`,
    `$ sfdx sfpowerkit:source:datamodel:report -p force-app/main/default/objects -t CustomField,RecordType`,
    `$ sfdx sfpowerkit:source:datamodel:report -p force-app/main/default/objects -t CustomField,RecordType -f csv`
  ];

  protected static flagsConfig = {
    objectspath: flags.array({
      required: false,
      char: "p",
      description: messages.getMessage("objectspathDescription")
    }),
    outputdir: flags.string({
      required: true,
      char: "d",
      description: messages.getMessage("outputdirDescription"),
      default: "datamodelreport"
    }),
    filtertype: flags.array({
      required: true,
      char: "t",
      description: messages.getMessage("filterDescription"),
      default: [
        "CustomField",
        "BusinessProcess",
        "RecordType",
        "ValidationRule",
        "CustomObject"
      ]
    }),
    format: flags.enum({
      required: false,
      char: "f",
      description: messages.getMessage("formatDescription"),
      options: ["json", "csv"],
      default: "json"
    }),
    loglevel: flags.enum({
      description: messages.getMessage("loglevelDescription"),
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

  public async run(): Promise<AnyJson> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    let allowedFilter = [
      "CustomField",
      "BusinessProcess",
      "RecordType",
      "CompactLayout",
      "WebLink",
      "ValidationRule",
      "SharingReason",
      "ListView",
      "FieldSet",
      "CustomObject"
    ];
    this.flags.filtertype.forEach(type => {
      if (!allowedFilter.includes(type)) {
        throw new SfdxError(
          `${type} is not a valid filter. Allowed filters are [CustomField,BusinessProcess,RecordType,ValidationRule,CustomObject]`
        );
      }
    });

    // set default path from sfdx-project.json
    if (!this.flags.objectspath) {
      this.flags.objectspath = [];
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();
      let packages = (project.get("packageDirectories") as any[]) || [];
      packages.forEach(element => {
        this.flags.objectspath.push(element.path);
      });
    }

    var metadataFiles: string[] = [];
    for (let dir of this.flags.objectspath) {
      metadataFiles = metadataFiles.concat(FileUtils.getAllFilesSync(dir));
    }

    let result = [];
    metadataFiles.forEach(metadataFile => {
      for (let type of this.flags.filtertype) {
        let metadataDescribe = METADATA_INFO[type];
        if (
          metadataDescribe &&
          metadataFile.endsWith(metadataDescribe.sourceExtension)
        ) {
          let name = FileUtils.getFileNameWithoutExtension(
            metadataFile,
            metadataDescribe.sourceExtension
          );

          let parentName = "";
          if (metadataDescribe.isChildComponent) {
            let fileParts = metadataFile.split(path.sep);
            parentName = fileParts[fileParts.length - 3];
          }

          let component = {
            metadatype: type,
            name: name,
            objectName: parentName,
            path: metadataFile.split("\\").join("/")
          };

          result.push(component);
        }
      }
    });

    if (result.length > 0) {
      SFPowerkit.log(`Items Found ${result.length}`, LoggerLevel.INFO);

      if (this.flags.json || this.flags.format === "json") {
        await this.generateJsonOutput(result, this.flags.outputdir);
      } else {
        await this.generateCSVOutput(result, this.flags.outputdir);
      }
    } else {
      SFPowerkit.log(
        `Requested project doesnot have any datamodel entities`,
        LoggerLevel.INFO
      );
    }
    return JSON.stringify(result);
  }
  public async generateCSVOutput(result: any[], outputDir: string) {
    let outputcsvPath = `${outputDir}/output.csv`;
    let dir = path.parse(outputcsvPath).dir;
    if (!fs.existsSync(dir)) {
      FileUtils.mkDirByPathSync(dir);
    }
    let newLine = "\r\n";
    let output = "Metadata type,Name,ObjectName,Path" + newLine;
    result.forEach(element => {
      output = `${output}${element.metadatype},${element.name},${element.objectName},${element.path}${newLine}`;
    });
    fs.writeFileSync(outputcsvPath, output);
    SFPowerkit.log(
      `Output ${outputDir}/output.csv is generated successfully`,
      LoggerLevel.INFO
    );
  }
  private async generateJsonOutput(result: any[], outputDir: string) {
    let outputJsonPath = `${outputDir}/output.json`;
    let dir = path.parse(outputJsonPath).dir;
    if (!fs.existsSync(dir)) {
      FileUtils.mkDirByPathSync(dir);
    }
    fs.writeFileSync(outputJsonPath, JSON.stringify(result));
    SFPowerkit.log(
      `Output ${outputDir}/output.json is generated successfully`,
      LoggerLevel.INFO
    );
  }
}
