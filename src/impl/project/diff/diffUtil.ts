import * as path from "path";
import * as fs from "fs-extra";
import * as _ from "lodash";

import MetadataFiles from "../../../impl/metadata/metadataFiles";
import { SOURCE_EXTENSION_REGEX } from "../../../impl/metadata/metadataInfo";
import { METADATA_INFO } from "../../../impl/metadata/metadataInfo";
import { SFPowerkit } from "../../../sfpowerkit";
import { LoggerLevel } from "@salesforce/core";
import simplegit from "simple-git/promise";

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
  public static gitTreeRevisionTo: {
    revision: string;
    path: string;
  }[];
  public static async isFormulaField(
    diffFile: DiffFileStatus
  ): Promise<boolean> {
    let content = await git.show(["--raw", diffFile.revisionFrom]);
    let result = content.includes("<formula>");
    return result;
  }

  public static async fetchFileListRevisionTo(revisionTo: string) {
    SFPowerkit.log(
      "Fetching file list from target revision " + revisionTo,
      LoggerLevel.INFO
    );
    DiffUtil.gitTreeRevisionTo = [];
    let revisionTree = await git.raw(["ls-tree", "-r", revisionTo]);
    const sepRegex = /\n|\r/;
    let lines = revisionTree.split(sepRegex);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === "") continue;
      let fields = lines[i].split(/\t/);
      let pathStr = fields[1];
      let revisionSha = fields[0].split(/\s/)[2];
      let oneFIle = {
        revision: revisionSha,
        path: path.join(".", pathStr)
      };
      DiffUtil.gitTreeRevisionTo.push(oneFIle);
    }
    return DiffUtil.gitTreeRevisionTo;
  }

  public static async getRelativeFiles(
    filePath: string
  ): Promise<
    {
      revision: string;
      path: string;
    }[]
  > {
    let relativeFiles = [];

    let filePathParts = filePath.split(path.sep);

    const statResourcesRegExp = new RegExp(
      METADATA_INFO.StaticResource.directoryName
    );
    const auraRegExp = new RegExp(
      METADATA_INFO.AuraDefinitionBundle.directoryName
    );
    const lwcRegExp = new RegExp(
      METADATA_INFO.LightningComponentBundle.directoryName
    );

    if (
      filePath.endsWith("Translation-meta.xml") &&
      filePath.indexOf("globalValueSet") < 0
    ) {
      let parentFolder = filePathParts[filePathParts.length - 2];
      let objectTranslation =
        parentFolder + METADATA_INFO.CustomObjectTranslation.sourceExtension;

      DiffUtil.gitTreeRevisionTo.forEach(file => {
        if (file.path === filePath || file.path === objectTranslation) {
          relativeFiles.push(file);
        }
      });
    } else if (
      statResourcesRegExp.test(filePath) ||
      auraRegExp.test(filePath) ||
      lwcRegExp.test(filePath)
    ) {
      // handle static recources
      let baseFile = "";
      for (let i = 0; i < filePathParts.length; i++) {
        baseFile = path.join(baseFile, filePathParts[i]);
        if (
          filePathParts[i] === METADATA_INFO.StaticResource.directoryName ||
          filePathParts[i] ===
            METADATA_INFO.AuraDefinitionBundle.directoryName ||
          filePathParts[i] ===
            METADATA_INFO.LightningComponentBundle.directoryName
        ) {
          let fileOrDirname = filePathParts[i + 1];
          if (SOURCE_EXTENSION_REGEX.test(fileOrDirname)) {
            fileOrDirname = fileOrDirname.replace(SOURCE_EXTENSION_REGEX, "");
          } else {
            let extension = path.parse(fileOrDirname).ext;
            fileOrDirname = fileOrDirname.replace(extension, "");
          }
          baseFile = path.join(baseFile, fileOrDirname);
          break;
        }
      }

      DiffUtil.gitTreeRevisionTo.forEach(file => {
        let fileToCompare = file.path;
        if (fileToCompare.startsWith(baseFile)) {
          relativeFiles.push(file);
        }
      });
    } else {
      let baseFile = filePath;
      if (SOURCE_EXTENSION_REGEX.test(filePath)) {
        baseFile = filePath.replace(SOURCE_EXTENSION_REGEX, "");
      } else {
        let extension = path.parse(filePath).ext;
        baseFile = filePath.replace(extension, "");
      }
      DiffUtil.gitTreeRevisionTo.forEach(file => {
        let fileToCompare = file.path;
        if (SOURCE_EXTENSION_REGEX.test(fileToCompare)) {
          fileToCompare = fileToCompare.replace(SOURCE_EXTENSION_REGEX, "");
        } else {
          let extension = path.parse(fileToCompare).ext;
          fileToCompare = fileToCompare.replace(extension, "");
        }
        if (baseFile === fileToCompare) {
          relativeFiles.push(file);
        }
      });
    }

    return relativeFiles;
  }

  public static async copyFile(filePath: string, outputFolder: string) {
    SFPowerkit.log(
      `Copying file ${filePath} from git to ${outputFolder}`,
      LoggerLevel.INFO
    );
    if (fs.existsSync(path.join(outputFolder, filePath))) {
      SFPowerkit.log(
        `File ${filePath}  already in output folder. `,
        LoggerLevel.TRACE
      );
      return;
    }

    let gitFiles = await DiffUtil.getRelativeFiles(filePath);
    let copyOutputFolder = outputFolder;
    for (let i = 0; i < gitFiles.length; i++) {
      outputFolder = copyOutputFolder;
      let gitFile = gitFiles[i];

      SFPowerkit.log(
        `Associated file ${i}: ${gitFile.path}  Revision: ${gitFile.revision}`,
        LoggerLevel.TRACE
      );

      let outputPath = path.join(outputFolder, gitFile.path);

      let filePathParts = gitFile.path.split(path.sep);

      if (fs.existsSync(outputFolder) == false) {
        fs.mkdirSync(outputFolder);
      }
      // Create folder structure
      for (let i = 0; i < filePathParts.length - 1; i++) {
        let folder = filePathParts[i].replace('"', "");
        outputFolder = path.join(outputFolder, folder);
        if (fs.existsSync(outputFolder) == false) {
          fs.mkdirSync(outputFolder);
        }
      }
      let fileContent = await git.show(["--raw", gitFile.revision]);
      fs.writeFileSync(outputPath, fileContent);
    }
  }

  public static async parseContent(fileContents): Promise<DiffFile> {
    const statusRegEx = /\sA\t|\sM\t|\sD\t/;
    const renamedRegEx = /\sR[0-9]{3}\t|\sC[0-9]{3}\t/;
    const tabRegEx = /\t/;
    const deletedFileRegEx = new RegExp(/\sD\t/);
    const lineBreakRegEx = /\r?\n|\r|( $)/;

    let metadataFiles = new MetadataFiles();

    var diffFile: DiffFile = {
      deleted: [],
      addedEdited: []
    };

    for (var i = 0; i < fileContents.length; i++) {
      if (statusRegEx.test(fileContents[i])) {
        let lineParts = fileContents[i].split(statusRegEx);

        let finalPath = path.join(
          ".",
          lineParts[1].replace(lineBreakRegEx, "")
        );
        finalPath = finalPath.trim();
        finalPath = finalPath.replace("\\303\\251", "é");

        if (!(await metadataFiles.isInModuleFolder(finalPath))) {
          continue;
        }

        if (!metadataFiles.accepts(finalPath)) {
          continue;
        }

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
        let lineParts = fileContents[i].split(renamedRegEx);

        let paths = lineParts[1].trim().split(tabRegEx);

        let finalPath = path.join(".", paths[1].trim());
        finalPath = finalPath.replace("\\303\\251", "é");
        let revisionPart = lineParts[0].split(/\t|\s/);

        if (!(await metadataFiles.isInModuleFolder(finalPath))) {
          continue;
        }

        if (!metadataFiles.accepts(paths[0].trim())) {
          continue;
        }

        diffFile.addedEdited.push({
          revisionFrom: "0000000",
          revisionTo: revisionPart[3],
          renamedPath: path.join(".", paths[0].trim()),
          path: finalPath
        });

        //allow deletion of renamed components
        diffFile.deleted.push({
          revisionFrom: revisionPart[2],
          revisionTo: "0000000",
          path: paths[0].trim()
        });
      }
    }
    return diffFile;
  }

  public static getChangedOrAdded(list1: any[], list2: any[], key: string) {
    let result: any = {
      addedEdited: [],
      deleted: []
    };

    //Ensure array
    if (!_.isNil(list1) && !Array.isArray(list1)) {
      list1 = [list1];
    }
    if (!_.isNil(list2) && !Array.isArray(list2)) {
      list2 = [list2];
    }

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

  public static addMemberToPackage(packageObj, name, member) {
    let typeIsPresent: boolean = false;
    for (let i = 0; i < packageObj.length; i++) {
      if (packageObj[i].name === name) {
        typeIsPresent = true;
        if (!packageObj[i].members.includes(member)) {
          packageObj[i].members.push(member);
        }
        break;
      }
    }
    let typeNode: any;
    if (typeIsPresent === false) {
      typeNode = {
        name: name,
        members: [member]
      };
      packageObj.push(typeNode);
    }
    return packageObj;
  }
}
