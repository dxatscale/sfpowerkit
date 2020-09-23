import { LoggerLevel, SfdxError, SfdxProject } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";
import fs from "fs-extra";
import FileUtils from "../../../utils/fileutils";
import { METADATA_INFO } from "../../metadata/metadataInfo";
import xmlUtil from "../../../utils/xmlUtil";
import { AnyJson } from "@salesforce/ts-types";
import MarkdownGeneratorImpl from "./MarkdownGeneratorImpl";
import { isNullOrUndefined } from "util";
import ChangeLogImpl from "./ChangeLogImpl";

var path = require("path");
const SEP = /\/|\\/;

export default class ReportImpl {
  private filtertype: string[];
  private objectspath: string[];
  private outputFormat: string;
  private outputDir: string;
  private includechangelog: boolean;
  private existingchangelogPath: string;
  private git;

  public constructor(
    filtertype: string[],
    objectspath: string[],
    outputFormat: string,
    outputDir: string,
    includechangelog: boolean = false,
    existingchangelogPath: string,
    git
  ) {
    this.filtertype = filtertype;
    this.objectspath = objectspath;
    this.outputFormat = outputFormat;
    this.outputDir = outputDir;
    this.includechangelog = includechangelog;
    this.existingchangelogPath = existingchangelogPath;
    this.git = git;
  }

