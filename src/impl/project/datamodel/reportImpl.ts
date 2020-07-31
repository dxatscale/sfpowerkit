import { LoggerLevel, SfdxError, SfdxProject } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";
import fs from "fs-extra";
import FileUtils from "../../../utils/fileutils";
import { METADATA_INFO } from "../../metadata/metadataInfo";
import xmlUtil from "../../../utils/xmlUtil";
import { AnyJson } from "@salesforce/ts-types";
import MarkdownGeneratorImpl from "./MarkdownGeneratorImpl";

var path = require("path");

export default class ReportImpl {
  private filtertype: string[];
  private objectspath: string[];
  private outputFormat: string;
  private outputDir: string;

  public constructor(
    filtertype: string[],
    objectspath: string[],
    outputFormat: string,
    outputDir: string
  ) {
    this.filtertype = filtertype;
    this.objectspath = objectspath;
    this.outputFormat = outputFormat;
    this.outputDir = outputDir;
  }

  public async generateReport(): Promise<AnyJson> {
    let allowedFilter = [
      "CustomField",
      "BusinessProcess",
      "RecordType",
      "ValidationRule",
      "CustomObject"
    ];
    this.filtertype.forEach(type => {
      if (!allowedFilter.includes(type)) {
        throw new SfdxError(
          `${type} is not a valid filter. Allowed filters are ${allowedFilter}`
        );
      }
    });

    // set default path from sfdx-project.json
    if (!this.objectspath) {
      this.objectspath = [];
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();
      let packages = (project.get("packageDirectories") as any[]) || [];

      this.objectspath = packages.map(packageDetail => packageDetail.path);
    }

    var metadataFiles: string[] = [];
    for (let dir of this.objectspath) {
      metadataFiles = metadataFiles.concat(FileUtils.getAllFilesSync(dir));
    }

    let result = [];
    for (let metadataFile of metadataFiles) {
      for (let type of this.filtertype) {
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

      if (this.outputFormat === "json") {
        await this.generateJsonOutput(result);
      } else if (this.outputFormat === "csv") {
        await this.generateCSVOutput(result);
      } else {
        this.generateMdOutput(result);
      }
    } else {
      SFPowerkit.log(
        `Requested project doesnot have any datamodel entities`,
        LoggerLevel.INFO
      );
    }

    return result;
  }
  public async generateCSVOutput(result: any[]) {
    let outputcsvPath = `${this.outputDir}/output.csv`;
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
      `Output ${this.outputDir}/output.csv is generated successfully`,
      LoggerLevel.INFO
    );
  }
  private async generateJsonOutput(result: any[]) {
    let outputJsonPath = `${this.outputDir}/output.json`;
    let dir = path.parse(outputJsonPath).dir;
    if (!fs.existsSync(dir)) {
      FileUtils.mkDirByPathSync(dir);
    }
    fs.writeFileSync(outputJsonPath, JSON.stringify(result));
    SFPowerkit.log(
      `Output ${this.outputDir}/output.json is generated successfully`,
      LoggerLevel.INFO
    );
  }

  private generateMdOutput(result: any[]) {
    for (let item of result) {
      let filepath =
        this.outputDir + item.sourcePath.split("objects")[1] + ".md";
      filepath = filepath.split("/").join("\\");
      let dir = path.parse(filepath).dir;
      if (!fs.existsSync(dir)) {
        FileUtils.mkDirByPathSync(dir);
      }
      this.generateMdFromType(filepath, item);
    }
    SFPowerkit.log(
      `Output markdown files generated in ${this.outputDir} successfully`,
      LoggerLevel.INFO
    );
  }
  private generateMdFromType(filepath: string, file: any) {
    let result = "";
    if (file.metadatype === "CustomField") {
      result = MarkdownGeneratorImpl.generateMdforCustomField(
        file.metadataJson
      );
    } else if (file.metadatype === "BusinessProcess") {
      result = MarkdownGeneratorImpl.generateMdforBusinessProcess(
        file.metadataJson
      );
    } else if (file.metadatype === "RecordType") {
      result = MarkdownGeneratorImpl.generateMdforRecordType(file.metadataJson);
    } else if (file.metadatype === "ValidationRule") {
      result = MarkdownGeneratorImpl.generateMdforValidationRule(
        file.metadataJson
      );
    } else if (file.metadatype === "CustomObject") {
      result = MarkdownGeneratorImpl.generateMdforCustomObject(
        file.metadataJson,
        file.name
      );
    }
    fs.writeFileSync(filepath, result);
  }
}
