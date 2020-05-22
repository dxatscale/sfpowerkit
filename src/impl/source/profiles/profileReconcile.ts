import { SFPowerkit } from "../../../sfpowerkit";
import MetadataFiles from "../../metadata/metadataFiles";
import * as fs from "fs-extra";
import * as path from "path";
import * as xml2js from "xml2js";
import { METADATA_INFO } from "../../metadata/metadataInfo";
import CustomApplicationRetriever from "../../../impl/metadata/retriever/customApplicationRetriever";
import ApexClassRetriever from "../../../impl/metadata/retriever/apexClassRetriever";
import FieldRetriever from "../../../impl/metadata/retriever/fieldRetriever";
import LayoutRetriever from "../../../impl/metadata/retriever/layoutRetriever";
import RecordTypeRetriever from "../../../impl/metadata/retriever/recordTypeRetriever";
import EntityDefinitionRetriever from "../../../impl/metadata/retriever/entityDefinitionRetriever";
import ApexPageRetriever from "../../../impl/metadata/retriever/apexPageRetriever";
import TabDefinitionRetriever from "../../../impl/metadata/retriever/tabDefinitionRetriever";
import UserLicenseRetriever from "../../../impl/metadata/retriever/userLicenseRetriever";
import UserPermissionBuilder from "../../../impl/metadata/builder/userPermissionBuilder";
import Profile, { ProfileFieldLevelSecurity } from "../../metadata/schema";
import * as util from "util";
import * as _ from "lodash";
import ProfileActions from "./profileActions";
import FileUtils from "../../../utils/fileutils";
import ProfileWriter from "../../../impl/metadata/writer/profileWriter";
import { LoggerLevel } from "@salesforce/core";
import ExternalDataSourceRetriever from "../../../impl/metadata/retriever/externalDataSourceRetriever";
import FlowRetriever from "../../../impl/metadata/retriever/flowRetriever";
import CustomPermissionRetriever from "../../../impl/metadata/retriever/customPermissionRetriever";

const nonArayProperties = [
  "custom",
  "description",
  "fullName",
  "userLicense",
  "$"
];

export default class ProfileReconcile extends ProfileActions {
  metadataFiles: MetadataFiles;

  public async reconcile(
    srcFolders: string[],
    profileList: string[],
    destFolder: string
  ): Promise<string[]> {
    if (!_.isNil(destFolder)) {
      FileUtils.mkDirByPathSync(destFolder);
    }

    if (_.isNil(srcFolders) || srcFolders.length === 0) {
      srcFolders = await SFPowerkit.getProjectDirectories();
    }

    let result: string[] = [];
    this.metadataFiles = new MetadataFiles();
    srcFolders.forEach(srcFolder => {
      let normalizedPath = path.join(process.cwd(), srcFolder);
      this.metadataFiles.loadComponents(normalizedPath);
    });

    profileList = profileList.map(element => {
      return element + METADATA_INFO.Profile.sourceExtension;
    });

    if (!MetadataFiles.sourceOnly) {
      await this.profileRetriever.loadSupportedPermissions();
    }
    for (let count = 0; count < METADATA_INFO.Profile.files.length; count++) {
      let profileComponent = METADATA_INFO.Profile.files[count];
      if (
        profileList.length == 0 ||
        profileList.includes(path.basename(profileComponent))
      ) {
        SFPowerkit.log(
          "Reconciling profile " + path.basename(profileComponent),
          LoggerLevel.INFO
        );

        let profileXmlString = fs.readFileSync(profileComponent);
        const parser = new xml2js.Parser({ explicitArray: true });
        const parseString = util.promisify(parser.parseString);
        let parseResult = await parseString(profileXmlString);
        let profileWriter = new ProfileWriter();

        let profileObj: Profile = profileWriter.toProfile(parseResult.Profile); // as Profile

        profileObj = await this.removePermissions(profileObj);

        if (!MetadataFiles.sourceOnly) {
          //Manage licences
          let licenceUtils = UserLicenseRetriever.getInstance(this.org);
          const isSupportedLicence = await licenceUtils.userLicenseExists(
            profileObj.userLicense
          );
          if (!isSupportedLicence) {
            delete profileObj.userLicense;
          }
        }

        // remove unsupported userPermission
        let unsupportedLicencePermissions = this.profileRetriever.getUnsupportedLicencePermissions(
          profileObj.userLicense
        );
        if (
          profileObj.userPermissions != null &&
          profileObj.userPermissions.length > 0
        ) {
          profileObj.userPermissions = profileObj.userPermissions.filter(
            permission => {
              let supported = !unsupportedLicencePermissions.includes(
                permission.name
              );
              return supported;
            }
          );
        }

        //IS sourceonly, use ignorePermission set in sfdxProject.json file
        if (MetadataFiles.sourceOnly) {
          let pluginConfig = await SFPowerkit.getConfig();
          let ignorePermissions = pluginConfig.ignoredPermissions || [];
          if (
            profileObj.userPermissions !== undefined &&
            profileObj.userPermissions.length > 0
          ) {
            profileObj.userPermissions = profileObj.userPermissions.filter(
              permission => {
                let supported = !ignorePermissions.includes(permission.name);
                return supported;
              }
            );
          }
        } else {
          if (
            profileObj.userPermissions !== undefined &&
            profileObj.userPermissions.length > 0
          ) {
            //Remove permission that are not present in the target org
            profileObj.userPermissions = profileObj.userPermissions.filter(
              permission => {
                let supported = this.profileRetriever.supportedPermissions.includes(
                  permission.name
                );
                return supported;
              }
            );
          }
        }

        //UserPermissionUtils.addPermissionDependencies(profileObj);

        let isCustom = "" + profileObj.custom;
        if (isCustom == "false") {
          delete profileObj.userPermissions;
        }

        //this.handleViewAllDataPermission(profileObj);
        //this.handleInstallPackagingPermission(profileObj);
        //this.handleQueryAllFilesPermission(profileObj);

        UserPermissionBuilder.handlePermissionDependency(
          profileObj,
          this.profileRetriever.supportedPermissions
        );

        //Delete eampty arrays
        for (let key in profileObj) {
          if (Array.isArray(profileObj[key])) {
            //All top element must be arays exept non arrayProperties
            if (
              !nonArayProperties.includes(key) &&
              profileObj[key].length === 0
            ) {
              delete profileObj[key];
            }
          }
        }

        let builder = new xml2js.Builder({ rootName: "Profile" });
        let xml = builder.buildObject(profileObj);
        let outputFile = profileComponent;
        if (!_.isNil(destFolder)) {
          outputFile = path.join(destFolder, path.basename(profileComponent));
        }
        fs.writeFileSync(outputFile, xml);

        result.push(outputFile);
      }
    }
    return result;
  }

