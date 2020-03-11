import { SFPowerkit } from "../../../sfpowerkit";
import { Connection } from "jsforce";
import { LoggerLevel } from "@salesforce/core";

export default class PackageInfo {
  conn: Connection;
  apiversion: string;
  jsonOutput: boolean;
  public constructor(
    conn: Connection,
    apiversion: string,
    jsonOutput: boolean
  ) {
    this.conn = conn;
    this.apiversion = apiversion;
    this.jsonOutput = jsonOutput;
  }

  public async getPackages(): Promise<PackageDetail[]> {
    //await this.getInstalledPackageInfo();
    let packageDetails = await this.getInstalledPackages();
    SFPowerkit.log(packageDetails, LoggerLevel.DEBUG);
    return packageDetails;
  }

  private async getInstalledPackages(): Promise<PackageDetail[]> {
    let packageDetails = [];
    let installedPackagesQuery =
      "SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, " +
      "SubscriberPackageVersion.Id, SubscriberPackageVersion.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, " +
      "SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber FROM InstalledSubscriberPackage " +
      "ORDER BY SubscriberPackageId";

    await this.conn.tooling.query(installedPackagesQuery).then(queryResult => {
      const records = queryResult.records;

      if (records && records.length > 0) {
        records.forEach(record => {
          const packageDetail = {} as PackageDetail;
          packageDetail.packageName = record["SubscriberPackage"]["Name"];
          packageDetail.packageNamespacePrefix =
            record["SubscriberPackage"]["NamespacePrefix"];
          packageDetail.packageVersionId =
            record["SubscriberPackageVersion"]["Id"];
          packageDetail.packageVersionNumber = `${record["SubscriberPackageVersion"]["MajorVersion"]}.${record["SubscriberPackageVersion"]["MinorVersion"]}.${record["SubscriberPackageVersion"]["PatchVersion"]}.${record["SubscriberPackageVersion"]["BuildNumber"]}`;
          packageDetails.push(packageDetail);
        });
      }
    });
    return packageDetails;
  }
}

export interface PackageDetail {
  packageName: string;
  packageNamespacePrefix: string;
  packageVersionNumber: string;
  packageVersionId: string;
}
