import { Connection } from "jsforce";

let retry = require("async-retry");

export async function getInstalledPackages(
  conn: Connection,
  fetchLicenses: boolean
): Promise<PackageDetail[]> {
  let packageDetails = [];

  let installedPackagesQuery =
    "SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, " +
    "SubscriberPackageVersion.Id, SubscriberPackageVersion.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, " +
    "SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber FROM InstalledSubscriberPackage " +
    "ORDER BY SubscriberPackageId";

  let packageNamespacePrefixList = [];

  return await retry(
    async bail => {
      let results = await conn.tooling.query(installedPackagesQuery);
      const records = results.records;

      if (records && records.length > 0) {
        records.forEach(record => {
          const packageDetail = {} as PackageDetail;
          packageDetail.packageName = record["SubscriberPackage"]["Name"];
          packageDetail.subcriberPackageId = record["SubscriberPackageId"];
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

      if (fetchLicenses) {
        let licenseMap = new Map();
        if (packageNamespacePrefixList.length > 0) {
          let packageLicensingQuery = `SELECT AllowedLicenses, UsedLicenses,ExpirationDate, NamespacePrefix, IsProvisioned, Status FROM PackageLicense  WHERE NamespacePrefix IN (${packageNamespacePrefixList})`;
          await conn.query(packageLicensingQuery).then(queryResult => {
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

        if (packageDetails.length > 0 && licenseMap.size > 0) {
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
      }

      return packageDetails;
    },
    { retries: 3, minTimeout: 3000 }
  );
}

export interface PackageDetail {
  packageName: string;
  subcriberPackageId: string;
  packageNamespacePrefix: string;
  packageVersionNumber: string;
  packageVersionId: string;
  allowedLicenses: number;
  usedLicenses: number;
  expirationDate: string;
  status: string;
}
