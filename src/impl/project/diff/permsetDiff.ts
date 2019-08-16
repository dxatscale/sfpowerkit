import { METADATA_INFO } from "../../../shared/metadataInfo";
import { SfPowerKit } from "../../../sfpowerkit";
import * as path from "path";
import * as fs from "fs";
import FileUtils from "../../../shared/fileutils";
import { Org } from "@salesforce/core";
import { Connection } from "@salesforce/core";
import xml2js = require("xml2js");
import util = require("util");
import Profile from "../../metadata/schema";
import _ from "lodash";
import DiffUtil from "../../project/diff/diffutils";

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
      if (name.trim() === "false") name = false;
      return name;
    }
  ]
});

export default abstract class PermsetDiff {
  protected conn: Connection;
  protected debugFlag: boolean;

  public constructor(public org: Org, debugFlag?: boolean) {
    if (this.org !== undefined) {
      this.conn = this.org.getConnection();
    }
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
    );
    newPermsetObj.classAccesses = DiffUtil.getChangedOrAdded(
      permsetObj1.classAccesses,
      permsetObj2.classAccesses,
      "apexClass"
    );
    newPermsetObj.customPermissions = DiffUtil.getChangedOrAdded(
      permsetObj1.customPermissions,
      permsetObj2.customPermissions,
      "name"
    );
    newPermsetObj.externalDataSourceAccesses = DiffUtil.getChangedOrAdded(
      permsetObj1.externalDataSourceAccesses,
      permsetObj2.externalDataSourceAccesses,
      "externalDataSource"
    );

    newPermsetObj.fieldPermissions = DiffUtil.getChangedOrAdded(
      permsetObj1.fieldPermissions,
      permsetObj2.fieldPermissions,
      "field"
    );

    newPermsetObj.objectPermissions = DiffUtil.getChangedOrAdded(
      permsetObj1.objectPermissions,
      permsetObj2.objectPermissions,
      "object"
    );
    newPermsetObj.pageAccesses = DiffUtil.getChangedOrAdded(
      permsetObj1.pageAccesses,
      permsetObj2.pageAccesses,
      "apexPage"
    );

    newPermsetObj.recordTypeVisibilities = DiffUtil.getChangedOrAdded(
      permsetObj1.recordTypeVisibilities,
      permsetObj2.recordTypeVisibilities,
      "recordType"
    );
    newPermsetObj.tabSettings = DiffUtil.getChangedOrAdded(
      permsetObj1.tabSettings,
      permsetObj2.tabSettings,
      "tab"
    );
    newPermsetObj.userPermissions = DiffUtil.getChangedOrAdded(
      permsetObj1.userPermissions,
      permsetObj2.userPermissions,
      "name"
    );

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
