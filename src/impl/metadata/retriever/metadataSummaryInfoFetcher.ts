import { SfdxError, Connection } from "@salesforce/core";
import getDefaults from "../../../utils/getDefaults";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import { DescribeMetadataResult } from "jsforce";
import { chunkArray } from "../../../utils/chunkArray";

export default class MetadataSummaryInfoFetcher {
  private static NotSupportedTypes = [
    "AccountForecastSettings",
    "Icon",
    "EmbeddedServiceConfig",
    "UIObjectRelationConfig",
    "CareProviderSearchConfig",
    "EmbeddedServiceBranding",
    "EmbeddedServiceFlowConfig",
    "EmbeddedServiceMenuSettings",
    "SalesAgreementSettings",
    "ActionLinkGroupTemplate",
    "TransactionSecurityPolicy",
    "SynonymDictionary",
    "RecommendationStrategy",
    "UserCriteria",
    "ModerationRule",
    "CMSConnectSource",
    "FlowCategory",
    "Settings",
    "PlatformCachePartition",
    "LightningBolt",
    "LightningExperienceTheme",
    "LightningOnboardingConfig",
    "CorsWhitelistOrigin",
    "CustomHelpMenuSection",
    "Prompt",
    "Report",
    "Dashboard",
    "AnalyticSnapshot",
    "Role",
    "Group",
    "Community",
    "ChatterExtension",
    "PlatformEventChannel",
    "CommunityThemeDefinition",
    "CommunityTemplateDefinition",
    "NavigationMenu",
    "ManagedTopics",
    "ManagedTopic",
    "KeywordList",
    "InstalledPackage",
    "Scontrol",
    "Certificate",
    "LightningMessageChannel",
    "CaseSubjectParticle",
    "ExternalDataSource",
    "ExternalServiceRegistration",
    "Index",
    "CustomFeedFilter",
    "PostTemplate",
    "ProfilePasswordPolicy",
    "ProfileSessionSetting",
    "MyDomainDiscoverableLogin",
    "OauthCustomScope",
    "DataCategoryGroup",
    "RemoteSiteSetting",
    "CspTrustedSite",
    "RedirectWhitelistUrl",
    "CleanDataService",
    "Skill",
    "ServiceChannel",
    "QueueRoutingConfig",
    "ServicePresenceStatus",
    "PresenceDeclineReason",
    "PresenceUserConfig",
    "EclairGeoData",
    "ChannelLayout",
    "CallCenter",
    "TimeSheetTemplate",
    "CanvasMetadata",
    "MobileApplicationDetail",
    "CustomNotificationType",
    "NotificationTypeConfig",
    "DelegateGroup",
    "ManagedContentType",
    "SamlSsoConfig"
  ];

  public static async fetchMetadataSummaryFromAnOrg(
    conn: Connection,
    isDisplayProgressBar: boolean = false,
    filterTypes: string[] = MetadataSummaryInfoFetcher.NotSupportedTypes
  ): Promise<Map<string, MetadataSummary>> {
    let metadataMap: Map<string, MetadataSummary> = new Map<
      string,
      MetadataSummary
    >();
    let types = [];

    let result: DescribeMetadataResult = await conn.metadata.describe(
      getDefaults.getApiVersion()
    );

    result.metadataObjects.forEach(metadata => {
      //Not supported .. ignore
      if (!this.NotSupportedTypes.includes(metadata.xmlName)) {
        types.push({ type: metadata.xmlName });
      }

      //Has childs.. check for each child and add to the list
      if (metadata.childXmlNames) {
        for (let childMetadata of metadata.childXmlNames) {
          if (!this.NotSupportedTypes.includes(childMetadata)) {
            types.push({ type: childMetadata });
          }
        }
      }
    });

    let progressBar = SFPowerkit.createProgressBar(
      `Fetching describe details `,
      ` metdata types`
    );
    progressBar.start(types.length);

    //Fetch Summary Info in chunks of three
    for (let typesInChunk of chunkArray(3, types)) {
      metadataMap = await this.fetchMetadataSummaryByTypesFromAnOrg(
        conn,
        typesInChunk,
        metadataMap
      );
      progressBar.increment(3);
    }

    progressBar.stop();
    return metadataMap;
  }

  private static async fetchMetadataSummaryByTypesFromAnOrg(
    conn: Connection,
    types: any[],
    metadataMap: Map<string, MetadataSummary>
  ) {
    await conn.metadata
      .list(types, getDefaults.getApiVersion())
      .then(result => {
        if (result) {
          result.forEach(item => {
            metadataMap.set(item.id, {
              id: item.id,
              fullName: item.fullName,
              type: item.type
            });
          });
        } else {
          throw new SfdxError(
            "unSupported metadata for describe call" + JSON.stringify(types)
          );
        }
      })
      .catch(err => {
        throw new SfdxError(
          "unSupported metadata for describe call" + JSON.stringify(types)
        );
      });
    return metadataMap;
  }
}
export interface MetadataSummary {
  id: string;
  fullName: string;
  type: string;
}
