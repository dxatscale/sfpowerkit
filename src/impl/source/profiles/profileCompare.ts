import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import MetadataFiles from "../../metadata/metadataFiles";
import * as fs from "fs-extra";
import * as path from "path";
import * as _ from "lodash";
import ProfileActions from "./profileActions";
import Excel, { Workbook, Worksheet } from "exceljs";
import ProfileWriter from "../../../impl/metadata/writer/profileWriter";
import Profile, {
  ProfileObjectPermissions,
  ProfileFieldLevelSecurity
} from "../../../impl/metadata/schema";

const unsupportedprofiles = [];

export default class ProfileCompare extends ProfileActions {
  metadataFiles: MetadataFiles;

  public async compare(profiles?: string[], isdelete?: boolean) {
    SFPowerkit.log("Retrieving profiles", LoggerLevel.DEBUG);
    SFPowerkit.log("Requested  profiles are..", LoggerLevel.DEBUG);
    SFPowerkit.log(profiles, LoggerLevel.DEBUG);
    let srcFolders = await SFPowerkit.getProjectDirectories();

    /*
    let profileObjs = await this.profileRetriever.loadProfiles(
      profiles,
      this.conn
    );
    */

    let profileObjs = await this.readProfileFromOrg(this.conn, profiles);
    const workbook = new Workbook();
    this.compareObjectPermissions(workbook, profileObjs as Profile[]);
    this.compareFieldPermissions(workbook, profileObjs as Profile[]);
    await workbook.xlsx.writeFile("profileCompare.xlsx");
  }