  private async reconcileApp(profileObj: Profile): Promise<Profile> {
    let utils = CustomApplicationRetriever.getInstance(this.org);
    if (profileObj.applicationVisibilities !== undefined) {
      let validArray = [];
      for (let i = 0; i < profileObj.applicationVisibilities.length; i++) {
        let cmpObj = profileObj.applicationVisibilities[i];
        let exist = await utils.appExists(cmpObj.application);
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Application Visiblitilties reduced from ${profileObj.applicationVisibilities.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.applicationVisibilities = validArray;
    }

    return profileObj;
  }

  private async reconcileClasses(profileObj: Profile): Promise<Profile> {
    let utils = ApexClassRetriever.getInstance(this.org);

    if (profileObj.classAccesses !== undefined) {
      if (!Array.isArray(profileObj.classAccesses)) {
        profileObj.classAccesses = [profileObj.classAccesses];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.classAccesses.length; i++) {
        let cmpObj = profileObj.classAccesses[i];
        let exists = await utils.classExists(cmpObj.apexClass);
        if (exists) {
          validArray.push(cmpObj);
        }
      }

      SFPowerkit.log(
        `Class Access reduced from ${profileObj.classAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.classAccesses = validArray;
    }

    return profileObj;
  }

  private async reconcileFields(profileObj: Profile): Promise<Profile> {
    let utils = FieldRetriever.getInstance(this.org);
    if (profileObj.fieldLevelSecurities !== undefined) {
      if (!Array.isArray(profileObj.fieldLevelSecurities)) {
        profileObj.fieldLevelSecurities = [profileObj.fieldLevelSecurities];
      }
      let validArray: ProfileFieldLevelSecurity[] = [];
      for (let i = 0; i < profileObj.fieldLevelSecurities.length; i++) {
        let cmpObj = profileObj.fieldLevelSecurities[i];
        let exists = await utils.fieldExist(cmpObj.field);
        if (exists) {
          validArray.push(cmpObj);
        }
      }

      SFPowerkit.log(
        `Fields Level Security reduced from ${profileObj.fieldLevelSecurities.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.fieldLevelSecurities = validArray;
    }

    if (profileObj.fieldPermissions !== undefined) {
      if (!Array.isArray(profileObj.fieldPermissions)) {
        profileObj.fieldPermissions = [profileObj.fieldPermissions];
      }
      let validArray: ProfileFieldLevelSecurity[] = [];
      for (let i = 0; i < profileObj.fieldPermissions.length; i++) {
        let cmpObj = profileObj.fieldPermissions[i];
        let exists = await utils.fieldExist(cmpObj.field);
        if (exists) {
          validArray.push(cmpObj);
        }
      }
      profileObj.fieldPermissions = validArray;
    }

    return profileObj;
  }

  private async reconcileLayouts(profileObj: Profile): Promise<Profile> {
    let utils = LayoutRetriever.getInstance(this.org);
    let rtUtils = RecordTypeRetriever.getInstance(this.org);

    if (profileObj.layoutAssignments !== undefined) {
      var validArray = [];
      for (
        let count = 0;
        count < profileObj.layoutAssignments.length;
        count++
      ) {
        let cmpObj = profileObj.layoutAssignments[count];
        let exist =
          (await utils.layoutExists(cmpObj.layout)) &&
          (_.isNil(cmpObj.recordType) ||
            (await rtUtils.recordTypeExists(cmpObj.recordType)));
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Layout Assignnments reduced from ${profileObj.layoutAssignments.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.layoutAssignments = validArray;
    }
    return profileObj;
  }

  private async reconcileObjects(profileObj: Profile): Promise<Profile> {
    let utils = EntityDefinitionRetriever.getInstance(this.org);

    if (profileObj.objectPermissions !== undefined) {
      if (!Array.isArray(profileObj.objectPermissions)) {
        profileObj.objectPermissions = [profileObj.objectPermissions];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.objectPermissions.length; i++) {
        let cmpObj = profileObj.objectPermissions[i];
        let exist = await utils.existObjectPermission(cmpObj.object);
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Object Permissions reduced from ${profileObj.objectPermissions.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.objectPermissions = validArray;
    }
    return profileObj;
  }

  private async reconcileCustomMetadata(profileObj: Profile): Promise<Profile> {
    let utils = EntityDefinitionRetriever.getInstance(this.org);

    if (profileObj.customMetadataTypeAccesses !== undefined) {
      if (!Array.isArray(profileObj.customMetadataTypeAccesses)) {
        profileObj.customMetadataTypeAccesses = [
          profileObj.customMetadataTypeAccesses
        ];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.customMetadataTypeAccesses.length; i++) {
        let cmpCM = profileObj.customMetadataTypeAccesses[i];
        let exist = await utils.existCustomMetadata(cmpCM.name);
        if (exist) {
          validArray.push(cmpCM);
        }
      }
      SFPowerkit.log(
        `CustomMetadata Access reduced from ${profileObj.customMetadataTypeAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.customMetadataTypeAccesses = validArray;
    }
    return profileObj;
  }

  private async reconcileCustomSettins(profileObj: Profile): Promise<Profile> {
    let utils = EntityDefinitionRetriever.getInstance(this.org);

    if (profileObj.customSettingAccesses !== undefined) {
      if (!Array.isArray(profileObj.customSettingAccesses)) {
        profileObj.customSettingAccesses = [profileObj.customSettingAccesses];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.customSettingAccesses.length; i++) {
        let cmpCS = profileObj.customSettingAccesses[i];
        let exist = await utils.existCustomMetadata(cmpCS.name);
        if (exist) {
          validArray.push(cmpCS);
        }
      }
      SFPowerkit.log(
        `CustomSettings Access reduced from ${profileObj.customSettingAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.customSettingAccesses = validArray;
    }
    return profileObj;
  }

  private async reconcileExternalDataSource(
    profileObj: Profile
  ): Promise<Profile> {
    let utils = ExternalDataSourceRetriever.getInstance(this.org);

    if (profileObj.externalDataSourceAccesses !== undefined) {
      if (!Array.isArray(profileObj.externalDataSourceAccesses)) {
        profileObj.externalDataSourceAccesses = [
          profileObj.externalDataSourceAccesses
        ];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.externalDataSourceAccesses.length; i++) {
        let dts = profileObj.externalDataSourceAccesses[i];
        let exist = await utils.externalDataSourceExists(
          dts.externalDataSource
        );
        if (exist) {
          validArray.push(dts);
        }
      }
      SFPowerkit.log(
        `ExternalDataSource Access reduced from ${profileObj.externalDataSourceAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.externalDataSourceAccesses = validArray;
    }
    return profileObj;
  }

  private async reconcileFlow(profileObj: Profile): Promise<Profile> {
    let utils = FlowRetriever.getInstance(this.org);

    if (profileObj.flowAccesses !== undefined) {
      if (!Array.isArray(profileObj.flowAccesses)) {
        profileObj.flowAccesses = [profileObj.flowAccesses];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.flowAccesses.length; i++) {
        let flow = profileObj.flowAccesses[i];
        let exist = await utils.flowExists(flow.flow);
        if (exist) {
          validArray.push(flow);
        }
      }
      SFPowerkit.log(
        `Flow Access reduced from ${profileObj.flowAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.flowAccesses = validArray;
    }
    return profileObj;
  }

  private async reconcileCustomPermission(
    profileObj: Profile
  ): Promise<Profile> {
    let utils = CustomPermissionRetriever.getInstance(this.org);

    if (profileObj.customPermissions !== undefined) {
      if (!Array.isArray(profileObj.customPermissions)) {
        profileObj.customPermissions = [profileObj.customPermissions];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.customPermissions.length; i++) {
        let customPermission = profileObj.customPermissions[i];
        let exist = await utils.customPermissionExists(customPermission.name);
        if (exist) {
          validArray.push(customPermission);
        }
      }
      SFPowerkit.log(
        `CustomPermission reduced from ${profileObj.customPermissions.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.customPermissions = validArray;
    }
    return profileObj;
  }

  private async reconcilePages(profileObj: Profile): Promise<Profile> {
    let utils = ApexPageRetriever.getInstance(this.org);
    if (profileObj.pageAccesses !== undefined) {
      if (!Array.isArray(profileObj.pageAccesses)) {
        profileObj.pageAccesses = [profileObj.pageAccesses];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.pageAccesses.length; i++) {
        let cmpObj = profileObj.pageAccesses[i];
        let exist = await utils.pageExists(cmpObj.apexPage);
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Page Access Permissions reduced from ${profileObj.pageAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.pageAccesses = validArray;
    }
    return profileObj;
  }

  private async reconcileRecordTypes(profileObj: Profile): Promise<Profile> {
    let utils = RecordTypeRetriever.getInstance(this.org);

    if (profileObj.recordTypeVisibilities !== undefined) {
      if (!Array.isArray(profileObj.recordTypeVisibilities)) {
        profileObj.recordTypeVisibilities = [profileObj.recordTypeVisibilities];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.recordTypeVisibilities.length; i++) {
        let cmpObj = profileObj.recordTypeVisibilities[i];
        let exist = await utils.recordTypeExists(cmpObj.recordType);
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Record Type Visibilities reduced from ${profileObj.recordTypeVisibilities.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.recordTypeVisibilities = validArray;
    }
    return profileObj;
  }

  private async reconcileTabs(profileObj: Profile): Promise<Profile> {
    let utils = TabDefinitionRetriever.getInstance(this.org);

    if (profileObj.tabVisibilities !== undefined) {
      if (!Array.isArray(profileObj.tabVisibilities)) {
        profileObj.tabVisibilities = [profileObj.tabVisibilities];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.tabVisibilities.length; i++) {
        let cmpObj = profileObj.tabVisibilities[i];
        let exist = await utils.tabExists(cmpObj.tab);
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Tab Visibilities reduced from ${profileObj.tabVisibilities.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.tabVisibilities = validArray;
    }
    return profileObj;
  }

  private async removePermissions(profileObj: Profile): Promise<Profile> {
    SFPowerkit.log("Reconciling App", LoggerLevel.DEBUG);
    profileObj = await this.reconcileApp(profileObj);
    SFPowerkit.log("Reconciling Classes", LoggerLevel.DEBUG);
    profileObj = await this.reconcileClasses(profileObj);
    SFPowerkit.log("Reconciling Fields", LoggerLevel.DEBUG);
    profileObj = await this.reconcileFields(profileObj);
    SFPowerkit.log("Reconciling Objects", LoggerLevel.DEBUG);
    profileObj = await this.reconcileObjects(profileObj);
    SFPowerkit.log("Reconciling Pages", LoggerLevel.DEBUG);
    profileObj = await this.reconcilePages(profileObj);
    SFPowerkit.log("Reconciling Layouts", LoggerLevel.DEBUG);
    profileObj = await this.reconcileLayouts(profileObj);
    SFPowerkit.log("Reconciling Record Types", LoggerLevel.DEBUG);
    profileObj = await this.reconcileRecordTypes(profileObj);
    SFPowerkit.log("Reconciling  Tabs", LoggerLevel.DEBUG);
    profileObj = await this.reconcileTabs(profileObj);
    SFPowerkit.log("Reconciling  ExternalDataSources", LoggerLevel.DEBUG);
    profileObj = await this.reconcileExternalDataSource(profileObj);
    SFPowerkit.log("Reconciling  CustomPermissions", LoggerLevel.DEBUG);
    profileObj = await this.reconcileCustomPermission(profileObj);
    SFPowerkit.log("Reconciling  CustomMetadata", LoggerLevel.DEBUG);
    profileObj = await this.reconcileCustomMetadata(profileObj);
    SFPowerkit.log("Reconciling  CustomSettings", LoggerLevel.DEBUG);
    profileObj = await this.reconcileCustomSettins(profileObj);
    SFPowerkit.log("Reconciling  Flow", LoggerLevel.DEBUG);
    profileObj = await this.reconcileFlow(profileObj);
    return profileObj;
  }
}
