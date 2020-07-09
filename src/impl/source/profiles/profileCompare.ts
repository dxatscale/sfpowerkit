import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import MetadataFiles from "../../metadata/metadataFiles";
import * as fs from "fs-extra";
import * as path from "path";
import * as _ from "lodash";
import ProfileActions from "./profileActions";
import Excel, { Workbook, Worksheet } from "exceljs";
import ProfileWriter from "../../../impl/metadata/writer/profileWriter";
import Profile, {
  ProfileObjectPermissions
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
    await workbook.xlsx.writeFile("profileCompare.xlsx");
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

    console.log(rows);

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
