import {
  MetadataInfo,
  MetadataDescribe,
  METADATA_INFO,
  SOURCE_EXTENSION_REGEX,
  UNSPLITED_METADATA
} from "../../../impl/metadata/metadataInfo";

import * as fs from "fs-extra";
import * as path from "path";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import FileUtils from "../../../utils/fileutils";
import MetadataFiles from "../../../impl/metadata/metadataFiles";
import DiffUtil from "../diff/diffUtil";
import { Org } from "@salesforce/core";
import { checkRetrievalStatus } from "../../../utils/checkRetrievalStatus";
import { AsyncResult } from "jsforce";
import { extract } from "../../../utils/extract";
import * as rimraf from "rimraf";
import CustomLabelsDiff from "../diff/customLabelsDiff";
import SharingRuleDiff from "../diff/sharingRuleDiff";
import WorkflowDiff from "../diff/workflowDiff";
import { loadSFDX } from "../../../sfdxnode/GetNodeWrapper";
import { sfdx } from "../../../sfdxnode/parallel";

const jsdiff = require("diff");

const CRLF_REGEX = /\r\n/;
const LF_REGEX = /\n/;

const unsplitedMetadataExtensions = UNSPLITED_METADATA.filter(elem => {
  return (
    elem.xmlName !== METADATA_INFO.Profile.xmlName &&
    elem.xmlName !== METADATA_INFO.PermissionSet.xmlName
  );
}).map(elem => {
  return elem.sourceExtension;
});

export default class OrgDiffImpl {
  private output = [];
  public constructor(
    private filesOrFolders: string[],
    private org: Org,
    private addConflictMarkers: boolean
  ) {}

  public async orgDiff() {
    let packageobj = new Array();
    SFPowerkit.setStatus("Building package metadata for retrieve");
    this.filesOrFolders.forEach(async fileOrFolder => {
      SFPowerkit.log("Processing " + fileOrFolder, LoggerLevel.DEBUG);
      fileOrFolder = path.normalize(fileOrFolder);

      let pathExists = fs.existsSync(fileOrFolder);
      if (pathExists) {
        let stats = fs.statSync(fileOrFolder);
        if (stats.isFile()) {
          //Process File
          packageobj = await this.buildPackageObj(fileOrFolder, packageobj);
        } else if (stats.isDirectory()) {
          //Process File
          let files = FileUtils.getAllFilesSync(fileOrFolder);
          files.forEach(async oneFile => {
            packageobj = await this.buildPackageObj(oneFile, packageobj);
          });
        }
      } else {
        SFPowerkit.log(
          `Path ${fileOrFolder} does not exists. `,
          LoggerLevel.ERROR
        );
      }
    });

    if (!packageobj || packageobj.length < 1) {
      throw new Error("you must pass atleast one valid path.");
    }
    SFPowerkit.setStatus("Retrieving metadata");
    await this.retrievePackage(packageobj);
    SFPowerkit.setStatus("Comparing files");
    this.compare();
    rimraf.sync("temp_sfpowerkit");
    return this.output;
  }

  private async buildPackageObj(filePath, packageobj) {
    let matcher = filePath.match(SOURCE_EXTENSION_REGEX);
    let extension = "";
    if (matcher) {
      extension = matcher[0];
    } else {
      extension = path.parse(filePath).ext;
    }
    try {
      if (unsplitedMetadataExtensions.includes(extension)) {
        //handle unsplited metadata
        await this.handleUnsplitedMetadatas(filePath, packageobj);
      } else {
        let name = MetadataInfo.getMetadataName(filePath, false);
        let member = MetadataFiles.getMemberNameFromFilepath(filePath, name);
        packageobj = DiffUtil.addMemberToPackage(packageobj, name, member);
      }
    } catch (err) {
      throw new Error(err + ",Error file path : " + filePath);
    }
    return packageobj;
  }

