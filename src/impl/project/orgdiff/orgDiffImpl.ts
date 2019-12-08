import { MetadataInfo } from "../../../impl/metadata/metadataInfo";

import * as fs from "fs";
import * as path from "path";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import FileUtils from "../../../utils/fileutils";
import MetadataFiles from "../../../impl/metadata/metadataFiles";
import DiffUtil from "../diff/diffUtil";
import { Org } from "@salesforce/core";
import { checkRetrievalStatus } from "../../../utils/checkRetrievalStatus";
import { AsyncResult } from "jsforce";
import { extract } from "../../../utils/extract";
import rimraf = require("rimraf");
import { StatusCodeError } from "request-promise/errors";
const jsdiff = require("diff");

export default class OrgDiffImpl {
  private output = [];
  public constructor(
    private filesOrFolders: string[],
    private org: Org,
    private addConflictMarkers: boolean
  ) {}

  public async orgDiff() {
    let packageobj = new Array();

    this.filesOrFolders.forEach(fileOrFolder => {
      fileOrFolder = path.normalize(fileOrFolder);

      let pathExists = fs.existsSync(fileOrFolder);
      if (pathExists) {
        let stats = fs.statSync(fileOrFolder);
        if (stats.isFile()) {
          //Process File
          let name = MetadataInfo.getMetadataName(fileOrFolder, false);
          let member = MetadataFiles.getMemberNameFromFilepath(
            fileOrFolder,
            name
          );
          packageobj = DiffUtil.addMemberToPackage(packageobj, name, member);
        } else if (stats.isDirectory()) {
          //Process File
          let files = FileUtils.getAllFilesSync(fileOrFolder);
          files.forEach(oneFile => {
            let name = MetadataInfo.getMetadataName(oneFile, false);
            let member = MetadataFiles.getMemberNameFromFilepath(oneFile, name);
            packageobj = DiffUtil.addMemberToPackage(packageobj, name, member);
          });
        }
      } else {
        SFPowerkit.log(
          `Path ${fileOrFolder} does not exists. `,
          LoggerLevel.ERROR
        );
        throw new Error("Error");
      }
    });

    await this.retrievePackage(packageobj);
    this.compare();

    return this.output;
  }

  private async compare() {
    let fetchedFiles = FileUtils.getAllFilesSync(`./temp_sfpowerkit/mdapi`, "");

    this.filesOrFolders.forEach(fileOrFolder => {
      fileOrFolder = path.normalize(fileOrFolder);

      let pathExists = fs.existsSync(fileOrFolder);
      if (pathExists) {
        let stats = fs.statSync(fileOrFolder);
        if (stats.isFile()) {
          //Process File
          this.processFile(fileOrFolder, fetchedFiles);
        } else if (stats.isDirectory()) {
          //Read files in directory
          let files = FileUtils.getAllFilesSync(fileOrFolder, "");
          files.forEach(oneFile => {
            //process file
            this.processFile(oneFile, fetchedFiles);
          });
        }
      }
    });
  }

  private async processFile(localFile: string, fetchedFiles: string[]) {
    // find the files
    let foundFile = fetchedFiles.find(fetchFile => {
      return path.basename(localFile) === path.basename(fetchFile);
    });

    if (foundFile !== undefined) {
      let contentLocalFile = fs.readFileSync(localFile, "utf8");
      let contentFetchedFile = fs.readFileSync(foundFile, "utf8");
      let diffResult = jsdiff.diffLines(contentLocalFile, contentFetchedFile);
      //Process the diff result add add conflict marker on the files
      this.processResult(localFile, diffResult);
    } else {
      let metaType = MetadataInfo.getMetadataName(localFile, false);
      let member = MetadataFiles.getMemberNameFromFilepath(localFile, metaType);
      this.output.push({
        status: "Local Added / Remote Deleted",
        metadataType: metaType,
        componentName: member,
        path: localFile
      });
    }
  }

  private processResult(
    filePath,
    diffResult: {
      value: string;
      added?: boolean;
      removed?: boolean;
      count?: number;
    }[]
  ) {
    let content = "";
    let firstChunkProcessed = false;
    let changedLocaly = false;
    let changedRemote = false;
    let conflict = false;
    diffResult.forEach((result, index, originalArray) => {
      if (result.removed) {
        if (firstChunkProcessed) {
          content = content + `${result.value}>>>>>>> Remote:${filePath}\n`;
          firstChunkProcessed = false;
          conflict = true;
        } else if (
          originalArray.length > index &&
          originalArray[index + 1].added == undefined
        ) {
          //Line added locally and remove remote
          content =
            content +
            `<<<<<<< Local:${filePath}\n${result.value}=======\n>>>>>>> Remote:${filePath}\n`;
          firstChunkProcessed = false;
          changedLocaly = true;
        } else {
          content =
            content + `<<<<<<< Local:${filePath}\n${result.value}=======\n`;
          firstChunkProcessed = true;
          conflict = true;
        }
      } else if (result.added) {
        if (firstChunkProcessed) {
          content = content + `${result.value}>>>>>>> Remote:${filePath}\n`;
          firstChunkProcessed = false;
          conflict = true;
        } else if (
          originalArray.length > index &&
          originalArray[index + 1].removed == undefined &&
          originalArray[index + 1].added == undefined
        ) {
          //Line added locally and remove remote
          content =
            content +
            `<<<<<<< Local:${filePath}\n=======\n${result.value}>>>>>>> Remote:${filePath}\n`;
          firstChunkProcessed = false;
          changedRemote = true;
        } else {
          //This should never happen
          content =
            content + `<<<<<<< Local:${filePath}\n${result.value}=======\n`;
          firstChunkProcessed = true;
          conflict = true;
        }
      } else {
        content = content + result.value;
      }
    });
    if (this.addConflictMarkers) {
      fs.writeFileSync(filePath, content);
    }

    let status = "No Change";
    if (conflict || (changedLocaly && changedRemote)) {
      status = "Conflict";
    } else if (changedRemote) {
      status = "Remote Change";
    } else if (changedLocaly) {
      status = "Local Change";
    }

    let metaType = MetadataInfo.getMetadataName(filePath, false);
    let member = MetadataFiles.getMemberNameFromFilepath(filePath, metaType);
    this.output.push({
      status: status,
      metadataType: metaType,
      componentName: member,
      path: filePath
    });
  }

  private async retrievePackage(packageObj) {
    rimraf.sync("temp_sfpowerkit");
    const apiversion = await this.org.getConnection().retrieveMaxApiVersion();
    let retrieveRequest = {
      apiVersion: apiversion
    };

    retrieveRequest["singlePackage"] = true;
    retrieveRequest["unpackaged"] = {
      types: packageObj
    };

    // if(!this.flags.json)
    // this.ux.logJson(retrieveRequest);

    await this.org.refreshAuth();

    const conn = this.org.getConnection();

    conn.metadata.pollTimeout = 60;

    let retrievedId;

    await conn.metadata.retrieve(retrieveRequest, function(
      error,
      result: AsyncResult
    ) {
      if (error) {
        return console.error(error);
      }
      retrievedId = result.id;
    });

    let metadata_retrieve_result = await checkRetrievalStatus(
      conn,
      retrievedId,
      false
    );
    if (!metadata_retrieve_result.zipFile)
      throw new Error("Unable to find the requested ConnectedApp");

    var zipFileName = "temp_sfpowerkit/unpackaged.zip";

    fs.mkdirSync("temp_sfpowerkit");
    fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, {
      encoding: "base64"
    });

    await extract(`./temp_sfpowerkit/unpackaged.zip`, "temp_sfpowerkit/mdapi");
  }
}
