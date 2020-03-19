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

    let packageNamespacePrefixList = [];
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
          if (packageDetail.packageNamespacePrefix) {
            packageNamespacePrefixList.push(
              "'" + packageDetail.packageNamespacePrefix + "'"
            );
          }
        });
      }
    });

    let licenseMap = new Map();
    if (packageNamespacePrefixList) {
      let packageLicensingQuery = `SELECT AllowedLicenses, UsedLicenses,ExpirationDate, NamespacePrefix, IsProvisioned, Status FROM PackageLicense  WHERE NamespacePrefix IN (${packageNamespacePrefixList})`;
      await this.conn.query(packageLicensingQuery).then(queryResult => {
        if (queryResult.records && queryResult.records.length > 0) {
          queryResult.records.forEach(record => {
            let licenseDetailObj = {} as PackageDetail;
            licenseDetailObj.allowedLicenses = record["AllowedLicenses"];
            licenseDetailObj.usedLicenses = record["UsedLicenses"];
            licenseDetailObj.expirationDate = record["ExpirationDate"];
            licenseDetailObj.status = record["Status"];
            licenseMap.set(record["NamespacePrefix"], licenseDetailObj);
          });
        }
      });
    }

    if (packageDetails && licenseMap) {
      packageDetails.forEach(detail => {
        if (
          detail.packageNamespacePrefix &&
          licenseMap.has(detail.packageNamespacePrefix)
        ) {
          let licDetail = licenseMap.get(detail.packageNamespacePrefix);
          detail.allowedLicenses = licDetail.allowedLicenses;
          detail.usedLicenses = licDetail.usedLicenses;
          detail.expirationDate = licDetail.expirationDate;
          detail.status = licDetail.status;
        }
      });
    }

    return packageDetails;
  }
}

export interface PackageDetail {
  packageName: string;
  packageNamespacePrefix: string;
  packageVersionNumber: string;
  packageVersionId: string;
  allowedLicenses: number;
  usedLicenses: number;
  expirationDate: string;
  status: string;
}
