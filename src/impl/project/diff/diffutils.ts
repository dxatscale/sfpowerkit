import MetadataFiles from "../../../shared/metadataFiles";
import simplegit = require("simple-git/promise");

import * as xml2js from "xml2js";
import * as path from "path";
import * as fs from "fs";
import * as glob from "glob";
import {
  SOURCE_EXTENSION_REGEX,
  MetadataInfoUtils,
  METADATA_INFO
} from "../../../shared/metadataInfo";
import FileUtils from "../../../shared/fileutils";
import _ from "lodash";
import ProfileDiff from "../../project/diff/profileDiff";
import PermsetDiff from "../../project/diff/permsetDiff";
import WorkflowDiff from "./workflowDiff";
import SharingRuleDiff from "./sharingRuleDiff";
import CustomLabelsDiff from "./customLabelsDiff";

const pairStatResources = METADATA_INFO.StaticResource.directoryName;
const pairStatResourcesRegExp = new RegExp(pairStatResources);
const pairAuaraRegExp = new RegExp(
  METADATA_INFO.AuraDefinitionBundle.directoryName
);

const deleteNotSupported = ["RecordType"];
const LWC_IGNORE_FILES = ["jsconfig.json", ".eslintrc.json"]; //Enforcing .forceignore will remove this constant

const UNSPLITED_METADATA_EXTENSION = [
  ".workflow-meta.xml",
  ".sharingRules-meta.xml",
  ".labels-meta.xml",
  ".permissionset-meta.xml",
  ".profile-meta.xml"
];
const PROFILE_PERMISSIONSET_EXTENSION = [
  ".permissionset-meta.xml",
  ".profile-meta.xml"
];

export interface DiffFileStatus {
  revisionFrom: string;
  revisionTo: string;
  path: string;
  renamedPath?: string;
}

export interface DiffFile {
  deleted: DiffFileStatus[];
  addedEdited: DiffFileStatus[];
}

const git = simplegit();

export default class DiffUtil {
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
    private revisionTo?: string
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
    //const sepRegex=/\t| |\n/;
    const sepRegex = /\n|\r/;

    let data = "";

    if (diffFilePath !== null && diffFilePath !== "") {
      data = fs.readFileSync(diffFilePath, encoding);
    } else {
      data = await git.diff(["--raw", this.revisionFrom, this.revisionTo]);
    }