  private async handleUnsplitedMetadatas(filePath: string, packageobj: any[]) {
    if (filePath.endsWith(METADATA_INFO.CustomLabels.sourceExtension)) {
      let members = await CustomLabelsDiff.getMembers(filePath);
      packageobj.push({
        name: "CustomLabel",
        members: members
      });
    }
    if (filePath.endsWith(METADATA_INFO.SharingRules.sourceExtension)) {
      let name = MetadataInfo.getMetadataName(filePath, false);
      let objectName = MetadataFiles.getMemberNameFromFilepath(filePath, name);
      let members = await SharingRuleDiff.getMembers(filePath);
      Object.keys(members).forEach(key => {
        packageobj.push({
          name: key,
          members: members[key].map(elem => {
            return objectName + "." + elem;
          })
        });
      });
    }
    if (filePath.endsWith(METADATA_INFO.Workflow.sourceExtension)) {
      let name = MetadataInfo.getMetadataName(filePath, false);
      let objectName = MetadataFiles.getMemberNameFromFilepath(filePath, name);
      let members = await WorkflowDiff.getMembers(filePath);
      Object.keys(members).forEach(key => {
        packageobj.push({
          name: key,
          members: members[key].map(elem => {
            return objectName + "." + elem;
          })
        });
      });
    }
  }

