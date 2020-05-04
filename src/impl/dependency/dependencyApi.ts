import { core } from "@salesforce/command";
import { SfdxError } from "@salesforce/core";
export default class dependencyApi {
  public static async getdependencyMap(
    conn: core.Connection,
    refMetadata: string[]
  ): Promise<Map<string, string[]>> {
    let dependencies = [];
    if (refMetadata.length > 500) {
      for (let chunkrefMetadata of this.listreducer(500, refMetadata)) {
        console.log("chunkrefMetadata", chunkrefMetadata.length);
        const results = await this.fetchDependencies(conn, chunkrefMetadata);
        if (results.records) {
          dependencies = dependencies.concat(results.records);
        }
      }
    } else {
      const results = await this.fetchDependencies(conn, refMetadata);
      if (results.records) {
        dependencies = results.records;
      }
    }
    let dependencyMap: Map<string, string[]> = new Map<string, string[]>();
    let memberList: string[] = [];
    if (dependencies.length > 0) {
      dependencies.forEach(dependency => {
        memberList = dependencyMap.get(dependency.RefMetadataComponentId) || [];
        memberList.push(dependency.MetadataComponentId);
        dependencyMap.set(dependency.RefMetadataComponentId, memberList);
      });
    } else {
      throw new SfdxError(`Unable to find any dependencies in org.`);
    }
    return dependencyMap;
  }
  private static async fetchDependencies(
    conn: core.Connection,
    refMetadata: string[]
  ) {
    let query =
      `SELECT MetadataComponentId, MetadataComponentNamespace, MetadataComponentName, MetadataComponentType, RefMetadataComponentId, RefMetadataComponentNamespace, ` +
      `RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency where RefMetadataComponentId IN ('` +
      refMetadata.join(`','`) +
      `') `;

    let result = (await conn.tooling.query(query)) as any;
    if (!result.done) {
      let tempRecords = result.records;
      while (!result.done) {
        result = await this.queryMore(conn, result.nextRecordsUrl, true);
        tempRecords = tempRecords.concat(result.records);
      }
      result.records = tempRecords;
    }
    return result;
  }

  public static async getMemberVsPackageMap(
    conn: core.Connection
  ): Promise<Map<string, string>> {
    let query =
      `SELECT CurrentPackageVersionId, MaxPackageVersionId, MinPackageVersionId, SubjectId, SubjectKeyPrefix, SubjectManageableState, SubscriberPackageId ` +
      `FROM Package2Member ORDER BY SubjectId `;

    let results = (await conn.tooling.query(query)) as any;
    if (!results.done) {
      let tempRecords = results.records;
      while (!results.done) {
        results = await this.queryMore(conn, results.nextRecordsUrl, true);
        tempRecords = tempRecords.concat(results.records);
      }
      results.records = tempRecords;
    }

    let packageMember: Map<string, string> = new Map<string, string>();
    if (results.records) {
      results.records.forEach(cmp => {
        packageMember.set(cmp.SubjectId, cmp.SubscriberPackageId);
      });
    }
    return packageMember;
  }

  public static async getPackageVsMemberMap(
    conn: core.Connection
  ): Promise<Map<string, string[]>> {
    let query =
      `SELECT CurrentPackageVersionId, MaxPackageVersionId, MinPackageVersionId, SubjectId, SubjectKeyPrefix, SubjectManageableState, SubscriberPackageId ` +
      `FROM Package2Member ORDER BY SubjectId `;

    let result = (await conn.tooling.query(query)) as any;
    if (!result.done) {
      let tempRecords = result.records;
      while (!result.done) {
        result = (await this.queryMore(
          conn,
          result.nextRecordsUrl,
          true
        )) as any;
        tempRecords = tempRecords.concat(result.records);
      }
      result.records = tempRecords;
    }

    let packageMember: Map<string, string[]> = new Map<string, string[]>();
    let memberList: string[] = [];
    if (result.records) {
      result.records.forEach(cmp => {
        memberList = packageMember.get(cmp.SubscriberPackageId) || [];
        memberList.push(cmp.SubjectId);
        packageMember.set(cmp.SubscriberPackageId, memberList);
      });
    }
    return packageMember;
  }

  public static async getMemberFromPackage(
    conn: core.Connection,
    packageId: string
  ): Promise<string[]> {
    let query =
      `SELECT CurrentPackageVersionId, MaxPackageVersionId, MinPackageVersionId, SubjectId, SubjectKeyPrefix, SubjectManageableState, SubscriberPackageId ` +
      `FROM Package2Member WHERE SubscriberPackageId = '${packageId}' ORDER BY SubjectId `;

    let result = (await conn.tooling.query(query)) as any;
    if (!result.done) {
      let tempRecords = result.records;
      while (!result.done) {
        result = (await this.queryMore(
          conn,
          result.nextRecordsUrl,
          true
        )) as any;
        tempRecords = tempRecords.concat(result.records);
      }
      result.records = tempRecords;
    }
    let packageMember: string[] = [];
    if (result.records) {
      result.records.forEach(cmp => {
        packageMember.push(cmp.SubjectId);
      });
    }
    return packageMember;
  }

  public static async getForcePackageInstalledList(
    conn: core.Connection
  ): Promise<Map<string, PackageDetail>> {
    let query =
      "SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, SubscriberPackageVersion.Id, SubscriberPackageVersion.Name, " +
      "SubscriberPackageVersion.MajorVersion,SubscriberPackageVersion.MinorVersion, SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber " +
      "FROM InstalledSubscriberPackage ORDER BY SubscriberPackageId";
    const results = (await conn.tooling.query(query)) as any;
    let installedPackage: Map<string, PackageDetail> = new Map<
      string,
      PackageDetail
    >();
    if (results.records) {
      results.records.forEach(pkg => {
        installedPackage.set(pkg.SubscriberPackageId, {
          Id: pkg.SubscriberPackageId,
          Path: null,
          Name: pkg.SubscriberPackage.Name,
          Namespace: pkg.SubscriberPackage.NamespacePrefix,
          VersionId: pkg.SubscriberPackageVersion.Id,
          VersionName: pkg.SubscriberPackageVersion.Name,
          VersionNumber:
            pkg.SubscriberPackageVersion.MajorVersion +
            "." +
            pkg.SubscriberPackageVersion.MinorVersion +
            "." +
            pkg.SubscriberPackageVersion.PatchVersion +
            "." +
            pkg.SubscriberPackageVersion.BuildNumber
        });
      });
    }
    return installedPackage;
  }
  private static listreducer(limit: number, list: any[]) {
    let result = [];
    let tempList = [];
    for (let i = 0; i < list.length; i++) {
      tempList.push(list[i]);
      if (tempList.length === limit) {
        //add chuncks as per limit
        result.push(tempList);
        tempList = [];
      } else if (i === list.length - 1) {
        //last chunck
        result.push(tempList);
      }
    }
    return result;
  }
  private static async queryMore(
    conn: core.Connection,
    url: string,
    tooling: boolean
  ) {
    let result;
    if (tooling) {
      result = await conn.tooling.queryMore(url);
    } else {
      result = await conn.queryMore(url);
    }
    return result;
  }
}
export interface PackageDetail {
  Id: string;
  Path: string;
  Name: string;
  Namespace: string;
  VersionId: string;
  VersionName: string;
  VersionNumber: string;
}
export interface MetadataMember {
  Id: string;
  Name: string;
  Namespace: string;
  Type: string;
}
