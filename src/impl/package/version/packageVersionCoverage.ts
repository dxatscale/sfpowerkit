import { SFPowerkit } from "../../../sfpowerkit";
import { LoggerLevel } from "@salesforce/core";
import { Connection } from "jsforce";

const QUERY_string = `SELECT SubscriberPackageVersionId,Package2Id, Package2.Name,MajorVersion,MinorVersion,PatchVersion,BuildNumber, CodeCoverage, HasPassedCodeCoverageCheck, Name FROM Package2Version WHERE `;
const DEFAULT_ORDER_BY_FIELDS =
  "Package2Id, MajorVersion, MinorVersion, PatchVersion, BuildNumber";
export default class PackageVersionCoverage {
  public constructor() {}

  public async getCoverage(
    versionId: string[],
    versionNumber: string,
    packageName: string,
    conn: Connection
  ): Promise<PackageCoverage[]> {
    let whereClause = (await this.getWhereClause(
      versionId,
      versionNumber,
      packageName
    )) as string;

    if (!whereClause) {
      throw new Error(
        "Either versionId or versionNumber and packageName is mandatory"
      );
    }

    let output = [];

    const result = (await conn.tooling.query(
      `${QUERY_string} ${whereClause} ORDER BY ${DEFAULT_ORDER_BY_FIELDS}`
    )) as any;
    if (result && result.size > 0) {
      result.records.forEach(record => {
        var packageCoverage = <PackageCoverage>{};
        packageCoverage.HasPassedCodeCoverageCheck =
          record.HasPassedCodeCoverageCheck;
        packageCoverage.coverage = record.CodeCoverage
          ? record.CodeCoverage.apexCodeCoveragePercentage
          : 0;
        packageCoverage.packageId = record.Package2Id;
        packageCoverage.packageName = record.Package2.Name;
        packageCoverage.packageVersionId = record.SubscriberPackageVersionId;
        packageCoverage.packageVersionNumber = `${record.MajorVersion}.${record.MinorVersion}.${record.PatchVersion}.${record.BuildNumber}`;
        output.push(packageCoverage);
      });

      SFPowerkit.log(
        `Successfully Retrieved the Apex Test Coverage of the package version`,
        LoggerLevel.INFO
      );
    } else {
      throw new Error(
        `Package version doesnot exist, Please check the version details`
      );
    }
    return output;
  }
  private async getWhereClause(
    versionId: string[],
    versionNumber: string,
    packageName: string
  ): Promise<string> {
    var whereClause = "";
    if (versionId && versionId.length > 0) {
      whereClause = this.buildWhereFilter(
        "SubscriberPackageVersionId",
        versionId
      );
    } else if (versionNumber && packageName) {
      whereClause =
        this.buildWhereOnNameOrId(
          "0Ho",
          "Package2Id",
          "Package2.Name",
          packageName
        ) +
        " AND " +
        this.buildVersionNumberFilter(versionNumber);
    }
    return whereClause;
  }
  // buid the where clause IN or = based on length
  private buildWhereFilter(key: string, value: string[]) {
    var result = "";
    if (value.length > 1) {
      result = `${key} IN ('${value.join("','")}')`;
    } else {
      result = `${key}  = '${value[0]}'`;
    }
    return result;
  }
  //build where clause based of id or name
  private buildWhereOnNameOrId(
    idFilter: string,
    idKey: string,
    nameKey: string,
    value: string
  ) {
    var result = "";
    if (value.startsWith(idFilter)) {
      result = `${idKey} = '${value}' `;
    } else {
      result = `${nameKey} = '${value}' `;
    }
    return result;
  }
  private buildVersionNumberFilter(versionNumber: string) {
    var result = "";
    let versionNumberList = versionNumber.split(".");
    if (versionNumberList.length === 4) {
      result = `MajorVersion = ${versionNumberList[0]} AND MinorVersion = ${versionNumberList[1]} AND PatchVersion = ${versionNumberList[2]} AND BuildNumber = ${versionNumberList[3]}`;
    } else {
      throw new Error(
        "Provide complete version number format in major.minor.patch (Beta build)—for example, 1.2.0.5"
      );
    }
    return result;
  }
}
interface PackageCoverage {
  coverage: number;
  packageName: string;
  packageId: string;
  packageVersionNumber: string;
  packageVersionId: string;
  HasPassedCodeCoverageCheck: boolean;
}
