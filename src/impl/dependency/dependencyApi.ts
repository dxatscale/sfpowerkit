import { core } from "@salesforce/command";
import { SFPowerkit, LoggerLevel } from "../../sfpowerkit";
import queryApi from "./queryApi";

export default class DependencyImpl {
  public static async getDependencyMapById(
    conn: core.Connection,
    refMetadata: string[]
  ) {
    let progressBar = SFPowerkit.createProgressBar(
      `Fetching dependency details `,
      ` metadata components`
    );
    progressBar.start(refMetadata.length);
    let dependencyMap: Map<string, string[]> = new Map<string, string[]>();
    let dependencyDetailsMap: Map<string, Metadata> = new Map<
      string,
      Metadata
    >();
    let filterOn = " RefMetadataComponentId ";

    if (refMetadata.length > 500) {
      for (let chunkrefMetadata of this.listReducer(500, refMetadata)) {
        const results = await this.fetchDependencies(
          conn,
          filterOn,
          chunkrefMetadata,
          dependencyMap,
          dependencyDetailsMap
        );
        if (results) {
          dependencyMap = results.dependencyMap;
          dependencyDetailsMap = results.dependencyDetailsMap;
        }
        progressBar.increment(chunkrefMetadata.length);
      }
    } else {
      const results = await this.fetchDependencies(
        conn,
        filterOn,
        refMetadata,
        dependencyMap,
        dependencyDetailsMap
      );
      if (results) {
        dependencyMap = results.dependencyMap;
        dependencyDetailsMap = results.dependencyDetailsMap;
      }
      progressBar.increment(refMetadata.length);
    }

    progressBar.stop();
    return {
      dependencyMap: dependencyMap,
      dependencyDetailsMap: dependencyDetailsMap
    };
  }

  public static async getDependencyMapByType(
    conn: core.Connection,
    refMetadata: string[]
  ) {
    let progressBar = SFPowerkit.createProgressBar(
      `Fetching dependency details `,
      ` metadata components`
    );
    progressBar.start(refMetadata.length);
    let dependencyMap: Map<string, string[]> = new Map<string, string[]>();
    let dependencyDetailsMap: Map<string, Metadata> = new Map<
      string,
      Metadata
    >();
    let filterOn = " RefMetadataComponentType ";

    if (refMetadata.length > 500) {
      for (let chunkrefMetadata of this.listReducer(500, refMetadata)) {
        const results = await this.fetchDependencies(
          conn,
          filterOn,
          chunkrefMetadata,
          dependencyMap,
          dependencyDetailsMap
        );
        if (results) {
          dependencyMap = results.dependencyMap;
          dependencyDetailsMap = results.dependencyDetailsMap;
        }
        progressBar.increment(chunkrefMetadata.length);
      }
    } else {
      const results = await this.fetchDependencies(
        conn,
        filterOn,
        refMetadata,
        dependencyMap,
        dependencyDetailsMap
      );
      if (results) {
        dependencyMap = results.dependencyMap;
        dependencyDetailsMap = results.dependencyDetailsMap;
      }
      progressBar.increment(refMetadata.length);
    }

    progressBar.stop();
    return {
      dependencyMap: dependencyMap,
      dependencyDetailsMap: dependencyDetailsMap
    };
  }

  private static async fetchDependencies(
    conn: core.Connection,
    filterOn: string,
    refMetadata: string[],
    dependencyMap: Map<string, string[]>,
    dependencyDetailsMap: Map<string, Metadata>
  ) {
    let query =
      `SELECT MetadataComponentId, MetadataComponentNamespace, MetadataComponentName, MetadataComponentType, RefMetadataComponentId, RefMetadataComponentNamespace, ` +
      `RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency where ${filterOn} IN ('` +
      refMetadata.join(`','`) +
      `') `;

    let queryUtil = new queryApi(conn);
    let result = await queryUtil.getQuery(query, true);
    let memberList: string[] = [];
    result.forEach(element => {
      memberList = dependencyMap.get(element.RefMetadataComponentId) || [];
      memberList.push(element.MetadataComponentId);
      dependencyMap.set(element.RefMetadataComponentId, memberList);

      dependencyDetailsMap.set(element.MetadataComponentId, {
        id: element.MetadataComponentId,
        fullName: element.MetadataComponentName,
        type: element.MetadataComponentType
      });
      dependencyDetailsMap.set(element.RefMetadataComponentId, {
        id: element.RefMetadataComponentId,
        fullName: element.RefMetadataComponentName,
        type: element.RefMetadataComponentType
      });
    });
    return {
      dependencyMap: dependencyMap,
      dependencyDetailsMap: dependencyDetailsMap
    };
  }

  public static async getMemberVsPackageMap(
    conn: core.Connection
  ): Promise<Map<string, string>> {
    let query =
      `SELECT CurrentPackageVersionId, MaxPackageVersionId, MinPackageVersionId, SubjectId, SubjectKeyPrefix, SubjectManageableState, SubscriberPackageId ` +
      `FROM Package2Member ORDER BY SubjectId `;

    let queryUtil = new queryApi(conn);
    let result = await queryUtil.getQuery(query, true);
    let packageMember: Map<string, string> = new Map<string, string>();
    if (result) {
      result.forEach(cmp => {
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

    let queryUtil = new queryApi(conn);
    let result = await queryUtil.getQuery(query, true);
    let packageMember: Map<string, string[]> = new Map<string, string[]>();
    let memberList: string[] = [];
    if (result) {
      result.forEach(cmp => {
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

    let queryUtil = new queryApi(conn);
    let result = await queryUtil.getQuery(query, true);

    let packageMember: string[] = [];
    if (result) {
      result.forEach(cmp => {
        packageMember.push(cmp.SubjectId);
      });
    }
    return packageMember;
  }

  public static async getForcePackageInstalledList(
    conn: core.Connection
  ): Promise<Map<string, PackageDetail>> {
    SFPowerkit.log(
      `Fetching Installed package details from the org`,
      LoggerLevel.INFO
    );
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
      SFPowerkit.log(
        `Found ${results.records.length} Installed packages from the org`,
        LoggerLevel.INFO
      );
    }
    return installedPackage;
  }

  public static listReducer(limit: number, list: any[]) {
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
export interface Metadata {
  id: string;
  fullName: string;
  type: string;
}
