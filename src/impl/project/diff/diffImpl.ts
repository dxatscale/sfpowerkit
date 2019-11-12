import MetadataFiles from "../../metadata/metadataFiles";
import simplegit = require("simple-git/promise");

import * as xml2js from "xml2js";
import * as path from "path";
import * as fs from "fs";
import rimraf = require("rimraf");
import {
  SOURCE_EXTENSION_REGEX,
  MetadataInfo,
  METADATA_INFO,
  UNSPLITED_METADATA,
  PROFILE_PERMISSIONSET_EXTENSION
} from "../../metadata/metadataInfo";
import FileUtils from "../../../utils/fileutils";
import _ from "lodash";
import ProfileDiff from "./profileDiff";
import PermsetDiff from "./permsetDiff";
import WorkflowDiff from "./workflowDiff";
import SharingRuleDiff from "./sharingRuleDiff";
import CustomLabelsDiff from "./customLabelsDiff";
import DiffUtil, { DiffFile, DiffFileStatus } from "./diffUtil";
import { core } from "@salesforce/command";

import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";

core.Messages.importMessagesDirectory(__dirname);
const messages = core.Messages.loadMessages("sfpowerkit", "project_diff");

const deleteNotSupported = ["RecordType"];

const git = simplegit();

const unsplitedMetadataExtensions = UNSPLITED_METADATA.map(elem => {
  return elem.sourceExtension;
});
const permissionExtensions = PROFILE_PERMISSIONSET_EXTENSION.map(elem => {
  return elem.sourceExtension;
});

export default class DiffImpl {
  destructivePackageObjPre: any[];
  destructivePackageObjPost: any[];
  resultOutput: {
    action: string;
    metadataType: string;
    componentName: string;
    path: string;
  }[];
  public constructor(
    private revisionFrom?: string,
    private revisionTo?: string,
    private isDestructive?: boolean
  ) {
    if (this.revisionTo == null || this.revisionTo.trim() === "") {
      this.revisionTo = "HEAD";
    }
    if (this.revisionFrom == null) {
      this.revisionFrom = "";
    }
    this.destructivePackageObjPost = new Array();
    this.destructivePackageObjPre = new Array();
    this.resultOutput = [];
  }

  public async build(
    diffFilePath: string,
    encoding: string,
    outputFolder: string
  ) {
    rimraf.sync(outputFolder);

    //const sepRegex=/\t| |\n/;
    const sepRegex = /\n|\r/;

    let data = "";

    if (diffFilePath !== null && diffFilePath !== "") {
      data = fs.readFileSync(diffFilePath, encoding);
    } else {
      //check if same commit
      const commitFrom = await git.raw([
        "rev-list",
        "-n",
        "1",
        this.revisionFrom
      ]);
      const commitTo = await git.raw(["rev-list", "-n", "1", this.revisionTo]);
      if (commitFrom === commitTo) {
        throw new Error(messages.getMessage("sameCommitErrorMessage"));
      }
      data = await git.diff(["--raw", this.revisionFrom, this.revisionTo]);

      SFPowerkit.log(
        `Input Param: From: ${this.revisionFrom}  To: ${this.revisionTo} `,
        LoggerLevel.INFO
      );
      SFPowerkit.log(
        `SHA Found From: ${commitFrom} To:  ${commitTo} `,
        LoggerLevel.INFO
      );

      SFPowerkit.log(data, LoggerLevel.TRACE);
    }

    let content = data.split(sepRegex);
    let diffFile: DiffFile = await DiffUtil.parseContent(content);

    await DiffUtil.fetchFileListRevisionTo(this.revisionTo);

    let filesToCopy = diffFile.addedEdited;
    let deletedFiles = diffFile.deleted;

    deletedFiles = deletedFiles.filter(deleted => {
      let found = false;
      let deletedMetadata = MetadataFiles.getFullApiNameWithExtension(
        deleted.path
      );
      for (let i = 0; i < filesToCopy.length; i++) {
        let addedOrEdited = MetadataFiles.getFullApiNameWithExtension(
          filesToCopy[i].path
        );
        if (deletedMetadata === addedOrEdited) {
          found = true;
          break;
        }
      }
      return !found;
    });

    if (fs.existsSync(outputFolder) == false) {
      fs.mkdirSync(outputFolder);
    }

    SFPowerkit.log("Files to be copied", LoggerLevel.DEBUG);
    SFPowerkit.log(filesToCopy, LoggerLevel.DEBUG);

    if (filesToCopy && filesToCopy.length > 0) {
      for (var i = 0; i < filesToCopy.length; i++) {
        let filePath = filesToCopy[i].path;
        let matcher = filePath.match(SOURCE_EXTENSION_REGEX);
        let extension = "";
        if (matcher) {
          extension = matcher[0];
        } else {
          extension = path.parse(filePath).ext;
        }

        if (unsplitedMetadataExtensions.includes(extension)) {
          //handle unsplited files
          await this.handleUnsplittedMetadata(filesToCopy[i], outputFolder);
        } else {
          await DiffUtil.copyFile(filePath, outputFolder);

          SFPowerkit.log(
            `Copied file ${filePath} to ${outputFolder}`,
            LoggerLevel.DEBUG
          );
        }
      }
    }

    if (deletedFiles && deletedFiles.length > 0 && this.isDestructive) {
      SFPowerkit.log("Creating Destructive Manifest..", LoggerLevel.INFO);
      await this.createDestructiveChanges(deletedFiles, outputFolder);
    }

    SFPowerkit.log(`Generating output summary`, LoggerLevel.INFO);

    this.buildOutput(outputFolder);

    if (this.resultOutput.length > 0) {
      try {
        DiffUtil.copyFile(".forceignore", outputFolder);
      } catch (e) {
        if (e.code !== "EPERM") {
          throw e;
        }
      }
      try {
        DiffUtil.copyFile("sfdx-project.json", outputFolder);
      } catch (e) {
        if (e.code !== "EPERM") {
          throw e;
        }
      }
    }

    return this.resultOutput;
  }

