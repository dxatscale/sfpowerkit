import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import MetadataFiles from "../../metadata/metadataFiles";
import ProfileActions from "./profileActions";
import { Workbook } from "exceljs";
import Profile, {
  ProfileObjectPermissions,
  ProfileFieldLevelSecurity,
  ApplicationVisibility
} from "../../../impl/metadata/schema";
import { Org } from "@salesforce/core";

export default class ProfileCompare extends ProfileActions {
  metadataFiles: MetadataFiles;
  workbook: Workbook;
  public constructor(public org: Org, debugFlag?: boolean) {
    super(org, debugFlag);
  }

  public async compare(profiles?: string[], isdelete?: boolean) {
    SFPowerkit.log("Retrieving profiles", LoggerLevel.DEBUG);
    SFPowerkit.log("Requested  profiles are..", LoggerLevel.DEBUG);
    SFPowerkit.log(profiles, LoggerLevel.DEBUG);

    let profileObjs = await this.readProfileFromOrg(this.conn, profiles);
    this.workbook = new Workbook();
    this.compareObjectPermissions(profileObjs as Profile[]);
    this.compareFieldPermissions(profileObjs as Profile[]);
    this.compareApplicationVisibilitiess(profileObjs as Profile[]);
    await this.workbook.xlsx.writeFile("profileCompare.xlsx");
  }

  private compareFieldPermissions(profileList: Profile[]) {
    let mapObjectProfileFieldPermissions: Map<
      string,
      Map<string, ProfileFieldLevelSecurity[]>
    > = this.buildFieldPermissionsMap(profileList);
    mapObjectProfileFieldPermissions.forEach(
      (profilesMap: Map<string, ProfileFieldLevelSecurity[]>, objectName) => {
        this.writeObjectFieldPermissions(profilesMap, objectName);
      }
    );
  }

  private writeObjectFieldPermissions(
    profilesMap: Map<string, ProfileFieldLevelSecurity[]>,
    objectName
  ) {
    let profileHeaderRow = ["Profiles", "Fields"];
    let fieldRowHeaders = [""];
    let fieldPermRowHeaders = [""];
    let permRows = [];
    let profiles = profilesMap.keys();
    for (const profile of profiles) {
      let fieldsPermissions = profilesMap.get(profile);
      if (fieldsPermissions !== undefined) {
        let fieldPermRow = this.writeFieldPermission(
          profile,
          fieldsPermissions,
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
    const sheet = this.workbook.addWorksheet(objectName, {
      properties: { tabColor: { argb: "DE4EB957" } }
    });
    sheet.state = "visible";
    sheet.addRows(rows, "i");
    for (let i = 2; i <= fieldRowHeaders.length; i = i + 2) {
      sheet.mergeCells(2, i, 2, i + 1);
    }
    sheet.mergeCells(1, 2, 1, fieldRowHeaders.length);
    sheet.mergeCells(1, 1, 3, 1);

    sheet.getColumn(1).style = {
      ...sheet.getColumn(1).style,
      font: {
        bold: true
      }
    };
    sheet.getColumn(1).width = 30;
    for (let i = 4; i <= profilesMap.size + 3; i++) {
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
  private compareObjectPermissions(profileList: Profile[]) {
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
    const sheet = this.workbook.addWorksheet("Object Permissions", {
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
  private compareApplicationVisibilitiess(profileList: Profile[]) {
    let appRowHeaders = [""];
    let appVisibilityRowHeaders = [""];
    let profileHeaderRow = ["Profiles", "Applications"];
    let permRows = [];
    for (let profileObj of profileList) {
      if (profileObj.applicationVisibilities !== undefined) {
        let objPermRow = this.writeAppVisibilities(
          profileObj.fullName,
          profileObj.applicationVisibilities,
          appRowHeaders,
          appVisibilityRowHeaders
        );
        permRows.push(objPermRow);
      }
    }
    let rows = [];
    rows.push(profileHeaderRow);
    rows.push(appRowHeaders);
    rows.push(appVisibilityRowHeaders);
    rows.push(...permRows);

    //const workbook = new Workbook();
    const sheet = this.workbook.addWorksheet("App Visibilities", {
      properties: { tabColor: { argb: "FFC0000" } }
    });
    sheet.state = "visible";
    sheet.addRows(rows, "i");
    for (let i = 2; i <= appRowHeaders.length; i = i + 2) {
      sheet.mergeCells(2, i, 2, i + 1);
    }
    sheet.mergeCells(1, 2, 1, appRowHeaders.length);
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
      for (let j = 2; j < appRowHeaders.length + 1; j++) {
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

  private writeFieldPermission(
    profileName: string,
    fieldPermissions: ProfileFieldLevelSecurity[],
    fieldRowHeaders: string[],
    fieldPermRowHeaders: string[]
  ) {
    let fieldPermRow = [profileName];
    for (const fieldPerm of fieldPermissions) {
      let fieldName = fieldPerm.field.split(".")[1];

      let index = fieldRowHeaders.indexOf(fieldName);
      if (index < 0) {
        fieldRowHeaders.push(fieldName);
        fieldRowHeaders.push("");
        fieldPermRowHeaders.push("editable");
        fieldPermRowHeaders.push("readable");
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
  private writeAppVisibilities(
    profileName: string,
    applicationVisibilities: ApplicationVisibility[],
    appRowHeaders: string[],
    appVisibilityRowHeaders: string[]
  ) {
    let appVisibilityRow = [profileName];
    for (const appVisibility of applicationVisibilities) {
      let appName = appVisibility.application;
      let index = appRowHeaders.indexOf(appName);
      if (index < 0) {
        appRowHeaders.push(appName);
        appRowHeaders.push("");
        appVisibilityRowHeaders.push("visible");
        appVisibilityRowHeaders.push("default");
      }
      appVisibilityRow.push(String(appVisibility.visible));
      appVisibilityRow.push(String(appVisibility.default));
    }
    return appVisibilityRow;
  }
}
