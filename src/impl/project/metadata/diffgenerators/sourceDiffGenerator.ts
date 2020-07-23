const xml2js = require("xml2js");
const util = require("util");
import { diff } from "nested-object-diff";

// TODO: extends base class diffGenerator
// diff generators will not only be used for git commits
// compares two entities
export class SourceDiffGenerator {
  constructor(public baseline: string, public target: string) {}
  // compares two entities
  public async compareRevisions(
    fileRevFrom: string | void,
    fileRevTo: string | void,
    filepath: string
  ): Promise<any> {
    let diffSummary = {};

    let filepathArray: string[] = filepath.split("/");
    let objectName: string = filepathArray[filepathArray.length - 3];

    let fileObjRevFrom;
    let fileObjRevTo;
    let parser = new xml2js.Parser({ explicitArray: false });
    let parseString = util.promisify(parser.parseString);

    let metadataType;
    let fullName;

    if (fileRevFrom) {
      fileObjRevFrom = await parseString(fileRevFrom);
      metadataType = Object.keys(fileObjRevFrom)[0];
      fullName = fileObjRevFrom[metadataType]["fullName"];
    }
    if (fileRevTo) {
      fileObjRevTo = await parseString(fileRevTo);
      metadataType = Object.keys(fileObjRevTo)[0];
      fullName = fileObjRevTo[metadataType]["fullName"];
    }

    if (!fileObjRevFrom && fileObjRevTo) {
      // Created new file
      diffSummary = {
        object: objectName,
        api_name: fullName,
        type: metadataType,
        from: this.baseline,
        to: this.target,
        filepath: filepath,
        diff: [
          {
            operation: "CREATE",
            coordinates: "",
            before: "",
            after: ""
          }
        ]
      };
    } else if (fileObjRevFrom && !fileObjRevTo) {
      // Deleted file
      diffSummary = {
        object: objectName,
        api_name: fullName,
        type: metadataType,
        from: this.baseline,
        to: this.target,
        filepath: filepath,
        diff: [
          {
            operation: "DELETE",
            coordinates: "",
            before: "",
            after: ""
          }
        ]
      };
    } else {
      let changesBetweenRevisions = diff(fileObjRevFrom, fileObjRevTo);

      let isPicklistValueChanged: boolean;
      let isValueSetChanged: boolean;
      changesBetweenRevisions = changesBetweenRevisions
        .filter(change => {
          // Filter out changes to ValueSets & PicklistValues
          if (change["path"].includes("valueSetDefinition")) {
            isValueSetChanged = true;
            return false;
          } else if (change["path"].includes("picklistValues")) {
            isPicklistValueChanged = true;
            return false;
          } else {
            return true;
          }
        })
        .map(change => {
          // Rename properties
          let operation: string;
          switch (change["type"]) {
            case "A": {
              operation = "ADD";
              break;
            }
            case "E": {
              operation = "EDIT";
              break;
            }
            case "D": {
              operation = "REMOVE";
              break;
            }
          }

          let root = new RegExp(`^${metadataType}\\.`);
          return {
            operation: operation,
            coordinates: change["path"].replace(root, ""),
            before: change["lhs"],
            after: change["rhs"]
          };
        });

      if (isPicklistValueChanged) {
        changesBetweenRevisions.push({
          operation: "EDIT",
          coordinates: "PicklistValue",
          before: "",
          after: ""
        });
      }

      if (isValueSetChanged) {
        changesBetweenRevisions.push({
          operation: "EDIT",
          coordinates: "ValueSet",
          before: "",
          after: ""
        });
      }

      diffSummary = {
        object: objectName,
        api_name: fullName,
        type: metadataType,
        from: this.baseline,
        to: this.target,
        filepath: filepath,
        diff: changesBetweenRevisions
      };
    }
    return diffSummary;
  }
}
