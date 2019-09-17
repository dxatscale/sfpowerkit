import * as path from "path";
import _ from "lodash";
import simplegit = require("simple-git/promise");
import MetadataFiles from "../../../impl/metadata/metadataFiles";

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
  public static async isFormulaField(
    diffFile: DiffFileStatus
  ): Promise<boolean> {
    let content = await git.show(["--raw", diffFile.revisionFrom]);
    let result = content.includes("<formula>");
    return result;
  }

  public static parseContent(fileContents): DiffFile {
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
        var lineParts = fileContents[i].split(statusRegEx);

        var finalPath = path.join(
          ".",
          lineParts[1].replace(lineBreakRegEx, "")
        );
        finalPath = finalPath.trim();
        finalPath = finalPath.replace("\\303\\251", "é");

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
        var lineParts = fileContents[i].split(renamedRegEx);

        var pathsParts = path.join(".", lineParts[1].trim());
        pathsParts = pathsParts.replace("\\303\\251", "é");
        let revisionPart = lineParts[0].split(/\t|\s/);

        var paths = pathsParts.split(tabRegEx);

        if (!metadataFiles.accepts(paths[0].trim())) {
          continue;
        }

        diffFile.addedEdited.push({
          revisionFrom: "000000000",
          revisionTo: revisionPart[3],
          renamedPath: paths[0].trim(),
          path: paths[1].trim()
        });

        //allow deletion of renamed components
        diffFile.deleted.push({
          revisionFrom: revisionPart[2],
          revisionTo: "000000000",
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
}