  private buildOutput(outputFolder) {
    let metadataFiles = new MetadataFiles();
    metadataFiles.loadComponents(outputFolder, false);

    let keys = Object.keys(METADATA_INFO);
    let excludedFiles = _.difference(
      unsplitedMetadataExtensions,
      permissionExtensions
    );

    keys.forEach(key => {
      if (METADATA_INFO[key].files && METADATA_INFO[key].files.length > 0) {
        METADATA_INFO[key].files.forEach(filePath => {
          let matcher = filePath.match(SOURCE_EXTENSION_REGEX);

          let extension = "";
          if (matcher) {
            extension = matcher[0];
          } else {
            extension = path.parse(filePath).ext;
          }

          if (!excludedFiles.includes(extension)) {
            let name = FileUtils.getFileNameWithoutExtension(
              filePath,
              METADATA_INFO[key].sourceExtension
            );

            if (METADATA_INFO[key].isChildComponent) {
              let fileParts = filePath.split(path.sep);
              let parentName = fileParts[fileParts.length - 3];
              name = parentName + "." + name;
            }

            this.resultOutput.push({
              action: "Deploy",
              metadataType: METADATA_INFO[key].xmlName,
              componentName: name,
              path: filePath
            });
          }
        });
      }
    });
    return this.resultOutput;
  }

