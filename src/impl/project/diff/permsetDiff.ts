import * as fs from "fs-extra";
import * as xml2js from "xml2js";
import * as util from "util";
import * as _ from "lodash";
import DiffUtil from "./diffUtil";

const nonArayProperties = [
  "description",
  "hasActivationRequired",
  "label",
  "license",
  "userLicense",
  "$",
  "fullName"
];

const parser = new xml2js.Parser({
  explicitArray: false,
  valueProcessors: [
    function(name) {
      if (name === "true") name = true;
      if (name === "false") name = false;
      return name;
    }
  ]
});

export default abstract class PermsetDiff {
  protected debugFlag: boolean;

  public constructor(debugFlag?: boolean) {
    this.debugFlag = debugFlag;
  }

  public static async generatePermissionsetXml(
    permissionsetXml1: string,
    permissionsetXml2: string,
    outputFilePath: string
  ) {
    const parseString = util.promisify(parser.parseString);

    let parseResult = await parseString(permissionsetXml1);
    let permsetObj1 = parseResult.PermissionSet;
    parseResult = await parseString(permissionsetXml2);
    let permsetObj2 = parseResult.PermissionSet;

    let newPermsetObj = {} as any;

    newPermsetObj.label = permsetObj2.label;

    if (!_.isNil(permsetObj2.description)) {
      newPermsetObj.description = permsetObj2.description;
    }
    if (!_.isNil(permsetObj2.license)) {
      newPermsetObj.license = permsetObj2.license;
    }
    if (permsetObj2.hasActivationRequired) {
      newPermsetObj.hasActivationRequired = permsetObj2.hasActivationRequired;
    }

    newPermsetObj.applicationVisibilities = DiffUtil.getChangedOrAdded(
      permsetObj1.applicationVisibilities,
      permsetObj2.applicationVisibilities,
      "application"
    ).addedEdited;
    newPermsetObj.classAccesses = DiffUtil.getChangedOrAdded(
      permsetObj1.classAccesses,
      permsetObj2.classAccesses,
      "apexClass"
    ).addedEdited;
    newPermsetObj.customPermissions = DiffUtil.getChangedOrAdded(
      permsetObj1.customPermissions,
      permsetObj2.customPermissions,
      "name"
    ).addedEdited;
    newPermsetObj.externalDataSourceAccesses = DiffUtil.getChangedOrAdded(
      permsetObj1.externalDataSourceAccesses,
      permsetObj2.externalDataSourceAccesses,
      "externalDataSource"
    ).addedEdited;

    newPermsetObj.fieldPermissions = DiffUtil.getChangedOrAdded(
      permsetObj1.fieldPermissions,
      permsetObj2.fieldPermissions,
      "field"
    ).addedEdited;

    newPermsetObj.objectPermissions = DiffUtil.getChangedOrAdded(
      permsetObj1.objectPermissions,
      permsetObj2.objectPermissions,
      "object"
    ).addedEdited;
    newPermsetObj.pageAccesses = DiffUtil.getChangedOrAdded(
      permsetObj1.pageAccesses,
      permsetObj2.pageAccesses,
      "apexPage"
    ).addedEdited;

    newPermsetObj.recordTypeVisibilities = DiffUtil.getChangedOrAdded(
      permsetObj1.recordTypeVisibilities,
      permsetObj2.recordTypeVisibilities,
      "recordType"
    ).addedEdited;
    newPermsetObj.tabSettings = DiffUtil.getChangedOrAdded(
      permsetObj1.tabSettings,
      permsetObj2.tabSettings,
      "tab"
    ).addedEdited;
    newPermsetObj.userPermissions = DiffUtil.getChangedOrAdded(
      permsetObj1.userPermissions,
      permsetObj2.userPermissions,
      "name"
    ).addedEdited;

    await PermsetDiff.writePermset(newPermsetObj, outputFilePath);
  }

  private static async writePermset(permsetObj: any, filePath: string) {
    //Delete eampty arrays
    for (var key in permsetObj) {
      if (Array.isArray(permsetObj[key])) {
        //All top element must be arays exept non arrayProperties
        if (!nonArayProperties.includes(key) && permsetObj[key].length === 0) {
          delete permsetObj[key];
        }
      }
    }
    if (permsetObj.label != undefined) {
      var builder = new xml2js.Builder({ rootName: "PermissionSet" });
      permsetObj["$"] = {
        xmlns: "http://soap.sforce.com/2006/04/metadata"
      };
      var xml = builder.buildObject(permsetObj);

      fs.writeFileSync(filePath, xml);
    }
  }
}
