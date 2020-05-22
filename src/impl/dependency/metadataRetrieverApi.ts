import { SfdxError, Connection } from "@salesforce/core";
import getDefaults from "../../utils/getDefaults";
import DependencyImpl from "./dependencyApi";
import { SFPowerkit, LoggerLevel } from "../../sfpowerkit";
export default class MetadataRetriever {
  private static unsupportedDescribeList = [
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

  public static async describeCall(
    conn: Connection
  ): Promise<Map<string, Metadata>> {
    let metadataMap: Map<string, Metadata> = new Map<string, Metadata>();
    let types = [];

    await conn.metadata
      .describe(getDefaults.getApiVersion())
      .then(result => {
        result.metadataObjects.forEach(metadata => {
          if (!this.unsupportedDescribeList.includes(metadata.xmlName)) {
            types.push({ type: metadata.xmlName });
          }
          if (metadata.childXmlNames) {
            for (let childMetadata of metadata.childXmlNames) {
              if (!this.unsupportedDescribeList.includes(childMetadata)) {
                types.push({ type: childMetadata });
              }
            }
          }
        });
      })
      .catch(err => {
        console.log(err);
      });

    let progressBar = SFPowerkit.createProgressBar(
      `Fetching describe details `,
      ` metdata types`
    );
    progressBar.start(types.length);
    if (types.length > 3) {
      for (let typesInChunk of DependencyImpl.listReducer(3, types)) {
        metadataMap = await this.metadataListCall(
          conn,
          typesInChunk,
          metadataMap
        );
        progressBar.increment(3);
      }
    } else {
      metadataMap = await this.metadataListCall(conn, types, metadataMap);
      progressBar.increment(types.length);
    }
    progressBar.stop();
    return metadataMap;
  }
  public static async metadataListCall(
    conn: Connection,
    types: any[],
    metadataMap: Map<string, Metadata>
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
  public static async describeCallList(
    conn: Connection,
    metadataTypes: string[]
  ): Promise<Map<string, Metadata>> {
    let metadataMap: Map<string, Metadata> = new Map<string, Metadata>();
    let types = [];

    metadataTypes.forEach(metadata => {
      if (!this.unsupportedDescribeList.includes(metadata)) {
        types.push({ type: metadata });
      }
    });

    let progressBar = SFPowerkit.createProgressBar(
      `Fetching describe details `,
      ` metdata types`
    );
    progressBar.start(types.length);
    if (types.length > 3) {
      for (let typesInChunk of DependencyImpl.listReducer(3, types)) {
        metadataMap = await this.metadataListCall(
          conn,
          typesInChunk,
          metadataMap
        );
        progressBar.increment(3);
      }
    } else {
      metadataMap = await this.metadataListCall(conn, types, metadataMap);
      progressBar.increment(types.length);
    }
    progressBar.stop();
    return metadataMap;
  }
}
export interface Metadata {
  id: string;
  fullName: string;
  type: string;
}