    let content = data.split(sepRegex);
    let diffFile: DiffFile = this.parseContent(content);
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
        if (UNSPLITED_METADATA_EXTENSION.includes(extension)) {
          //handle unsplited files
          await this.handleUnsplitedMetadata(filesToCopy[i], outputFolder);
        } else {
          this.copyFile(filePath, outputFolder);
        }
      }
    }

    if (deletedFiles && deletedFiles.length > 0) {
      await this.createDestructiveChanges(deletedFiles, outputFolder);
    }

    try {
      this.copyFile(".forceignore", outputFolder);
    } catch (e) {
      if (e.code !== "EPERM") {
        throw e;
      }
    }
    try {
      this.copyFile("sfdx-project.json", outputFolder);
    } catch (e) {
      if (e.code !== "EPERM") {
        throw e;
      }
    }

    this.buildOutput(outputFolder);
    return this.resultOutput;
  }
  public parseContent(fileContents): DiffFile {
    const statusRegEx = /\sA\t|\sM\t|\sD\t/;
    const renamedRegEx = /\sR[0-9]{3}\t|\sC[0-9]{3}\t/;
    const tabRegEx = /\t/;
    const deletedFileRegEx = new RegExp(/\sD\t/);
    const lineBreakRegEx = /\r?\n|\r|( $)/;
    const editedFileRegEx = new RegExp(/\sM\t/);

    var diffFile: DiffFile = {
      deleted: [],
      addedEdited: []
    };

    for (var i = 0; i < fileContents.length; i++) {
      if (statusRegEx.test(fileContents[i])) {
        var lineParts = fileContents[i].split(statusRegEx);

        var finalPath = path.join(
          ".",
          lineParts[1].replace(lineBreakRegEx, "")
        );
        finalPath = finalPath.trim();
        finalPath = finalPath.replace("\\303\\251", "é");

        let revisionPart = lineParts[0].split(/\t|\s/);

        if (deletedFileRegEx.test(fileContents[i])) {
          //Deleted
          diffFile.deleted.push({
            revisionFrom: revisionPart[2].substring(0, 9),
            revisionTo: revisionPart[3].substring(0, 9),
            path: finalPath
          });
        } else {
          // Added or edited
          diffFile.addedEdited.push({
            revisionFrom: revisionPart[2].substring(0, 9),
            revisionTo: revisionPart[3].substring(0, 9),
            path: finalPath
          });
        }
      } else if (renamedRegEx.test(fileContents[i])) {
        var lineParts = fileContents[i].split(renamedRegEx);

        var pathsParts = path.join(".", lineParts[1].trim());
        pathsParts = pathsParts.replace("\\303\\251", "é");
        let revisionPart = lineParts[0].split(/\t|\s/);

        var paths = pathsParts.split(tabRegEx);

        diffFile.addedEdited.push({
          revisionFrom: "000000000",
          revisionTo: revisionPart[3],
          renamedPath: paths[0].trim(),
          path: paths[1].trim()
        });

        //allow deletion of renamed components
        diffFile.deleted.push({
          revisionFrom: revisionPart[2],
          revisionTo: "000000000",
          path: paths[0].trim()
        });
      }
    }
    return diffFile;
  }

  private buildOutput(outputFolder) {
    let metadataFiles = new MetadataFiles();
    metadataFiles.loadComponents(outputFolder);

    let keys = Object.keys(METADATA_INFO);
    let excludedFiles = _.difference(
      UNSPLITED_METADATA_EXTENSION,
      PROFILE_PERMISSIONSET_EXTENSION
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

  public async handleUnsplitedMetadata(
    diffFile: DiffFileStatus,
    outputFolder: string
  ) {
    let content1 = "";
    let content2 = "";

    try {
      content1 = await git.show(["--raw", diffFile.revisionFrom]);
    } catch (e) {}

    try {
      content2 = await git.show(["--raw", diffFile.revisionTo]);
    } catch (e) {}

    if (content1 === "") {
      //The metadata is added
      this.copyFile(diffFile.path, outputFolder);
      return;
    }

    FileUtils.mkDirByPathSync(
      path.join(outputFolder, path.parse(diffFile.path).dir)
    );

    if (diffFile.path.endsWith(".workflow-meta.xml")) {
      //Workflow
      let baseName = path.parse(diffFile.path).base;
      let objectName = baseName.split(".")[0];
      await WorkflowDiff.generateWorkflowXml(
        content1,
        content2,
        path.join(outputFolder, diffFile.path),
        objectName,
        this.destructivePackageObjPost,
        this.resultOutput
      );
    }

    if (diffFile.path.endsWith(".sharingRules-meta.xml")) {
      let baseName = path.parse(diffFile.path).base;
      let objectName = baseName.split(".")[0];
      await SharingRuleDiff.generateSharingRulesXml(
        content1,
        content2,
        path.join(outputFolder, diffFile.path),
        objectName,
        this.destructivePackageObjPost,
        this.resultOutput
      );
    }
    if (diffFile.path.endsWith(".labels-meta.xml")) {
      await CustomLabelsDiff.generateCustomLabelsXml(
        content1,
        content2,
        path.join(outputFolder, diffFile.path),
        this.destructivePackageObjPost,
        this.resultOutput
      );
    }

    if (diffFile.path.endsWith(".profile-meta.xml")) {
      if (content2 === "") {
        //The profile is deleted or marked as renamed.
        //Delete the renamed one
        let profileType: any = _.find(this.destructivePackageObjPost, function(
          metaType: any
        ) {
          return metaType.name === "Profile";
        });
        if (profileType === undefined) {
          profileType = {
            name: "Profile",
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
    if (diffFile.path.endsWith(".permissionset-meta.xml")) {
      if (content2 === "") {
        //Deleted permissionSet
        let permsetType: any = _.find(this.destructivePackageObjPost, function(
          metaType: any
        ) {
          return metaType.name === "PermissionSet";
        });
        if (permsetType === undefined) {
          permsetType = {
            name: "PermissionSet",
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
    }
  }

  public copyFile(filePath: string, outputFolder: string) {
    let copyOutputFolder = outputFolder;
    if (filePath.startsWith(".")) {
      // exclude technical files such as .gitignore or .forceignore
      fs.copyFileSync(filePath, outputFolder);
      return;
    }

    let fileName = path.parse(filePath).base;
    //exclude lwc ignored files
    if (LWC_IGNORE_FILES.includes(fileName)) {
      return;
    }

    let exists = fs.existsSync(path.join(outputFolder, filePath));
    if (exists) {
      return;
    }

    let filePathParts = filePath.split(path.sep);

    if (fs.existsSync(outputFolder) == false) {
      fs.mkdirSync(outputFolder);
    }
    for (let i = 0; i < filePathParts.length - 1; i++) {
      let folder = filePathParts[i].replace('"', "");
      outputFolder = path.join(outputFolder, folder);
      if (fs.existsSync(outputFolder) == false) {
        fs.mkdirSync(outputFolder);
      }
    }

    //let fileName = filePathParts[filePathParts.length - 1].replace('"', "");
    let associatedFilePattern = "";
    if (SOURCE_EXTENSION_REGEX.test(filePath)) {
      associatedFilePattern = filePath.replace(SOURCE_EXTENSION_REGEX, ".*");
    } else {
      let extension = path.parse(filePath).ext;
      associatedFilePattern = filePath.replace(extension, ".*");
    }
    let files = glob.sync(associatedFilePattern);
    for (let i = 0; i < files.length; i++) {
      if (fs.lstatSync(files[i]).isDirectory() == false) {
        let oneFilePath = path.join(".", files[i]);
        let oneFilePathParts = oneFilePath.split(path.sep);
        fileName = oneFilePathParts[oneFilePathParts.length - 1];
        let outputPath = path.join(outputFolder, fileName);
        fs.copyFileSync(files[i], outputPath);
      }
    }

    if (
      filePath.endsWith("Translation-meta.xml") &&
      filePath.indexOf("globalValueSet") < 0
    ) {
      let parentFolder = filePathParts[filePathParts.length - 2];
      let objectTranslation =
        parentFolder + METADATA_INFO.CustomObjectTranslation.sourceExtension;
      let outputPath = path.join(outputFolder, objectTranslation);
      let sourceFile = filePath.replace(fileName, objectTranslation);
      if (fs.existsSync(sourceFile) == true) {
        fs.copyFileSync(sourceFile, outputPath);
      }
    }

    //FOR STATIC RESOURCES - WHERE THE CORRESPONDING DIRECTORY + THE ROOT META FILE HAS TO BE INCLUDED
    if (pairStatResourcesRegExp.test(filePath)) {
      outputFolder = path.join(".", copyOutputFolder);
      let srcFolder = ".";
      let staticRecourceRoot = "";
      let resourceFile = "";
      for (let i = 0; i < filePathParts.length; i++) {
        outputFolder = path.join(outputFolder, filePathParts[i]);
        srcFolder = path.join(srcFolder, filePathParts[i]);
        if (filePathParts[i] === METADATA_INFO.StaticResource.directoryName) {
          let fileOrDirname = filePathParts[i + 1];
          let fileOrDirnameParts = fileOrDirname.split(".");
          srcFolder = path.join(srcFolder, fileOrDirnameParts[0]);
          outputFolder = path.join(outputFolder, fileOrDirnameParts[0]);
          resourceFile =
            srcFolder + METADATA_INFO.StaticResource.sourceExtension;
          METADATA_INFO.StaticResource.sourceExtension;
          staticRecourceRoot =
            outputFolder + METADATA_INFO.StaticResource.sourceExtension;
          if (fs.existsSync(srcFolder)) {
            if (fs.existsSync(outputFolder) == false) {
              fs.mkdirSync(outputFolder);
            }
          }
          break;
        }
      }
      if (fs.existsSync(srcFolder)) {
        FileUtils.copyRecursiveSync(srcFolder, outputFolder);
      }
      if (fs.existsSync(resourceFile)) {
        fs.copyFileSync(resourceFile, staticRecourceRoot);
      }
    }
    //FOR AURA components
    if (pairAuaraRegExp.test(filePath)) {
      outputFolder = path.join(".", copyOutputFolder);
      let srcFolder = ".";
      for (let i = 0; i < filePathParts.length; i++) {
        outputFolder = path.join(outputFolder, filePathParts[i]);
        srcFolder = path.join(srcFolder, filePathParts[i]);
        if (filePathParts[i] === "aura" || filePathParts[i] === "lwc") {
          let fileOrDirname = filePathParts[i + 1];
          let fileOrDirnameParts = fileOrDirname.split(".");
          srcFolder = path.join(srcFolder, fileOrDirnameParts[0]);
          outputFolder = path.join(outputFolder, fileOrDirnameParts[0]);

          if (fs.existsSync(srcFolder)) {
            if (fs.existsSync(outputFolder) == false) {
              fs.mkdirSync(outputFolder);
            }
          }
          break;
        }
      }
      if (fs.existsSync(srcFolder)) {
        FileUtils.copyRecursiveSync(srcFolder, outputFolder);
      }
    }
  }

  public async createDestructiveChanges(
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
      if (UNSPLITED_METADATA_EXTENSION.includes(extension)) {
        //handle unsplited files
        await this.handleUnsplitedMetadata(filePaths[i], outputFolder);
        continue;
      }

      let parsedPath = path.parse(filePath);
      let filename = parsedPath.base;
      let name = MetadataInfoUtils.getMetadataName(filename);
      if (name) {
        if (!MetadataFiles.isCustomMetadata(filePath, name)) {
          // avoid to generate destructive for Standard Components
          //Support on Custom Fields, Custom Objects and Layout for now
          continue;
        }
        let member = MetadataFiles.getMemberNameFromFilepath(filePath, name);
        if (name === METADATA_INFO.CustomField.xmlName) {
          let isFormular = await this.isFormularField(filePaths[i]);
          if (isFormular) {
            this.destructivePackageObjPre = this.buildDestructiveTypeObj(
              this.destructivePackageObjPre,
              name,
              member
            );
          } else {
            this.destructivePackageObjPost = this.buildDestructiveTypeObj(
              this.destructivePackageObjPost,
              name,
              member
            );
          }
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

    this.writeDestructivechanges(
      this.destructivePackageObjPre,
      outputFolder,
      "destructiveChangesPre.xml"
    );
    this.writeDestructivechanges(
      this.destructivePackageObjPost,
      outputFolder,
      "destructiveChangesPost.xml"
    );
  }

  writeDestructivechanges(
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

  async isFormularField(diffFile: DiffFileStatus): Promise<boolean> {
    let content = await git.show(["--raw", diffFile.revisionFrom]);
    let result = content.includes("<formula>");
    return result;
  }

  private buildDestructiveTypeObj(destructiveObj, name, member) {
    let typeIsPresent: boolean = false;
    for (let i = 0; i < destructiveObj.length; i++) {
      if (destructiveObj[i].name === name) {
        typeIsPresent = true;
        destructiveObj.members.push(member);
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

  public static getChangedOrAdded(list1: any[], list2: any[], key: string) {
    let result: any = {
      addedEdited: [],
      deleted: []
    };

    if (_.isNil(list1) && !_.isNil(list2) && list2.length > 0) {
      result.addedEdited.push(...list2);
    }

    if (_.isNil(list2) && !_.isNil(list1) && list1.length > 0) {
      result.deleted.push(...list1);
    }

    if (!_.isNil(list1) && !_.isNil(list2)) {
      list1.forEach(elem1 => {
        let found = false;
        for (let i = 0; i < list2.length; i++) {
          let elem2 = list2[i];
          if (elem1[key] === elem2[key]) {
            //check if edited
            if (!_.isEqual(elem1, elem2)) {
              result.addedEdited.push(elem2);
            }
            found = true;
            break;
          }
        }
        if (!found) {
          result.deleted.push(elem1);
        }
      });

      //Check for added elements

      let addedElement = _.differenceWith(list2, list1, function(
        element1: any,
        element2: any
      ) {
        return element1[key] === element2[key];
      });

      if (!_.isNil(addedElement)) {
        result.addedEdited.push(...addedElement);
      }
    }
    return result;
  }
}