  private compareFieldPermissions(workbook: Workbook, profileList: Profile[]) {
    let fieldRowHeaders = [""];
    let fieldPermRowHeaders = [""];
    let profileHeaderRow = ["Profiles", "Objects"];
    let permRows = [];
    // let mapObjectProfileFieldPermissions:Map<string, Map<string,ProfileFieldLevelSecurity[]>> = this.buildFieldPermissionsMap(profileList);
    for (let profileObj of profileList) {
      if (profileObj.fieldPermissions !== undefined) {
        let fieldPermRow = this.writeFieldPermission(
          profileObj.fullName,
          profileObj.fieldPermissions,
          fieldRowHeaders,
          fieldPermRowHeaders
        );
        permRows.push(fieldPermRow);
      }
    }
    let rows = [];
    rows.push(profileHeaderRow);
    rows.push(fieldRowHeaders);
    rows.push(fieldPermRowHeaders);
    rows.push(...permRows);

    //const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Fields Permissions", {
      properties: { tabColor: { argb: "DE4EB957" } }
    });
    sheet.state = "visible";
    sheet.addRows(rows, "i");
    for (let i = 2; i <= fieldRowHeaders.length; i = i + 2) {
      sheet.mergeCells(2, i, 2, i + 1);
    }
    sheet.mergeCells(1, 2, 1, fieldRowHeaders.length);
    sheet.mergeCells(1, 1, 3, 1);

    console.log("formating the cells");
    sheet.getColumn(1).style = {
      ...sheet.getColumn(1).style,
      font: {
        bold: true
      }
    };
    sheet.getColumn(1).width = 30;
    for (let i = 4; i <= profileList.length + 3; i++) {
      for (let j = 2; j < fieldRowHeaders.length + 1; j++) {
        if (sheet.getCell(i, j).value === "true") {
          sheet.getCell(i, j).style = {
            ...sheet.getCell(i, j).style,
            fill: {
              type: "gradient",
              gradient: "angle",
              degree: 0,
              stops: [
                { position: 0, color: { argb: "DE4EB957" } },
                { position: 0.5, color: { argb: "DE4EB957" } },
                { position: 1, color: { argb: "DE4EB957" } }
              ]
            }
          };
        } else {
          sheet.getCell(i, j).style = {
            ...sheet.getCell(i, j).style,
            fill: {
              type: "gradient",
              gradient: "angle",
              degree: 0,
              stops: [
                { position: 0, color: { argb: "DEFE351A" } },
                { position: 0.5, color: { argb: "DEFE351A" } },
                { position: 1, color: { argb: "DEFE351A" } }
              ]
            }
          };
        }
      }
    }
  }

  private buildFieldPermissionsMap(profileList: Profile[]) {
    let mapObjectProfileFieldPermissions: Map<
      string,
      Map<string, ProfileFieldLevelSecurity[]>
    > = new Map();
    for (let profileObj of profileList) {
      let profileName = profileObj.fullName;
      if (profileObj.fieldPermissions !== undefined) {
        let fieldPermissions = profileObj.fieldPermissions || [];
        for (const fieldPermission of fieldPermissions) {
          let fullName = fieldPermission.field;
          let parts = fullName.split(".");
          let objectName = parts[0];
          let fieldName = parts[1];
          if (!mapObjectProfileFieldPermissions.has(objectName)) {
            let fields: ProfileFieldLevelSecurity[] = [fieldPermission];
            let profileMap = new Map();
            profileMap.set(profileName, fields);
            mapObjectProfileFieldPermissions.set(objectName, profileMap);
          } else if (
            !mapObjectProfileFieldPermissions.get(objectName).has(profileName)
          ) {
            let fields: ProfileFieldLevelSecurity[] = [fieldPermission];
            mapObjectProfileFieldPermissions
              .get(objectName)
              .set(profileName, fields);
          } else {
            mapObjectProfileFieldPermissions
              .get(objectName)
              .get(profileName)
              .push(fieldPermission);
          }
        }
      }
    }
    return mapObjectProfileFieldPermissions;
  }
  private compareObjectPermissions(workbook: Workbook, profileList: Profile[]) {
    let objRowHeaders = [""];
    let objPermRowHeaders = [""];
    let profileHeaderRow = ["Profiles", "Objects"];
    let permRows = [];
    for (let profileObj of profileList) {
      if (profileObj.objectPermissions !== undefined) {
        let objPermRow = this.writeObjectPermission(
          profileObj.fullName,
          profileObj.objectPermissions,
          objRowHeaders,
          objPermRowHeaders
        );
        permRows.push(objPermRow);
      }
    }
    let rows = [];
    rows.push(profileHeaderRow);
    rows.push(objRowHeaders);
    rows.push(objPermRowHeaders);
    rows.push(...permRows);

    //const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Object Permissions", {
      properties: { tabColor: { argb: "FFC0000" } }
    });
    sheet.state = "visible";
    sheet.addRows(rows, "i");
    for (let i = 2; i <= objRowHeaders.length; i = i + 6) {
      sheet.mergeCells(2, i, 2, i + 5);
    }
    sheet.mergeCells(1, 2, 1, objRowHeaders.length);
    sheet.mergeCells(1, 1, 3, 1);

    console.log("formating the cells");
    sheet.getColumn(1).style = {
      ...sheet.getColumn(1).style,
      font: {
        bold: true
      }
    };
    sheet.getColumn(1).width = 30;
    for (let i = 4; i <= profileList.length + 3; i++) {
      for (let j = 2; j < objRowHeaders.length + 1; j++) {
        if (sheet.getCell(i, j).value === "true") {
          sheet.getCell(i, j).style = {
            ...sheet.getCell(i, j).style,
            fill: {
              type: "gradient",
              gradient: "angle",
              degree: 0,
              stops: [
                { position: 0, color: { argb: "DE4EB957" } },
                { position: 0.5, color: { argb: "DE4EB957" } },
                { position: 1, color: { argb: "DE4EB957" } }
              ]
            }
          };
          /*
          sheet.getCell(i, j).style = {
            ...sheet.getCell(i, j).style,
            font: {
              color: { argb: "DE4EB957" }
            }
          };
          */
        } else {
          sheet.getCell(i, j).style = {
            ...sheet.getCell(i, j).style,
            fill: {
              type: "gradient",
              gradient: "angle",
              degree: 0,
              stops: [
                { position: 0, color: { argb: "DEFE351A" } },
                { position: 0.5, color: { argb: "DEFE351A" } },
                { position: 1, color: { argb: "DEFE351A" } }
              ]
            }
          };
          /*
          sheet.getCell(i, j).style = {
            ...sheet.getCell(i, j).style,
            font: {
              color: { argb: "DEFE351A" }
            }
          };
          */
        }
      }
    }
  }

  private writeFieldPermission(
    profileName: string,
    fieldPermissions: ProfileFieldLevelSecurity[],
    fieldRowHeaders: string[],
    fieldPermRowHeaders: string[]
  ) {
    let fieldPermRow = [profileName];
    for (const fieldPerm of fieldPermissions) {
      let fieldName = fieldPerm.field;
      let index = fieldRowHeaders.indexOf(fieldName);
      if (index < 0) {
        fieldRowHeaders.push(fieldName);
        fieldRowHeaders.push("");
        fieldPermRowHeaders.push("editable");
        fieldPermRowHeaders.push("readable");
        index = fieldRowHeaders.length - 1;
      }
      fieldPermRow.push(String(fieldPerm.editable));
      fieldPermRow.push(String(fieldPerm.readable));
    }
    return fieldPermRow;
  }
  private writeObjectPermission(
    profileName: string,
    objectPermissions: ProfileObjectPermissions[],
    objRowHeaders: string[],
    objPermRowHeaders: string[]
  ) {
    let objPermRow = [profileName];
    for (const objPerm of objectPermissions) {
      let objName = objPerm.object;
      let index = objRowHeaders.indexOf(objName);
      if (index < 0) {
        objRowHeaders.push(objName);
        objRowHeaders.push("");
        objRowHeaders.push("");
        objRowHeaders.push("");
        objRowHeaders.push("");
        objRowHeaders.push("");
        objPermRowHeaders.push("allowCreate");
        objPermRowHeaders.push("allowDelete");
        objPermRowHeaders.push("allowEdit");
        objPermRowHeaders.push("allowRead");
        objPermRowHeaders.push("modifyAllRecords");
        objPermRowHeaders.push("viewAllRecords");
        index = objRowHeaders.length - 1;
      }
      objPermRow.push(String(objPerm.allowCreate));
      objPermRow.push(String(objPerm.allowDelete));
      objPermRow.push(String(objPerm.allowEdit));
      objPermRow.push(String(objPerm.allowRead));
      objPermRow.push(String(objPerm.modifyAllRecords));
      objPermRow.push(String(objPerm.viewAllRecords));
    }
    return objPermRow;
  }
}
