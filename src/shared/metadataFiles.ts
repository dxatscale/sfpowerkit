import * as path from "path";
import {
  MetadataInfoUtils,
  METADATA_INFO,
  MetadataDescribe,
  SOURCE_EXTENSION_REGEX
} from "./metadataInfo";
import FileUtils from "./fileutils";
import _ from "lodash";
import ignore from "ignore";
import * as fs from "fs";

export default class MetadataFiles {
  forceignore: any;
  public constructor() {
    if (fs.existsSync(".forceignore")) {
      this.forceignore = ignore().add(
        fs.readFileSync(".forceignore", "utf8").toString()
      );
    } else {
      this.forceignore = ignore();
    }
  }
  static getFullApiName(fileName: string): string {
    let fullName = "";
    let metadateType = MetadataInfoUtils.getMetadataName(fileName);
    let splitFilepath = fileName.split(path.sep);
    let isObjectChild = METADATA_INFO.CustomObject.childXmlNames.includes(
      metadateType
    );
    if (isObjectChild) {
      let objectName = splitFilepath[splitFilepath.length - 3];
      let fieldName = splitFilepath[splitFilepath.length - 1].split(".")[0];
      fullName = objectName.concat("." + fieldName);
    } else {
      fullName = splitFilepath[splitFilepath.length - 1].split(".")[0];
    }
    return fullName;
  }
  static getFullApiNameWithExtension(fileName: string): string {
    let fullName = "";
    let metadateType = MetadataInfoUtils.getMetadataName(fileName);
    let splitFilepath = fileName.split(path.sep);
    let isObjectChild = METADATA_INFO.CustomObject.childXmlNames.includes(
      metadateType
    );
    if (isObjectChild) {
      let objectName = splitFilepath[splitFilepath.length - 3];
      let fieldName = splitFilepath[splitFilepath.length - 1];
      fullName = objectName.concat("." + fieldName);
    } else {
      fullName = splitFilepath[splitFilepath.length - 1];
    }
    return fullName;
  }

  public static isCustomMetadata(filepath: string, name: string): boolean {
    let result = true;
    let splitFilepath = filepath.split(path.sep);
    let componentName = splitFilepath[splitFilepath.length - 1];
    componentName = componentName.substring(0, componentName.indexOf("."));
    if (
      name === METADATA_INFO.CustomField.xmlName ||
      name === METADATA_INFO.CustomObject.xmlName
    ) {
      //Custom Field or Custom Object
      result = componentName.endsWith("__c") || componentName.endsWith("__mdt");
    }
    return result;
  }
  public static getMemberNameFromFilepath(
    filepath: string,
    name: string
  ): string {
    let member: string;
    let splitFilepath = filepath.split(path.sep);
    let lastIndex = splitFilepath.length - 1;
    let isObjectChild = METADATA_INFO.CustomObject.childXmlNames.includes(name);
    let metadataDescribe: MetadataDescribe = METADATA_INFO[name];
    if (isObjectChild) {
      let objectName = splitFilepath[lastIndex - 2];
      let fieldName = splitFilepath[lastIndex].split(".")[0];
      member = objectName.concat("." + fieldName);
    } else if (metadataDescribe.inFolder) {
      let baseName = metadataDescribe.directoryName;
      let baseIndex = filepath.indexOf(baseName) + baseName.length;
      let cmpPath = filepath.substring(baseIndex + 1); // add 1 to remove the path seperator
      cmpPath = cmpPath.substring(0, cmpPath.indexOf("."));
      member = cmpPath.replace(path.sep, "/");
    } else {
      member = splitFilepath[lastIndex].replace(SOURCE_EXTENSION_REGEX, "");
    }
    return member;
  }

  public loadComponents(srcFolder: string): void {
    var metadataFiles: string[] = FileUtils.getAllFilesSync(srcFolder);
    let keys = Object.keys(METADATA_INFO);
    if (Array.isArray(metadataFiles) && metadataFiles.length > 0) {
      metadataFiles.forEach(metadataFile => {
        for (let i = 0; i < keys.length; i++) {
          let match = false;
          if (metadataFile.endsWith(METADATA_INFO[keys[i]].sourceExtension)) {
            match = true;
          } else if (
            METADATA_INFO[keys[i]].inFolder &&
            metadataFile.endsWith(METADATA_INFO[keys[i]].folderExtension)
          ) {
            match = true;
          }
          if (match) {
            if (_.isNil(METADATA_INFO[keys[i]].files)) {
              METADATA_INFO[keys[i]].files = [];
              METADATA_INFO[keys[i]].components = [];
            }
            let isValid = this.accepts(metadataFile);
            if (isValid) {
              METADATA_INFO[keys[i]].files.push(metadataFile);

              let name = FileUtils.getFileNameWithoutExtension(
                metadataFile,
                METADATA_INFO[keys[i]].sourceExtension
              );

              if (METADATA_INFO[keys[i]].isChildComponent) {
                let fileParts = metadataFile.split(path.sep);
                let parentName = fileParts[fileParts.length - 3];
                name = parentName + "." + name;
              }

              METADATA_INFO[keys[i]].components.push(name);
            }

            break;
          }
        }
      });
    } else {
      keys.forEach(key => {
        if (_.isNil(METADATA_INFO[key].files)) {
          METADATA_INFO[key].files = [];
          METADATA_INFO[key].components = [];
        }
      });
    }
  }
  //Check if a component is accepted by forceignore.
  private accepts(filePath: string) {
    return !this.forceignore.ignores(path.relative(process.cwd(), filePath));
  }
}
