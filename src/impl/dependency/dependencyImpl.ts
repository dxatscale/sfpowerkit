import { core } from "@salesforce/command";
import { SFPowerkit, LoggerLevel } from "../../sfpowerkit";
import queryApi from "../../utils/queryExecutor";
import { chunkArray } from "../../utils/chunkArray";
import { MetadataSummary } from "../metadata/retriever/metadataSummaryInfoFetcher";
import { ProgressBar } from "../../ui/progressBar";

export default class DependencyImpl {
  public static async getDependencyMapById(
    conn: core.Connection,
    refMetadata: string[]
  ) {
    let progressBar = new ProgressBar().create(
      `Fetching dependency details `,
      ` metadata components`,
      LoggerLevel.INFO
    );

    progressBar.start(refMetadata.length);

    let dependencyMap: Map<string, string[]> = new Map<string, string[]>();
    let dependencyDetailsMap: Map<string, MetadataSummary> = new Map<
      string,
      MetadataSummary
    >();
    let filterOn = " RefMetadataComponentId ";

    for (let chunkrefMetadata of chunkArray(500, refMetadata)) {
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
    let progressBar = new ProgressBar().create(
      `Fetching dependency details `,
      ` metadata components`,
      LoggerLevel.INFO
    );
    progressBar.start(refMetadata.length);
    let dependencyMap: Map<string, string[]> = new Map<string, string[]>();
    let dependencyDetailsMap: Map<string, MetadataSummary> = new Map<
      string,
      MetadataSummary
    >();
    let filterOn = " RefMetadataComponentType ";

    if (refMetadata.length > 500) {
      for (let chunkrefMetadata of chunkArray(500, refMetadata)) {
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
    dependencyDetailsMap: Map<string, MetadataSummary>
  ) {
    let query =
      `SELECT MetadataComponentId, MetadataComponentNamespace, MetadataComponentName, MetadataComponentType, RefMetadataComponentId, RefMetadataComponentNamespace, ` +
      `RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency where ${filterOn} IN ('` +
      refMetadata.join(`','`) +
      `') `;

    let queryUtil = new queryApi(conn);
    let result = await queryUtil.executeQuery(query, true);
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
    let result = await queryUtil.executeQuery(query, true);
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
    let result = await queryUtil.executeQuery(query, true);
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
    let result = await queryUtil.executeQuery(query, true);

    let packageMember: string[] = [];
    if (result) {
      result.forEach(cmp => {
        packageMember.push(cmp.SubjectId);
      });
    }
    return packageMember;
  }
}