  private compare() {
    // let fetchedFiles = FileUtils.getAllFilesSync(`./temp_sfpowerkit/mdapi`, "");
    let fetchedFiles = FileUtils.getAllFilesSync(
      `./temp_sfpowerkit/source`,
      ""
    );

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

  private processFile(localFile: string, fetchedFiles: string[]) {
    SFPowerkit.log("Compare:  Processing " + localFile, LoggerLevel.DEBUG);
    let metaType = MetadataInfo.getMetadataName(localFile, false);
    let member = MetadataFiles.getMemberNameFromFilepath(localFile, metaType);
    // let extension = path.parse(localFile).ext;
    let cmpPath = path.parse(localFile).base;

    let metadataDescribe: MetadataDescribe = METADATA_INFO[metaType];
    const staticResourceRegExp = new RegExp("staticresources");
    if (metadataDescribe.inFolder || staticResourceRegExp.test(localFile)) {
      let folderName = "staticresources";
      if (metadataDescribe.inFolder) {
        folderName = metadataDescribe.directoryName;
      }
      let baseIndex = localFile.indexOf(folderName) + folderName.length;
      cmpPath = localFile.substring(baseIndex + 1);
    }

    // find the files
    let foundFile = fetchedFiles.find(fetchFile => {
      let fetchedMetaType = MetadataInfo.getMetadataName(fetchFile, false);
      let fetchedMember = MetadataFiles.getMemberNameFromFilepath(
        fetchFile,
        fetchedMetaType
      );
      //let fetchedExtension = path.parse(fetchFile).ext;
      let fetchedCmpPath = path.parse(fetchFile).base;

      let fetchedMetadataDescribe: MetadataDescribe =
        METADATA_INFO[fetchedMetaType];
      if (
        fetchedMetadataDescribe.inFolder ||
        staticResourceRegExp.test(fetchFile)
      ) {
        let fetchedFolderName = "staticresources";
        if (fetchedMetadataDescribe.inFolder) {
          fetchedFolderName = fetchedMetadataDescribe.directoryName;
        }
        let fetchedBaseIndex =
          fetchFile.indexOf(fetchedFolderName) + fetchedFolderName.length;
        fetchedCmpPath = fetchFile.substring(fetchedBaseIndex + 1);
      }
      return (
        fetchedMetaType === metaType &&
        member === fetchedMember &&
        cmpPath === fetchedCmpPath
      );
    });

    if (foundFile !== undefined) {
      let contentLocalFile = fs.readFileSync(localFile, "utf8");
      let contentFetchedFile = fs.readFileSync(foundFile, "utf8");

      //Normalise line ending on windows
      let matcherLocal = contentLocalFile.match(CRLF_REGEX);
      let matcherFetched = contentFetchedFile.match(CRLF_REGEX);
      let lineEnd = "\n";
      if (matcherLocal && !matcherFetched) {
        lineEnd = matcherLocal[0];
        contentFetchedFile = contentFetchedFile.split(LF_REGEX).join(lineEnd);
      }

      if (
        !contentLocalFile.endsWith(lineEnd) &&
        contentFetchedFile.endsWith(lineEnd)
      ) {
        contentFetchedFile = contentFetchedFile.substr(
          0,
          contentFetchedFile.lastIndexOf(lineEnd)
        );
      }

      if (
        contentLocalFile.endsWith(lineEnd) &&
        !contentFetchedFile.endsWith(lineEnd)
      ) {
        contentFetchedFile = contentFetchedFile + lineEnd;
      }

      let diffResult = jsdiff.diffLines(contentLocalFile, contentFetchedFile);
      //Process the diff result add add conflict marker on the files
      this.processResult(localFile, diffResult);
    } else {
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

    for (let i = 0; i < diffResult.length; i++) {
      let result = diffResult[i];
      let index = i;
      let originalArray = diffResult;

      if (result.removed) {
        if (firstChunkProcessed) {
          content = content + `${result.value}>>>>>>> Remote:${filePath}\n`;
          firstChunkProcessed = false;
          conflict = true;
        } else if (
          (originalArray.length > index + 1 &&
            originalArray[index + 1].added == undefined) ||
          index + 1 === originalArray.length
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
          (originalArray.length > index + 1 &&
            originalArray[index + 1].removed == undefined &&
            originalArray[index + 1].added == undefined) ||
          index + 1 === originalArray.length
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
    }

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
    if (conflict || changedLocaly || changedRemote) {
      this.output.push({
        status: status,
        metadataType: metaType,
        componentName: member,
        path: filePath
      });
    }
  }

  private async retrievePackage(packageObj) {
    SFPowerkit.log("Clear temp folder ", LoggerLevel.INFO);
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
    SFPowerkit.log("Retrieve request sent ", LoggerLevel.INFO);
    await conn.metadata.retrieve(retrieveRequest, function(
      error,
      result: AsyncResult
    ) {
      if (error) {
        return console.error(error);
      }
      retrievedId = result.id;
    });
    SFPowerkit.setStatus("Retrieving metadata | WAITING for retrieve request ");
    let metadata_retrieve_result = await checkRetrievalStatus(
      conn,
      retrievedId,
      false
    );

    SFPowerkit.setStatus("Retrieving metadata");
    SFPowerkit.log(
      "Retrieve completed. Writing retrieved metadata to disk ",
      LoggerLevel.DEBUG
    );
    if (!metadata_retrieve_result.zipFile)
      throw new Error("Error while retrieveing metadata");

    var zipFileName = "temp_sfpowerkit/unpackaged.zip";

    fs.mkdirSync("temp_sfpowerkit");
    fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, {
      encoding: "base64"
    });

    SFPowerkit.log("Extracting retrieved metadata ", LoggerLevel.DEBUG);
    await extract(`./temp_sfpowerkit/unpackaged.zip`, "temp_sfpowerkit/mdapi");

    let maxApiVersion = await this.org.retrieveMaxApiVersion();

    fs.mkdirSync("temp_sfpowerkit/source");
    SFPowerkit.log(
      "Converting retrieved metadata to dx format",
      LoggerLevel.INFO
    );

    let sfdxProjectJson = `{
        "packageDirectories": [
          {
            "path": "source",
            "default": true
          }
        ],
        "namespace": "",
        "sfdcLoginUrl": "https://login.salesforce.com",
        "sourceApiVersion": "${maxApiVersion}"
      }`;

    fs.writeFileSync("temp_sfpowerkit/sfdx-project.json", sfdxProjectJson);

    loadSFDX();

    await sfdx.force.mdapi.convert({
      quiet: false,
      cwd: path.join(process.cwd(), "temp_sfpowerkit"),
      rootdir: "mdapi",
      outputdir: "source"
    });

    //Should remove the mdapi folder
    rimraf.sync("temp_sfpowerkit/mdapi");
    rimraf.sync("temp_sfpowerkit/unpackaged.zip");
  }
}
