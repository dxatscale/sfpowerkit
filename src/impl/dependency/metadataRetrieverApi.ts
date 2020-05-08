import { SfdxError, Connection } from "@salesforce/core";
import getDefaults from "../../utils/getDefaults";
import dependencyApi from "./dependencyApi";
import cli from "cli-ux";
export default class metadataRetrieverApi {
  private static metadataMap: Map<string, Metadata>;
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
    ,
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
    this.metadataMap = new Map<string, Metadata>();
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

    let progressBar = cli.progress({
      format: `Fetching describe details - PROGRESS  | {bar} | {value}/{total} metdata types`,
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      linewrap: true
    });
    progressBar.start(types.length);
    if (types.length > 3) {
      for (let typesInChunk of dependencyApi.listReducer(3, types)) {
        await this.metadataListCall(conn, typesInChunk);
        progressBar.increment(3);
      }
    } else {
      await this.metadataListCall(conn, types);
    }
    progressBar.stop();
    return this.metadataMap;
  }
  public static async metadataListCall(conn: Connection, types: any[]) {
    await conn.metadata
      .list(types, getDefaults.getApiVersion())
      .then(result => {
        if (result) {
          result.forEach(item => {
            this.metadataMap.set(item.id, {
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
  }
}
export interface Metadata {
  id: string;
  fullName: string;
  type: string;
}
