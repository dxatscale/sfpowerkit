import { SFPowerkit } from "../../../sfpowerkit";
import { Connection } from "jsforce";
import { LoggerLevel } from "@salesforce/core";
import {
  getInstalledPackages,
  PackageDetail
} from "../../../utils/packageUtils";

export default class PackageInfo {
  conn: Connection;
  apiversion: string;

  public constructor(
    conn: Connection,
    apiversion: string,
    jsonOutput: boolean
  ) {
    this.conn = conn;
    this.apiversion = apiversion;
  }

  public async getPackages(): Promise<PackageDetail[]> {
    //await this.getInstalledPackageInfo();
    let packageDetails = await getInstalledPackages(this.conn, true);

    SFPowerkit.log(
      "PackageDetails:" + JSON.stringify(packageDetails),
      LoggerLevel.TRACE
    );
    return packageDetails;
  }
}
