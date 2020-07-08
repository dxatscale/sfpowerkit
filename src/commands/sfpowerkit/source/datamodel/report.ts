import { AnyJson } from "@salesforce/ts-types";
import fs from "fs-extra";
import { core, flags, SfdxCommand } from "@salesforce/command";
import { SfdxProject, SfdxError } from "@salesforce/core";
import { SFPowerkit } from "../../../../sfpowerkit";
import { LoggerLevel } from "@salesforce/core";
import FileUtils from "../../../../utils/fileutils";
import { METADATA_INFO } from "../../../../impl/metadata/metadataInfo";
import * as _ from "lodash";
import xmlUtil from "../../../../utils/xmlUtil";

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
    `$ sfdx sfpowerkit:source:datamodel:report -p force-app/main/default/objects -t CustomField,RecordType -f csv`,
    `$ sfdx sfpowerkit:source:datamodel:report -f md -d docs`
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
      options: ["json", "csv", "md"],
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

    let counter = 0;
    let result = [];
    for (let metadataFile of metadataFiles) {
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

          let fileParts = metadataFile.split(path.sep);

          let metadataJson = await xmlUtil.xmlToJSON(metadataFile);
          delete metadataJson[type]["$"];

          let component = {
            name: name,
            metadatype: type,
            objectName: metadataDescribe.isChildComponent
              ? fileParts[fileParts.length - 3]
              : "",
            sourcePath: metadataFile.split("\\").join("/"),
            metadataJson: metadataJson[type]
          };

          result.push(component);
        }
      }
    }

    if (result.length > 0) {
      SFPowerkit.log(`Items Found ${result.length}`, LoggerLevel.INFO);

      if (this.flags.json || this.flags.format === "json") {
        await this.generateJsonOutput(result, this.flags.outputdir);
      } else if (this.flags.format === "csv") {
        await this.generateCSVOutput(result, this.flags.outputdir);
      } else {
        this.generateMdOutput(result, this.flags.outputdir);
      }
    } else {
      SFPowerkit.log(
        `Requested project doesnot have any datamodel entities`,
        LoggerLevel.INFO
      );
    }
    return result;
  }
  public async generateCSVOutput(result: any[], outputDir: string) {
    let outputcsvPath = `${outputDir}/output.csv`;
    let dir = path.parse(outputcsvPath).dir;
    if (!fs.existsSync(dir)) {
      FileUtils.mkDirByPathSync(dir);
    }
    let newLine = "\r\n";
    let output =
      "Metadata type,Name,ObjectName,fieldType,status(recordtypes/validation rules),source Path" +
      newLine;
    result.forEach(element => {
      let fieldType =
        element.metadatype === "CustomField" ? element.metadataJson.type : "";
      let status =
        element.metadatype === "RecordType" ||
        element.metadatype === "ValidationRule"
          ? element.metadataJson.active
          : "";
      output = `${output}${element.metadatype},${element.name},${element.objectName},${fieldType},${status},${element.sourcePath}${newLine}`;
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

  private generateMdOutput(result: any[], outputDir: string) {
    for (let item of result) {
      let filepath = outputDir + item.sourcePath.split("objects")[1] + ".md";
      filepath = filepath.split("/").join("\\");
      let dir = path.parse(filepath).dir;
      if (!fs.existsSync(dir)) {
        FileUtils.mkDirByPathSync(dir);
      }
      this.generateMdFromType(filepath, item);
    }
    SFPowerkit.log(
      `Output markdown files generated in ${outputDir} successfully`,
      LoggerLevel.INFO
    );
  }
  private generateMdFromType(filepath: string, file: any) {
    if (file.metadatype === "CustomField") {
      this.generateMdforCustomField(filepath, file.metadataJson);
    }
  }
  private generateMdforCustomField(filepath: string, metadataJson: any) {
    let codeblock = "\n````\n";
    let field = `## Name : ${metadataJson.fullName} \n---\n`;
    if (metadataJson.label) {
      field = `${field}**Label** : ${metadataJson.label}\n`;
    }
    if (metadataJson.type) {
      field = `${field}**Type** : ${metadataJson.type}\n`;
    }
    if (metadataJson.length) {
      field = `${field}**Length** : ${metadataJson.length}\n`;
    }
    if (metadataJson.precision) {
      field = `${field}**Decimal Precision** : ${metadataJson.precision}\n`;
    }
    if (metadataJson.visibleLines) {
      field = `${field}**Visible Lines** : ${metadataJson.visibleLines}\n`;
    }
    if (metadataJson.required) {
      field = `${field}**Required** : ${metadataJson.required}\n`;
    }
    if (metadataJson.unique) {
      field = `${field}**Unique** : ${metadataJson.unique}\n`;
    }
    if (metadataJson.description) {
      field = `${field}**Description** : ${metadataJson.description}\n`;
    }
    if (metadataJson.defaultValue) {
      field = `${field}**Default Value** : ${metadataJson.defaultValue}\n`;
    }
    if (metadataJson.deprecated) {
      field = `${field}**Deprecated** : ${metadataJson.deprecated}\n`;
    }
    if (metadataJson.caseSensitive) {
      field = `${field}**Case Sensitive** : ${metadataJson.caseSensitive}\n`;
    }
    if (metadataJson.complianceGroup) {
      field = `${field}**Compliance Group** : ${metadataJson.complianceGroup}\n`;
    }
    if (metadataJson.deleteConstraint) {
      field = `${field}**Delete Constraint** : ${metadataJson.deleteConstraint}\n`;
    }
    if (metadataJson.displayFormat) {
      field = `${field}**Display Format** : ${metadataJson.displayFormat}\n`;
    }
    if (metadataJson.startingNumber) {
      field = `${field}**Starting Number** : ${metadataJson.startingNumber}\n`;
    }
    if (metadataJson.encrypted) {
      field = `${field}**Encrypted** : ${metadataJson.encrypted}\n`;
    }
    if (metadataJson.encryptionScheme) {
      field = `${field}**Encryption Scheme** : ${metadataJson.encryptionScheme}\n`;
    }
    if (metadataJson.externalDeveloperName) {
      field = `${field}**External Developer Name** : ${metadataJson.externalDeveloperName}\n`;
    }
    if (metadataJson.externalId) {
      field = `${field}**ExternalId ?** : ${metadataJson.externalId}\n`;
    }
    if (metadataJson.fieldManageability) {
      field = `${field}**FieldManageability** : ${metadataJson.fieldManageability}\n`;
    }
    if (metadataJson.formula) {
      field = `${field}**Formula** : ${codeblock}${metadataJson.formula}${codeblock}`;
    }
    if (metadataJson.formulaTreatBlankAs) {
      field = `${field}**Formula Treat Blank As** : ${metadataJson.formulaTreatBlankAs}\n`;
    }
    if (metadataJson.inlineHelpText) {
      field = `${field}**Help Text** : ${metadataJson.inlineHelpText}\n`;
    }
    if (metadataJson.isAIPredictionField) {
      field = `${field}**AI Prediction Field ?** : ${metadataJson.isAIPredictionField}\n`;
    }
    if (metadataJson.isFilteringDisabled) {
      field = `${field}**Filtering Disabled ?** : ${metadataJson.isFilteringDisabled}\n`;
    }
    if (metadataJson.isNameField) {
      field = `${field}**Name Field ?** : ${metadataJson.isNameField}\n`;
    }
    if (metadataJson.isSortingDisabled) {
      field = `${field}**Sorting Disabled ?** : ${metadataJson.isSortingDisabled}\n`;
    }
    if (metadataJson.maskChar) {
      field = `${field}**Mask Character** : ${metadataJson.maskChar}\n`;
    }
    if (metadataJson.maskType) {
      field = `${field}**Mask Type** : ${metadataJson.maskType}\n`;
    }
    if (metadataJson["metadataRelationship​ControllingField"]) {
      field = `${field}**Metadata Relationship​ Controlling Field** : ${metadataJson["metadataRelationship​ControllingField"]}\n`;
    }
    if (metadataJson.populateExistingRows) {
      field = `${field}**Populate Existing Rows** : ${metadataJson.populateExistingRows}\n`;
    }
    if (metadataJson.referenceTargetField) {
      field = `${field}**Reference Target Field** : ${metadataJson.referenceTargetField}\n`;
    }
    if (metadataJson.referenceTo) {
      field = `${field}**Reference To** : ${metadataJson.referenceTo}\n`;
    }
    if (metadataJson.relationshipLabel) {
      field = `${field}**Relationship Label** : ${metadataJson.relationshipLabel}\n`;
    }
    if (metadataJson.relationshipName) {
      field = `${field}**Relationship Name** : ${metadataJson.relationshipName}\n`;
    }
    if (metadataJson.relationshipOrder) {
      field = `${field}**Relationship Order** : ${metadataJson.relationshipOrder}\n`;
    }
    if (metadataJson.reparentableMasterDetail) {
      field = `${field}**Reparentable MasterDetail ?** : ${metadataJson.reparentableMasterDetail}\n`;
    }
    if (metadataJson.scale) {
      field = `${field}**Scale** : ${metadataJson.scale}\n`;
    }
    if (metadataJson.securityClassification) {
      field = `${field}**Security Classification** : ${metadataJson.securityClassification}\n`;
    }
    if (metadataJson.stripMarkup) {
      field = `${field}**Strip Markup** : ${metadataJson.stripMarkup}\n`;
    }
    if (metadataJson.summarizedField) {
      field = `${field}**Summarized Field** : ${metadataJson.summarizedField}\n`;
    }
    if (metadataJson.summaryForeignKey) {
      field = `${field}**Summary ForeignKey** : ${metadataJson.summaryForeignKey}\n`;
    }
    if (metadataJson.summaryOperation) {
      field = `${field}**Summary Operation** : ${metadataJson.summaryOperation}\n`;
    }
    if (metadataJson.trackFeedHistory) {
      field = `${field}**Track Feed History** : ${metadataJson.trackFeedHistory}\n`;
    }
    if (metadataJson.trackHistory) {
      field = `${field}**Track History** : ${metadataJson.trackHistory}\n`;
    }
    if (metadataJson.trackTrending) {
      field = `${field}**Track Trending** : ${metadataJson.trackTrending}\n`;
    }
    if (metadataJson.writeRequiresMasterRead) {
      field = `${field}**write Requires MasterRead** : ${metadataJson.writeRequiresMasterRead}\n`;
    }
    if (metadataJson.summaryFilterItems) {
      field = `${field}**Summary Filter Items** : \nField | Operation | Value | ValueField \n--- | --- | --- | ---\n`;
      let members = metadataJson.summaryFilterItems;
      if (members.constructor === Array) {
        members.forEach(element => {
          field = `${field}${element.field} | ${element.operation} | ${element.value} | ${element.valueField} \n`;
        });
      } else {
        field = `${field}${members.field} | ${members.operation} | ${members.value} | ${members.valueField} \n\n`;
      }
    }
    if (metadataJson.valueSet) {
      field = `${field}**Picklist valueset** : \n`;
      field = `${field}Setting | Value \n --- | ---\n`;
      field = `${field}Restricted Picklist ? | ${metadataJson.valueSet.restricted} \n`;
      if (metadataJson.valueSet.valueSetName) {
        field = `${field}Globalvalueset | ${metadataJson.valueSet.valueSetName} \n`;
      }

      if (metadataJson.valueSet.controllingField) {
        field = `${field}Controlling Field | ${metadataJson.valueSet.controllingField} \n`;
      } else if (metadataJson.valueSet.valueSetDefinition) {
        field = `${field}Sorted | ${metadataJson.valueSet.valueSetDefinition.sorted} \n\n`;

        field = `${field}Label | Api Name | default\n---|---|---\n`;
        let members = metadataJson.valueSet.valueSetDefinition.value;
        if (members.constructor === Array) {
          members.forEach(element => {
            field = `${field}${element.label} | ${element.fullName} | ${element.default}\n`;
          });
          field = `${field}\n`;
        } else {
          field = `${field}${members.label} | ${members.fullName} | ${members.default}\n\n`;
        }
      }
      if (metadataJson.valueSet.valueSettings) {
        if (metadataJson.valueSet.constructor === Array) {
          //field = `${field}Controlling Field | ${metadataJson.valueSet.controllingField} \n`
        } else {
        }
      }
    }
    if (metadataJson.lookupFilter) {
      field = `${field}**Lookup Filter** : \n`;
    }
    fs.writeFileSync(filepath, field);
  }
}