  public async generateReport(): Promise<AnyJson> {
    let allowedFilter = [
      "CustomField",
      "BusinessProcess",
      "RecordType",
      "ValidationRule",
      "CustomObject",
    ];
    this.filtertype.forEach((type) => {
      if (!allowedFilter.includes(type)) {
        throw new SfdxError(
          `${type} is not a valid filter. Allowed filters are ${allowedFilter}`
        );
      }
    });
    SFPowerkit.log("Filters applied : " + this.filtertype, LoggerLevel.DEBUG);

    // set default path from sfdx-project.json
    if (!this.objectspath) {
      this.objectspath = [];
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();
      let packages = (project.get("packageDirectories") as any[]) || [];

      this.objectspath = packages.map((packageDetail) => packageDetail.path);
    }

    if (!this.objectspath) {
      throw new Error("You must provide a valid path");
    }

    SFPowerkit.log("Paths to process : " + this.objectspath, LoggerLevel.DEBUG);

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

          let fileParts = metadataFile.split(SEP);

          let metadataJson = await xmlUtil.xmlToJSON(metadataFile);
          delete metadataJson[type]["$"];
          let packageName = await SFPowerkit.getPackageName(
            metadataFile.split("\\").join("/")
          );
          let component = {
            name: name,
            metadatype: type,
            objectName: metadataDescribe.isChildComponent
              ? fileParts[fileParts.length - 3]
              : "",
            sourcePath: metadataFile.split("\\").join("/"),
            metadataJson: metadataJson[type],
            package: packageName,
          };

          result.push(component);
        }
      }
    }

    if (result.length > 0) {
      SFPowerkit.log(`Items Found ${result.length}`, LoggerLevel.INFO);

      let changeLog = await this.generateChangelog(result);

      if (this.outputFormat === "json") {
        await this.generateJsonOutput(result);
      } else if (this.outputFormat === "csv") {
        await this.generateCSVOutput(result);
      } else {
        this.generateMdOutput(result, changeLog);
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
    let outputcsvPath = `${this.outputDir}${path.sep}output.csv`;
    let dir = path.parse(outputcsvPath).dir;
    if (!fs.existsSync(dir)) {
      FileUtils.mkDirByPathSync(dir);
    }
    let newLine = "\r\n";
    let output =
      "Metadata type,Name,Label,ObjectName,fieldType,status(recordtypes/validation rules),Package Name,source Path" +
      newLine;
    result.forEach((element) => {
      let fieldType =
        element.metadatype === "CustomField" &&
        !isNullOrUndefined(element.metadataJson.type)
          ? element.metadataJson.type
          : "";
      let status =
        element.metadatype === "RecordType" ||
        element.metadatype === "ValidationRule"
          ? element.metadataJson.active
          : "";
      let elementLabel = !isNullOrUndefined(element.metadataJson.label)
        ? element.metadataJson.label
        : "";
      output = `${output}${element.metadatype},${element.name},${elementLabel},${element.objectName},${fieldType},${status},${element.package},${element.sourcePath}${newLine}`;
    });
    fs.writeFileSync(outputcsvPath, output);
    SFPowerkit.log(
      `Output ${outputcsvPath} is generated successfully`,
      LoggerLevel.INFO
    );
  }
  private async generateJsonOutput(result: any[]) {
    let outputJsonPath = `${this.outputDir}${path.sep}output.json`;
    let dir = path.parse(outputJsonPath).dir;
    if (!fs.existsSync(dir)) {
      FileUtils.mkDirByPathSync(dir);
    }
    fs.writeFileSync(outputJsonPath, JSON.stringify(result));
    SFPowerkit.log(
      `Output ${outputJsonPath} is generated successfully`,
      LoggerLevel.INFO
    );
  }

  private generateMdOutput(result: any[], changeLog: any) {
    MarkdownGeneratorImpl.loadSchema();

    for (let item of result) {
      let filepath =
        this.outputDir + item.sourcePath.split("objects")[1] + ".md";
      filepath = filepath.split("/").join(path.sep);
      let dir = path.parse(filepath).dir;
      if (!fs.existsSync(dir)) {
        FileUtils.mkDirByPathSync(dir);
      }
      this.generateMdFromType(filepath, item, changeLog);
    }
    SFPowerkit.log(
      `Output markdown files generated in ${this.outputDir} successfully`,
      LoggerLevel.INFO
    );
  }
  private generateMdFromType(filepath: string, file: any, changeLog: any) {
    let result = "";
    if (file.metadatype === "CustomField") {
      result = MarkdownGeneratorImpl.generateMdforCustomField(file);
    } else if (file.metadatype === "BusinessProcess") {
      result = MarkdownGeneratorImpl.generateMdforBusinessProcess(file);
    } else if (file.metadatype === "RecordType") {
      result = MarkdownGeneratorImpl.generateMdforRecordType(file);
    } else if (file.metadatype === "ValidationRule") {
      result = MarkdownGeneratorImpl.generateMdforValidationRule(file);
    } else if (file.metadatype === "CustomObject") {
      result = MarkdownGeneratorImpl.generateMdforCustomObject(file);
    }
    let keys = Object.keys(changeLog);
    if (keys.includes(file.sourcePath)) {
      let fileLog = changeLog[file.sourcePath];
      result = `${result}\n\n#### Change log : \n---\n Date | Commit | Author | Operation | Coordinates | Before | After \n--- | --- | --- | --- | --- | --- | ---\n`;

      for (let change of fileLog) {
        for (let diff of change.diff) {
          result = `${result} ${change.date} | ${change.to} | ${
            change.author
          } | ${diff.operation} | ${diff.coordinates} | ${
            diff.before ? diff.before : ""
          } | ${diff.after ? diff.after : ""}\n`;
        }
      }
    }
    fs.writeFileSync(filepath, result);
  }
  private async generateChangelog(metadataFiles: any[]) {
    let changeLog = {};
    if (this.includechangelog) {
      let activeLogFrom;
      let activeLogTo;
      if (
        this.existingchangelogPath &&
        fs.existsSync(this.existingchangelogPath)
      ) {
        SFPowerkit.log(
          `Loading active change Log  ${this.existingchangelogPath}`,
          LoggerLevel.DEBUG
        );
        let activeLog = JSON.parse(
          fs.readFileSync(`${this.existingchangelogPath}`, "utf8")
        );
        if (activeLog && activeLog.revisionTo && activeLog.changeLog) {
          changeLog = activeLog.changeLog;
          activeLogFrom = activeLog.revisionFrom;
          activeLogTo = activeLog.revisionTo;
        }
      }

      if (!activeLogTo) {
        // get git log to find last commit id
        let options = {
          format: { hash: "%H", date: "%ai", author_name: "%aN" },
          "--reverse": true,
          file: "**/objects/*-meta.xml",
        };
        let gitLog = await this.git.log(options);
        activeLogTo = gitLog.latest.hash;
      }
      const revisionFrom: string = await this.git.revparse([
        "--short",
        activeLogTo,
      ]);
      const revisionTo: string = await this.git.revparse(["--short", "HEAD"]);

      if (revisionFrom != revisionTo) {
        SFPowerkit.log(
          `Fetching change Log from ${revisionFrom} to ${revisionTo} `,
          LoggerLevel.DEBUG
        );
        let parsedPath = metadataFiles.map((file) => file.sourcePath);
        let changeLogImpl = new ChangeLogImpl(
          this.git,
          revisionFrom,
          revisionTo,
          parsedPath
        );

        let generatedChangeLog = await changeLogImpl.exec();

        if (changeLog && Object.keys(changeLog).length > 0) {
          Object.keys(generatedChangeLog).forEach((key) => {
            if (changeLog[key]) {
              changeLog[key].push(generatedChangeLog[key]);
            } else {
              changeLog[key] = generatedChangeLog[key];
            }
          });
        } else {
          changeLog = generatedChangeLog;
        }

        let outputPath = `${this.outputDir}${path.sep}changeLog.json`;
        let dir = path.parse(outputPath).dir;
        if (!fs.existsSync(dir)) {
          FileUtils.mkDirByPathSync(dir);
        }

        fs.writeFileSync(
          outputPath,
          JSON.stringify({
            revisionFrom: activeLogFrom ? activeLogFrom : revisionFrom,
            revisionTo: revisionTo,
            changeLog: changeLog,
          })
        );
        SFPowerkit.log(
          `Change log ${outputPath} is generated successfully`,
          LoggerLevel.INFO
        );
      }
    }
    return changeLog;
  }
}
