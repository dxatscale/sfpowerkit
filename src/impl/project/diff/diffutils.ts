import MetadataFiles from "../../../shared/metadataFiles";

const { spawnSync } = require("child_process");

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

const pairStatResources = METADATA_INFO.StaticResource.directoryName;
const pairStatResourcesRegExp = new RegExp(pairStatResources);
const pairAuaraRegExp = new RegExp(
  METADATA_INFO.AuraDefinitionBundle.directoryName
);

const deleteNotSupported = ["RecordType"];
const LWC_IGNORE_FILES = ["jsconfig.json", ".eslintrc.json"];

const UNSPLITED_METADATA_EXTENSION = [
  ".workflow-meta.xml",
  ".sharingRules-meta.xml",
  ".labels-meta.xml",
  ".permissionset-meta.xml",
  ".profile-meta.xml"
];

export interface DiffFileStatus {
  revisionFrom: string;
  revisionTo: string;
  path: string;
  status: string;
  renamedPath?: string;
}

export interface DiffFile {
  deleted: DiffFileStatus[];
  addedEdited: DiffFileStatus[];
}
export default class DiffUtil {
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
  }

  public async build(
    diffFilePath: string,
    encoding: string,
    outputFolder: string
  ): Promise<DiffFile> {
    //const sepRegex=/\t| |\n/;
    const sepRegex = /\n|\r/;

    let data = "";

    if (diffFilePath !== null && diffFilePath !== "") {
      data = fs.readFileSync(diffFilePath, encoding);
    } else {
      data = await this.execShelCommand(
        "git  diff --raw  " + this.revisionFrom + "..." + this.revisionTo
      );
    }
    let destructivePackageObj: any[] = new Array();
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
          await this.handleUnsplitedMetadata(
            filesToCopy[i],
            outputFolder,
            destructivePackageObj
          );
        } else {
          this.copyFile(filePath, outputFolder);
        }
      }
    }
    if (deletedFiles && deletedFiles.length > 0) {
      await this.createDestructiveChanges(
        deletedFiles,
        outputFolder,
        destructivePackageObj
      );
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
    return diffFile;
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
            path: finalPath,
            status: "D"
          });
        } else {
          // Added or edited
          let status = "A";
          if (editedFileRegEx.test(fileContents[i])) {
            status = "M";
          }
          diffFile.addedEdited.push({
            revisionFrom: revisionPart[2].substring(0, 9),
            revisionTo: revisionPart[3].substring(0, 9),
            path: finalPath,
            status: status
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
          path: paths[1].trim(),
          status: "M"
        });

        //allow deletion of renamed components
        diffFile.deleted.push({
          revisionFrom: revisionPart[2],
          revisionTo: "000000000",
          path: paths[0].trim(),
          status: "D"
        });
      }
    }
    return diffFile;
  }

  public async handleUnsplitedMetadata(
    diffFile: DiffFileStatus,
    outputFolder: string,
    destructivePackageObj: any[]
  ) {
    let content1 = "";
    let content2 = "";

    try {
      content1 = await this.execShelCommand(
        `git  show --format=raw  ${diffFile.revisionFrom}`
      );
    } catch (e) {}

    try {
      content2 = await this.execShelCommand(
        `git  show --format=raw  ${diffFile.revisionTo}`
      );
    } catch (e) {}

    if (content1 === "") {
      //The metadata is added
      this.copyFile(diffFile.path, outputFolder);
      return;
    }

    FileUtils.mkDirByPathSync(
      path.join(outputFolder, path.parse(diffFile.path).dir)
    );

    if (diffFile.path.endsWith(".profile-meta.xml")) {
      if (content2 === "") {
        //The profile is deleted or marked as renamed.
        //Delete the renamed one
        let profileType: any = _.find(destructivePackageObj, function(
          metaType: any
        ) {
          return metaType.name === "Profile";
        });
        if (profileType === undefined) {
          profileType = {
            name: "Profile",
            members: []
          };
          destructivePackageObj.push(profileType);
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
        let permsetType: any = _.find(destructivePackageObj, function(
          metaType: any
        ) {
          return metaType.name === "PermissionSet";
        });
        if (permsetType === undefined) {
          permsetType = {
            name: "PermissionSet",
            members: []
          };
          destructivePackageObj.push(permsetType);
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
    outputFolder: string,
    destrucObj: any[]
  ) {
    if (_.isNil(destrucObj)) {
      destrucObj = new Array();
    } else {
      destrucObj = destrucObj.filter(metaType => {
        return !_.isNil(metaType.members) && metaType.members.length > 0;
      });
    }
    let destrucObjPre = new Array();
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
        await this.handleUnsplitedMetadata(
          filePaths[i],
          outputFolder,
          destrucObj
        );
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
          let isFormular = await this.isFormularField(filePath);
          if (isFormular) {
            destrucObjPre = this.buildDestructiveTypeObj(
              destrucObjPre,
              name,
              member
            );
          } else {
            destrucObj = this.buildDestructiveTypeObj(destrucObj, name, member);
          }
        } else {
          if (!deleteNotSupported.includes(name)) {
            destrucObj = this.buildDestructiveTypeObj(destrucObj, name, member);
          } else {
            //add the component in the manual action list
            // TODO
          }
        }
      }
    }

    this.writeDestructivechanges(
      destrucObjPre,
      outputFolder,
      "destructiveChangesPre.xml"
    );
    this.writeDestructivechanges(
      destrucObj,
      outputFolder,
      "destructiveChangesPost.xml"
    );
  }

  writeDestructivechanges(
    destrucObj: Array<any>,
    outputFolder: string,
    fileName: string
  ) {
    //encure unique component per type
    for (let i = 0; i < destrucObj.length; i++) {
      destrucObj[i].members = _.uniq(destrucObj[i].members);
    }

    destrucObj = destrucObj.filter(metaType => {
      return !metaType.members || metaType.members.length === 0;
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

  async isFormularField(filePath: string): Promise<boolean> {
    let content = await this.getDeletedGitFileContent(filePath);
    let result = content.includes("<formula>");
    return result;
  }

  async getDeletedGitFileContent(filePath: string): Promise<string> {
    if (this.revisionFrom === "") {
      return "";
    }
    const result = await this.execShelCommand(
      "git diff  " +
        this.revisionFrom.trim() +
        "..." +
        this.revisionTo.trim() +
        ' --   "' +
        filePath +
        '"'
    );
    return result;
  }

  async execShelCommand(command: string): Promise<string> {
    if (command === "") {
      return "";
    }
    let commandParts = command.split(" ");
    commandParts = commandParts.filter(elem => {
      return !(elem.trim() === "");
    });
    let output = "";
    if (commandParts.length > 0) {
      let mainCommand = commandParts[0];
      const cmdOutput = spawnSync(mainCommand, _.tail(commandParts));
      const buf = Buffer.from(cmdOutput.stdout);
      output = buf.toString();
    }
    return output;
  }

  private buildDestructiveTypeObj(destructiveObj, name, member) {
    let typeIsPresent: boolean = false;
    let typeIofIndex: number;
    let typeObj = destructiveObj;
    for (let i = 0; i < typeObj.length; i++) {
      for (let j = 0; j < typeObj[i].length; j++) {
        if (typeObj[i][j].name === name) {
          typeIsPresent = true;
          typeIofIndex = i;
          break;
        }
      }
    }
    let typeArray;
    if (typeIsPresent === false) {
      typeArray = new Array();
      let buildNameObj = {
        name: name
      };
      let buildMemberObj = {
        members: member
      };
      typeArray.push(buildNameObj);
      typeArray.push(buildMemberObj);
      destructiveObj.push(typeArray);
    } else {
      let typeArrayInObj = destructiveObj[typeIofIndex];
      let buildMemberObj = {
        members: member
      };
      typeArrayInObj.push(buildMemberObj);
    }
    return destructiveObj;
  }

  public static getChangedOrAdded(list1: any[], list2: any[], key: string) {
    let result: any[] = [];
    if (_.isNil(list1) && !_.isNil(list2) && list2.length > 0) {
      result.push(...list2);
    }

    if (!_.isNil(list1) && !_.isNil(list2)) {
      list1.forEach(criteria1 => {
        for (let i = 0; i < list2.length; i++) {
          let criteria2 = list2[i];
          if (criteria1[key] === criteria2[key]) {
            //check if edited
            if (!_.isEqual(criteria1, criteria2)) {
              result.push(criteria2);
            }
            break;
          }
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
        result.push(...addedElement);
      }
    }
    return result;
  }
}
