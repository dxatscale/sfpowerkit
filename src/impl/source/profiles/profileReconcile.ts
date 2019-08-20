import { SFPowerkit } from "../../../sfpowerkit";
import MetadataFiles from "../../metadata/metadataFiles";
import * as fs from "fs";
import * as path from "path";
import xml2js = require("xml2js");
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
import util = require("util");
import _ from "lodash";
import ProfileActions from "./profileActions";
import FileUtils from "../../../utils/fileutils";
import ProfileWriter from "../../../impl/metadata/writer/profileWriter";

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
        SFPowerkit.ux.log(
          "Reconciling profile " + path.basename(profileComponent)
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
      profileObj.objectPermissions = validArray;
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
      profileObj.tabVisibilities = validArray;
    }
    return profileObj;
  }

  private async removePermissions(profileObj: Profile): Promise<Profile> {
    profileObj = await this.reconcileApp(profileObj);
    profileObj = await this.reconcileClasses(profileObj);
    profileObj = await this.reconcileFields(profileObj);
    profileObj = await this.reconcileObjects(profileObj);
    profileObj = await this.reconcilePages(profileObj);
    profileObj = await this.reconcileLayouts(profileObj);
    profileObj = await this.reconcileRecordTypes(profileObj);
    profileObj = await this.reconcileTabs(profileObj);
    return profileObj;
  }
}
