import MetadataFiles from "./metadataFiles";

const util = require("util");
const exec = util.promisify(require("child_process").exec);

import * as xml2js from "xml2js";
import * as path from "path";
import * as fs from "fs";
import * as glob from "glob";
import * as copydir from "copy-dir";

const pairStatResources = "staticresources";
const pairStatResourcesRegExp = new RegExp(pairStatResources);
const pairAuaraRegExp = new RegExp("aura");

const deleteNotSupported = ["RecordType"];

export interface DiffFile {
  deleted: string[];
  addedEdited: string[];
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
        "git diff --raw " + this.revisionFrom + "..." + this.revisionTo
      );
    }

    let content = data.split(sepRegex);
    let diffFile: DiffFile = this.parseContent(content);
    let filesToCopy = diffFile.addedEdited;
    let deletedFiles = diffFile.deleted;
    deletedFiles = deletedFiles.filter(deleted => {
      let found = false;
      let deletedMetadata = MetadataFiles.getFullApiNameWithExtension(deleted);
      for (let i = 0; i < filesToCopy.length; i++) {
        let addedOrEdited = MetadataFiles.getFullApiNameWithExtension(
          filesToCopy[i]
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
        this.copyFile(filesToCopy[i], outputFolder);
      }
    }
    if (deletedFiles && deletedFiles.length > 0) {
      await this.createDestructiveChanges(deletedFiles, outputFolder);
    }

    return diffFile;
  }
  public parseContent(fileContents): DiffFile {
    //const startRegEx = /^:|^$/;
    //const statusRegEx = /^[A]$|^[M]$/;
    const statusRegEx = /\sA\t|\sM\t|\sD\t/;
    const renamedRegEx = /\sR[0-9]{3}\t|\sC[0-9]{3}\t/;
    const tabRegEx = /\t/;
    const deletedFileRegEx = new RegExp(/\sD\t/);
    const lineBreakRegEx = /\r?\n|\r|( $)/;

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

        if (deletedFileRegEx.test(fileContents[i])) {
          //Deleted
          diffFile.deleted.push(finalPath);
        } else {
          // Added or edited
          diffFile.addedEdited.push(finalPath);
        }
      } else if (renamedRegEx.test(fileContents[i])) {
        var lineParts = fileContents[i].split(renamedRegEx);

        var pathsParts = path.join(".", lineParts[1].trim());
        pathsParts = pathsParts.replace("\\303\\251", "é");

        var paths = pathsParts.split(tabRegEx);
        var finalPath = paths[1];

        diffFile.addedEdited.push(finalPath);
      }
    }
    return diffFile;
  }

  public copyFile(filePath: string, outputFolder: string) {
    let copyOutputFolder = outputFolder;
    if (filePath.startsWith(".")) {
      // exclude technical files such as .gitignore or .forceignore
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

    let fileName = filePathParts[filePathParts.length - 1].replace('"', "");

    let fileNameParts = fileName.split(".");
    let pattern = fileNameParts[0] + ".*";
    if (fileName.includes("quickAction-meta.xml")) {
      pattern = fileName.replace("quickAction-meta.xml", "*");
    }
    var associatedFilePattern = filePath.replace(fileName, pattern);
    var files = glob.sync(associatedFilePattern);
    for (var i = 0; i < files.length; i++) {
      if (fs.lstatSync(files[i]).isDirectory() == false) {
        var oneFilePath = path.join(".", files[i]);
        var oneFilePathParts = oneFilePath.split(path.sep);
        fileName = oneFilePathParts[oneFilePathParts.length - 1];
        var outputPath = path.join(outputFolder, fileName);
        fs.copyFileSync(files[i], outputPath);
      }
    }

    if (
      filePath.endsWith("Translation-meta.xml") &&
      filePath.indexOf("globalValueSet") < 0
    ) {
      var parentFolder = filePathParts[filePathParts.length - 2];
      var objectTranslation = parentFolder + ".objectTranslation-meta.xml";
      var outputPath = path.join(outputFolder, objectTranslation);
      var sourceFile = filePath.replace(fileName, objectTranslation);
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
        if (filePathParts[i] === "staticresources") {
          let fileOrDirname = filePathParts[i + 1];
          let fileOrDirnameParts = fileOrDirname.split(".");
          srcFolder = path.join(srcFolder, fileOrDirnameParts[0]);
          outputFolder = path.join(outputFolder, fileOrDirnameParts[0]);
          resourceFile = srcFolder + ".resource-meta.xml";
          staticRecourceRoot = outputFolder + ".resource-meta.xml";
          if (fs.existsSync(srcFolder)) {
            if (fs.existsSync(outputFolder) == false) {
              fs.mkdirSync(outputFolder);
            }
          }
          break;
        }
      }
      if (fs.existsSync(srcFolder)) {
        copydir.sync(srcFolder, outputFolder);
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
        if (filePathParts[i] === "aura") {
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
        copydir.sync(srcFolder, outputFolder);
      }
    }
  }

  public async createDestructiveChanges(
    filePaths: string[],
    outputFolder: string
  ) {
    let destrucObj = new Array();
    let destrucObjPre = new Array();
    //returns root, dir, base and name
    for (let i = 0; i < filePaths.length; i++) {
      let filePath = filePaths[i];
      let parsedPath = path.parse(filePath);
      let filename = parsedPath.base;
      let name = MetadataFiles.getNameOfTypes(filename);
      if (name) {
        if (!MetadataFiles.isCustomMetadata(filePath, name)) {
          // avoid to generate destructive for Standard Components
          //Support on Custom Fields, Custom Objects and Layout for now
          continue;
        }
        let member = MetadataFiles.getMemberNameFromFilepath(filePath, name);

        if (name === "CustomField") {
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
      "git diff " +
        this.revisionFrom.trim() +
        "..." +
        this.revisionTo.trim() +
        ' -- "' +
        filePath +
        '"'
    );
    return result;
  }

  async execShelCommand(command: string): Promise<string> {
    if (command === "") {
      return "";
    }
    const { stdout } = await exec(command, { maxBuffer: 1024 * 500 });
    return stdout;
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
}