  private async handleUnsplittedMetadata(
    diffFile: DiffFileStatus,
    outputFolder: string
  ) {
    let content1 = "";
    let content2 = "";

    try {
      if (diffFile.revisionFrom !== "0000000") {
        content1 = await git.show(["--raw", diffFile.revisionFrom]);
      }
    } catch (e) {}

    try {
      if (diffFile.revisionTo !== "0000000") {
        content2 = await git.show(["--raw", diffFile.revisionTo]);
      }
    } catch (e) {}

    FileUtils.mkDirByPathSync(
      path.join(outputFolder, path.parse(diffFile.path).dir)
    );

    if (diffFile.path.endsWith(METADATA_INFO.Workflow.sourceExtension)) {
      //Workflow
      let baseName = path.parse(diffFile.path).base;
      let objectName = baseName.split(".")[0];
      await WorkflowDiff.generateWorkflowXml(
        content1,
        content2,
        path.join(outputFolder, diffFile.path),
        objectName,
        this.destructivePackageObjPost,
        this.resultOutput,
        this.isDestructive
      );
    }

    if (diffFile.path.endsWith(METADATA_INFO.SharingRules.sourceExtension)) {
      let baseName = path.parse(diffFile.path).base;
      let objectName = baseName.split(".")[0];
      await SharingRuleDiff.generateSharingRulesXml(
        content1,
        content2,
        path.join(outputFolder, diffFile.path),
        objectName,
        this.destructivePackageObjPost,
        this.resultOutput,
        this.isDestructive
      );
    }
    if (diffFile.path.endsWith(METADATA_INFO.CustomLabels.sourceExtension)) {
      await CustomLabelsDiff.generateCustomLabelsXml(
        content1,
        content2,
        path.join(outputFolder, diffFile.path),
        this.destructivePackageObjPost,
        this.resultOutput,
        this.isDestructive
      );
    }

    if (diffFile.path.endsWith(METADATA_INFO.Profile.sourceExtension)) {
      //Deploy only what changed
      if (content1 === "") {
        await DiffUtil.copyFile(diffFile.path, outputFolder);

        SFPowerkit.log(
          `Copied file ${diffFile.path} to ${outputFolder}`,
          LoggerLevel.DEBUG
        );
      } else if (content2 === "") {
        //The profile is deleted or marked as renamed.
        //Delete the renamed one
        let profileType: any = _.find(this.destructivePackageObjPost, function(
          metaType: any
        ) {
          return metaType.name === METADATA_INFO.Profile.xmlName;
        });
        if (profileType === undefined) {
          profileType = {
            name: METADATA_INFO.Profile.xmlName,
            members: []
          };
          this.destructivePackageObjPost.push(profileType);
        }

        let baseName = path.parse(diffFile.path).base;
        let profileName = baseName.split(".")[0];
        profileType.members.push(profileName);
      } else {
        await ProfileDiff.generateProfileXml(
          content1,
          content2,
          path.join(outputFolder, diffFile.path)
        );
      }
    }
    if (diffFile.path.endsWith(METADATA_INFO.PermissionSet.sourceExtension)) {
      let sourceApiVersion = await SFPowerkit.getApiVersion();
      if (content1 === "") {
        await DiffUtil.copyFile(diffFile.path, outputFolder);

        SFPowerkit.log(
          `Copied file ${diffFile.path} to ${outputFolder}`,
          LoggerLevel.DEBUG
        );
      } else if (sourceApiVersion <= 39.0) {
        // in API 39 and erliar PermissionSet deployment are merged. deploy only what changed
        if (content2 === "") {
          //Deleted permissionSet
          let permsetType: any = _.find(
            this.destructivePackageObjPost,
            function(metaType: any) {
              return metaType.name === METADATA_INFO.PermissionSet.xmlName;
            }
          );
          if (permsetType === undefined) {
            permsetType = {
              name: METADATA_INFO.PermissionSet.xmlName,
              members: []
            };
            this.destructivePackageObjPost.push(permsetType);
          }

          let baseName = path.parse(diffFile.path).base;
          let permsetName = baseName.split(".")[0];
          permsetType.members.push(permsetName);
        } else {
          await PermsetDiff.generatePermissionsetXml(
            content1,
            content2,
            path.join(outputFolder, diffFile.path)
          );
        }
      } else {
        //PermissionSet deployment override in the target org
        //So deploy the whole file

        await DiffUtil.copyFile(diffFile.path, outputFolder);
        SFPowerkit.log(
          `Copied file ${diffFile.path} to ${outputFolder}`,
          LoggerLevel.DEBUG
        );
      }
    }
  }

