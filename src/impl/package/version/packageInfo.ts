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
  public async getPackagesDetailsfromDevHub(
    hubconn: Connection,
    pkgDetails: PackageDetail[]
  ): Promise<PackageDetail[]> {
    let pkgIds: string[] = [];
    pkgDetails.forEach(pkg => {
      if (pkg.type === "Unlocked") {
        pkgIds.push(pkg.packageVersionId);
      }
    });

    if (pkgIds.length > 0) {
      let installedPackagesQuery = `SELECT SubscriberPackageVersionId, HasPassedCodeCoverageCheck,CodeCoverage,ValidationSkipped FROM Package2Version WHERE SubscriberPackageVersionId IN('${pkgIds.join(
        "','"
      )}')`;
      let response = (await hubconn.tooling.query(
        installedPackagesQuery
      )) as any;
      if (response.records && response.records.length > 0) {
        response.records.forEach(record => {
          for (let pkg of pkgDetails) {
            if (pkg.packageVersionId === record.SubscriberPackageVersionId) {
              pkg.codeCoverageCheckPassed = record.HasPassedCodeCoverageCheck;
              pkg.CodeCoverage = record.CodeCoverage
                ? record.CodeCoverage.apexCodeCoveragePercentage
                : 0;
              pkg.validationSkipped = record.ValidationSkipped;
            }
          }
        });
      }
    }

    return pkgDetails;
  }
}
