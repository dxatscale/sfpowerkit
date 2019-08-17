import * as fs from "fs";
import * as xml2js from "xml2js";
import util = require("util");
import DiffUtil from "./diffutils";
const _ = require("lodash");

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

export default class CustomLabelsDiff {
  public static async generateCustomLabelsXml(
    customLabelsXml1: string,
    customLabelsXml2: string,
    outputFilePath: string,
    destructivePackageObj: any[]
  ) {
    let customLabelsObj1: any = {};
    let customLabelsObj2: any = {};

    const parseString = util.promisify(parser.parseString);

    if (customLabelsXml1 !== "") {
      let parseResult = await parseString(customLabelsXml1);
      customLabelsObj1 = parseResult.CustomLabels || {};
    }

    if (customLabelsXml2 !== "") {
      let parseResult = await parseString(customLabelsXml2);
      customLabelsObj2 = parseResult.CustomLabels || {};
    }

    // Building the new workflow object for the added and modified fields
    let addedEditedOrDeleted = CustomLabelsDiff.buildCustomLabelsObj(
      customLabelsObj1,
      customLabelsObj2
    );

    if (
      addedEditedOrDeleted.addedEdited.labels &&
      addedEditedOrDeleted.addedEdited.labels.length > 0
    ) {
      CustomLabelsDiff.generateXmlFile(
        addedEditedOrDeleted.addedEdited,
        outputFilePath
      );
    }

    // Check for deletion

    destructivePackageObj = CustomLabelsDiff.buildDestructiveChanges(
      addedEditedOrDeleted.deleted,
      destructivePackageObj
    );
    return destructivePackageObj;
  }

  private static buildCustomLabelsObj(
    customLabelsObj1: any,
    customLabelsObj2: any
  ) {
    let newcustomLabelsObj = {
      $: { xmlns: "http://soap.sforce.com/2006/04/metadata" },
      labels: []
    };

    if (
      !_.isNil(customLabelsObj1.labels) &&
      !Array.isArray(customLabelsObj1.labels)
    ) {
      customLabelsObj1.labels = [customLabelsObj1.labels];
    }

    if (
      !_.isNil(customLabelsObj2.labels) &&
      !Array.isArray(customLabelsObj2.labels)
    ) {
      customLabelsObj2.labels = [customLabelsObj2.labels];
    }

    let deletedCustomLabelsObj = {
      $: { xmlns: "http://soap.sforce.com/2006/04/metadata" },
      labels: []
    };

    let addedDeleted = DiffUtil.getChangedOrAdded(
      customLabelsObj1.labels,
      customLabelsObj2.labels,
      "fullName"
    );

    newcustomLabelsObj.labels = addedDeleted.addedEdited;
    deletedCustomLabelsObj.labels = addedDeleted.deleted;

    return {
      addedEdited: newcustomLabelsObj,
      deleted: deletedCustomLabelsObj
    };
  }

  private static buildDestructiveChanges(
    deletedCustomLabels: any,
    destructivePackageObj: any[]
  ) {
    let labelType: any = _.find(destructivePackageObj, function(metaType: any) {
      return metaType.name === "CustomLabel";
    });
    if (
      labelType === undefined &&
      deletedCustomLabels.labels !== undefined &&
      deletedCustomLabels.labels.length > 0
    ) {
      labelType = {
        name: "CustomLabel",
        members: []
      };
      destructivePackageObj.push(labelType);
    }
    if (deletedCustomLabels.labels !== undefined) {
      deletedCustomLabels.labels.forEach(elem => {
        labelType.members.push(elem.fullName);
      });
    }
    return destructivePackageObj;
  }

  private static generateXmlFile(
    newCustomLabelsObj: any,
    outputFilePath: string
  ) {
    const builder = new xml2js.Builder({
      xmldec: { version: "1.0", encoding: "UTF-8", standalone: null }
    });
    let customLabelObj = {
      CustomLabels: newCustomLabelsObj
    };
    let xml = builder.buildObject(customLabelObj);
    fs.writeFileSync(outputFilePath, xml);
  }
}