  private async createDestructiveChanges(
    filePaths: DiffFileStatus[],
    outputFolder: string
  ) {
    if (_.isNil(this.destructivePackageObjPost)) {
      this.destructivePackageObjPost = new Array();
    } else {
      this.destructivePackageObjPost = this.destructivePackageObjPost.filter(
        metaType => {
          return !_.isNil(metaType.members) && metaType.members.length > 0;
        }
      );
    }
    this.destructivePackageObjPre = new Array();
    //returns root, dir, base and name
    for (let i = 0; i < filePaths.length; i++) {
      let filePath = filePaths[i].path;

      let matcher = filePath.match(SOURCE_EXTENSION_REGEX);
      let extension = "";
      if (matcher) {
        extension = matcher[0];
      } else {
        extension = path.parse(filePath).ext;
      }
      if (unsplitedMetadataExtensions.includes(extension)) {
        //handle unsplited files
        await this.handleUnsplittedMetadata(filePaths[i], outputFolder);
        continue;
      }

      let parsedPath = path.parse(filePath);
      let filename = parsedPath.base;
      let name = MetadataInfo.getMetadataName(filePath);

      if (name) {
        if (!MetadataFiles.isCustomMetadata(filePath, name)) {
          // avoid to generate destructive for Standard Components
          //Support on Custom Fields and Custom Objects for now

          this.resultOutput.push({
            action: "Skip ",
            componentName: MetadataFiles.getMemberNameFromFilepath(
              filePath,
              name
            ),
            metadataType: "StandardField/CustomMetadata",
            path: "--"
          });

          continue;
        }
        let member = MetadataFiles.getMemberNameFromFilepath(filePath, name);
        if (name === METADATA_INFO.CustomField.xmlName) {
          let isFormular = await DiffUtil.isFormulaField(filePaths[i]);
          if (isFormular) {
            this.destructivePackageObjPre = this.buildDestructiveTypeObj(
              this.destructivePackageObjPre,
              name,
              member
            );

            SFPowerkit.log(
              `${filePath} ${MetadataFiles.isCustomMetadata(filePath, name)}`,
              LoggerLevel.DEBUG
            );

            this.resultOutput.push({
              action: "Delete",
              componentName: member,
              metadataType: name,
              path: "Manual Intervention Required"
            });
          } else {
            this.destructivePackageObjPost = this.buildDestructiveTypeObj(
              this.destructivePackageObjPost,
              name,
              member
            );
          }
          SFPowerkit.log(
            `${filePath} ${MetadataFiles.isCustomMetadata(filePath, name)}`,
            LoggerLevel.DEBUG
          );

          this.resultOutput.push({
            action: "Delete",
            componentName: member,
            metadataType: name,
            path: "destructiveChanges.xml"
          });
        } else {
          if (!deleteNotSupported.includes(name)) {
            this.destructivePackageObjPost = this.buildDestructiveTypeObj(
              this.destructivePackageObjPost,
              name,
              member
            );
            this.resultOutput.push({
              action: "Delete",
              componentName: member,
              metadataType: name,
              path: "destructiveChanges.xml"
            });
          } else {
            //add the component in the manual action list
            // TODO
          }
        }
      }
    }

    // this.writeDestructivechanges(
    //   this.destructivePackageObjPre,
    //   outputFolder,
    //   "destructiveChangesPre.xml"
    // );
    this.writeDestructivechanges(
      this.destructivePackageObjPost,
      outputFolder,
      "destructiveChanges.xml"
    );
  }

  private writeDestructivechanges(
    destrucObj: Array<any>,
    outputFolder: string,
    fileName: string
  ) {
    //ensure unique component per type
    for (let i = 0; i < destrucObj.length; i++) {
      destrucObj[i].members = _.uniq(destrucObj[i].members);
    }
    destrucObj = destrucObj.filter(metaType => {
      return metaType.members && metaType.members.length > 0;
    });

    if (destrucObj.length > 0) {
      let dest = {
        Package: {
          $: {
            xmlns: "http://soap.sforce.com/2006/04/metadata"
          },
          types: destrucObj
        }
      };

      let destructivePackageName = fileName;
      let filepath = path.join(outputFolder, destructivePackageName);
      let builder = new xml2js.Builder();
      let xml = builder.buildObject(dest);
      fs.writeFileSync(filepath, xml);
    }
  }

  private buildDestructiveTypeObj(destructiveObj, name, member) {
    let typeIsPresent: boolean = false;
    for (let i = 0; i < destructiveObj.length; i++) {
      if (destructiveObj[i].name === name) {
        typeIsPresent = true;
        destructiveObj[i].members.push(member);
        break;
      }
    }
    let typeNode: any;
    if (typeIsPresent === false) {
      typeNode = {
        name: name,
        members: [member]
      };
      destructiveObj.push(typeNode);
    }
    return destructiveObj;
  }
}
