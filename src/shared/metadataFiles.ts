import * as path from "path";
import {
  MetadataInfoUtils,
  METADATA_INFO,
  MetadataDescribe,
  SOURCE_EXTENSION_REGEX
} from "./metadataInfo";
import FileUtils from "../profile_utils/fsutils";
import _ from "lodash";

export default class MetadataFiles {
  static getFullApiName(fileName: string): string {
    let fullName = "";
    let metadateType = MetadataFiles.getNameOfTypes(fileName);
    let splitFilepath = fileName.split(path.sep);
    if (
      metadateType === "CustomField" ||
      metadateType === "RecordType" ||
      metadateType === "ListView" ||
      metadateType === "ValidationRule" ||
      metadateType === "WebLink" ||
      metadateType === "CompactLayout" ||
      metadateType === "BusinessProcess"
    ) {
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
    let metadateType = MetadataFiles.getNameOfTypes(fileName);
    let splitFilepath = fileName.split(path.sep);
    if (
      metadateType === "CustomField" ||
      metadateType === "RecordType" ||
      metadateType === "ListView" ||
      metadateType === "ValidationRule" ||
      metadateType === "WebLink" ||
      metadateType === "CompactLayout" ||
      metadateType === "BusinessProcess"
    ) {
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
    if (name === "CustomField" || name === "CustomObject") {
      //Custom Field or Custom Object
      result = componentName.endsWith("__c") || componentName.endsWith("__mdt");
    }
    return result;
  }
  public static getMemberNameFromFilepath(
    filepath: string,
    name: string
  ): string {
    var member: string;
    var splitFilepath = filepath.split(path.sep);
    var lastIndex = splitFilepath.length - 1;
    if (
      name === "CustomField" ||
      name === "RecordType" ||
      name === "ListView" ||
      name === "ValidationRule" ||
      name === "WebLink" ||
      name === "CompactLayout" ||
      name === "BusinessProcess"
    ) {
      var objectName = splitFilepath[lastIndex - 2];
      var fieldName = splitFilepath[lastIndex].split(".")[0];
      member = objectName.concat("." + fieldName);
    } else if (
      name === "Dashboard" ||
      name === "Document" ||
      name === "EmailTemplate" ||
      name === "Report"
    ) {
      let baseName = "";
      switch (name) {
        case "Dashboard":
          baseName = "dashboards";
          break;
        case "Document":
          baseName = "documents";
          break;
        case "EmailTemplate":
          baseName = "email";
          break;
        case "Report":
          baseName = "reports";
          break;
      }
      let baseIndex = filepath.lastIndexOf(baseName) + baseName.length;
      var cmpPath = filepath.substring(baseIndex + 1); // add 1 to remove the path seperator
      cmpPath = cmpPath.substring(0, cmpPath.indexOf("."));
      member = cmpPath.replace(path.sep, "/");
    } else if (name === "QuickAction") {
      member = splitFilepath[lastIndex].replace(".quickAction-meta.xml", "");
    } else if (name === "CustomMetadata") {
      member = splitFilepath[lastIndex].replace(".md-meta.xml", "");
    }
    // Add exceptions for member names that need to be treated differently using else if
    else {
      member = splitFilepath[lastIndex].split(".")[0];
    }
    return member;
  }
  //Determine the name based on the filename, for example, ApexClass, CustomObject etc
  //NEED TO TAKE INTO CONSIDERATION OTHER TYPES AS WELL
  public static getNameOfTypes(filename: string): string {
    let name: string;
    if (filename.endsWith(".settings-meta.xml")) {
      name = "AccountSettings";
    } else if (filename.endsWith(".actionLinkGroupTemplate-meta.xml")) {
      name = "ActionLinkGroupTemplate";
    } else if (filename.endsWith(".cls-meta.xml")) {
      name = "ApexClass";
    } else if (filename.endsWith(".component-meta.xml")) {
      name = "ApexComponent";
    } else if (filename.endsWith(".page-meta.xml")) {
      name = "ApexPage";
    } else if (filename.endsWith(".trigger-meta.xml")) {
      name = "ApexTrigger";
    } else if (filename.endsWith(".approvalProcess-meta.xml")) {
      name = "ApprovalProcess";
    } else if (filename.endsWith(".assignmentRules-meta.xml")) {
      name = "AssignmentRules";
    } else if (filename.endsWith(".authProvider-meta.xml")) {
      name = "AuthProvider";
    } else if (filename.endsWith(".app-meta.xml")) {
      name = "CustomApplication";
    } else if (filename.endsWith(".customApplicationComponent-meta.xml")) {
      name = "CustomApplicationComponent";
    } else if (filename.endsWith(".object-meta.xml")) {
      name = "CustomObject";
    } else if (filename.endsWith(".md-meta.xml")) {
      name = "CustomMetadata";
    } else if (filename.endsWith(".field-meta.xml")) {
      name = "CustomField";
    } else if (filename.endsWith(".webLink-meta.xml")) {
      name = "WebLink";
    } else if (filename.endsWith(".listView-meta.xml")) {
      name = "ListView";
    } else if (filename.endsWith(".validationRule-meta.xml")) {
      name = "ValidationRule";
    } else if (filename.endsWith(".tab-meta.xml")) {
      name = "CustomTab";
    } else if (
      filename.endsWith(".dashboard-meta.xml") ||
      filename.endsWith(".dashboardFolder-meta.xml")
    ) {
      name = "Dashboard";
    } else if (filename.endsWith(".document-meta.xml")) {
      name = "Document";
    } else if (
      filename.endsWith(".email-meta.xml") ||
      filename.endsWith(".emailFolder-meta.xml")
    ) {
      name = "EmailTemplate";
    } else if (filename.endsWith(".delegateGroup-meta.xml")) {
      name = "DelegateGroup";
    } else if (filename.endsWith(".duplicateRule-meta.xml")) {
      name = "DuplicateRule";
    } else if (filename.endsWith(".objectTranslation-meta.xml")) {
      name = "CustomObjectTranslation";
    } else if (filename.endsWith(".recordType-meta.xml")) {
      name = "RecordType";
    } else if (filename.endsWith(".layout-meta.xml")) {
      name = "Layout";
    } else if (filename.endsWith(".quickAction-meta.xml")) {
      name = "QuickAction";
    } else if (
      filename.endsWith(".report-meta.xml") ||
      filename.endsWith(".reportFolder-meta.xml")
    ) {
      name = "Report";
    } else if (filename.endsWith(".resource-meta.xml")) {
      name = "StaticResource";
    } else if (filename.endsWith(".translations-meta.xml")) {
      name = "Translations";
    } else if (filename.endsWith(".role-meta.xml")) {
      name = "Role";
    } else if (filename.endsWith(".queue-meta.xml")) {
      name = "Queue";
    } else if (filename.endsWith(".group-meta.xml")) {
      name = "Group";
    } else if (filename.endsWith(".profile-meta.xml")) {
      name = "Profile";
    } else if (filename.endsWith(".permissionset-meta.xml")) {
      name = "PermissionSet";
    } else if (filename.endsWith(".site-meta.xml")) {
      name = "CustomSite";
    }
    return name;
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
            METADATA_INFO[keys[i]].files.push(metadataFile);

            let name = FileUtils.getFileNameWithoudExtension(
              metadataFile,
              METADATA_INFO[keys[i]].sourceExtension
            );

            if (METADATA_INFO[keys[i]].isChildComponent) {
              let fileParts = metadataFile.split(path.sep);
              let parentName = fileParts[fileParts.length - 3];
              name = parentName + "." + name;
            }

            METADATA_INFO[keys[i]].components.push(name);

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
}
