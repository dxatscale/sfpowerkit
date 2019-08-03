import FileUtils from "./fsutils";
import Profile, {
  RecordTypeVisibility,
  ApplicationVisibility,
  ProfileTabVisibility,
  ProfileFieldLevelSecurity,
  ProfileApexClassAccess,
  ProfileApexPageAccess,
  ProfileLayoutAssignments,
  ProfileObjectPermissions,
  ProfileUserPermission,
  PermissionSetSObject,
  ProfileCustomPermissions
} from "./schema";
import MetadataFiles from "../shared/metadataFiles";
import { Connection, Org } from "@salesforce/core";
import { MetadataInfo } from "jsforce";
import UserPermissionUtils from "./userPermissionUtils";

import * as fs from "fs";
import * as path from "path";
import xml2js = require("xml2js");
import { ProfileTooling } from "./schema";
import BaseUtils from "./baseUtils";
import { SfPowerKit } from "../sfpowerkit";
import { METADATA_INFO } from "../shared/metadataInfo";
import _ from "lodash";
import UserLicenceUtils from "./userLicenseUtils";
import AppUtils from "./appUtils";
import ClassUtils from "./classUtils";
import FieldUtils from "./fieldUtils";
import RecordTypeUtils from "./recordTypeUtils";
import TabUtils from "./tabUtils";
import PageUtils from "./pageUtils";
import LayoutUtils from "./layoutUtils";
import EntityDefinitionUtils from "./entityDefinitionUtils";
import util = require("util");

const unsuportedObjects = ["PersonAccount"];
/**
 *
 * Used to track Unsupported Userpermission per Licence
 * Update this list when Salesforce change supported permission per licence
 */
const userLicenceMap = [
  {
    name: "Guest User License",
    unsupportedPermissions: ["PasswordNeverExpires"]
  }
];

//const unsupportedprofiles = ["Guest License User", "Interface MFB", "Interface WL", "Premier Support User"];
const unsupportedprofiles = [];

const nonArayProperties = [
  "custom",
  "description",
  "fullName",
  "userLicense",
  "$"
];

const PROFILE_NAMESPACE = "http://soap.sforce.com/2006/04/metadata";

const QUERY = "SELECT Id, Name, UserType, Description From Profile";
export default class ProfileUtils extends BaseUtils<ProfileTooling> {
  static supportedMetadataTypes = [
    "ApexClass",
    "CustomApplication",
    "CustomObject",
    "CustomField",
    "Layout",
    "ApexPage",
    "CustomTab",
    "RecordType",
    "SystemPermissions"
  ];

  supportedPermissions: string[] = [];
  conn: Connection;

  metadataFiles: MetadataFiles;

  public constructor(public org: Org, private debugFlag?: boolean) {
    super(org);
    super.setQuery(QUERY);
    this.conn = this.org.getConnection();
  }

  public async loadSupportedPermissions() {
    if (this.supportedPermissions.length === 0) {
      this.supportedPermissions = await UserPermissionUtils.getSupportedPermissions(
        this.conn
      );
    }
  }

  /**
   * Merge two profile and make sure that profile 1 contains all config present in the profile 2
   * @param profile1
   * @param profile2
   */
  private async mergeProfile(
    profile1: Profile,
    profile2: Profile
  ): Promise<Profile> {
    if (profile2.applicationVisibilities !== undefined) {
      this.mergeApps(profile1, profile2.applicationVisibilities);
    }
    if (profile2.classAccesses !== undefined) {
      this.mergeClasses(profile1, profile2.classAccesses);
    }
    if (profile2.fieldPermissions !== undefined) {
      this.mergeFields(profile1, profile2.fieldPermissions);
    }
    if (profile2.layoutAssignments !== undefined) {
      this.mergeLayouts(profile1, profile2.layoutAssignments);
    }
    if (profile2.objectPermissions !== undefined) {
      this.mergeObjects(profile1, profile2.objectPermissions);
    }
    if (profile2.pageAccesses !== undefined) {
      this.mergePages(profile1, profile2.pageAccesses);
    }
    if (profile2.userPermissions !== undefined) {
      this.mergePermissions(profile1, profile2.userPermissions);
    }
    if (profile2.customPermissions !== undefined) {
      this.mergeCustomPermissions(profile1, profile2.customPermissions);
    }
    if (profile2.recordTypeVisibilities !== undefined) {
      this.mergeRecordTypes(profile1, profile2.recordTypeVisibilities);
    }
    if (profile2.tabVisibilities !== undefined) {
      this.mergeTabs(profile1, profile2.tabVisibilities);
    }

    if (profile2.loginHours !== undefined) {
      profile1.loginHours = profile2.loginHours;
    } else {
      delete profile1.loginHours;
    }
    if (profile2.loginIpRanges !== undefined) {
      profile1.loginIpRanges = profile2.loginIpRanges;
    } else {
      delete profile1.loginIpRanges;
    }

    return profile1;
  }

  private mergeApps(
    profileObj: Profile,
    applicationVisibilities: ApplicationVisibility[]
  ): Profile {
    if (
      profileObj.applicationVisibilities === null ||
      profileObj.applicationVisibilities === undefined
    ) {
      profileObj.applicationVisibilities = [];
    } else if (!Array.isArray(profileObj.applicationVisibilities)) {
      profileObj.applicationVisibilities = [profileObj.applicationVisibilities];
    }
    for (var i = 0; i < applicationVisibilities.length; i++) {
      let appVisibility = applicationVisibilities[i];
      let found = false;
      for (var j = 0; j < profileObj.applicationVisibilities.length; j++) {
        if (
          appVisibility.application ===
          profileObj.applicationVisibilities[j].application
        ) {
          profileObj.applicationVisibilities[j].default = appVisibility.default;
          profileObj.applicationVisibilities[j].visible = appVisibility.visible;
          found = true;
          break;
        }
      }
      if (!found) {
        profileObj.applicationVisibilities.push(appVisibility);
      }
    }

    profileObj.applicationVisibilities.sort((app1, app2) => {
      let order = 0;
      if (app1.application < app2.application) {
        order = -1;
      } else if (app1.application > app2.application) {
        order = 1;
      }
      return order;
    });

    return profileObj;
  }

  private mergeClasses(
    profileObj: Profile,
    classes: ProfileApexClassAccess[]
  ): Profile {
    if (
      profileObj.classAccesses === null ||
      profileObj.classAccesses === undefined
    ) {
      profileObj.classAccesses = [];
    } else if (!Array.isArray(profileObj.classAccesses)) {
      profileObj.classAccesses = [profileObj.classAccesses];
    }
    for (var i = 0; i < classes.length; i++) {
      let classAccess = classes[i];
      let found = false;
      for (var j = 0; j < profileObj.classAccesses.length; j++) {
        if (classAccess.apexClass === profileObj.classAccesses[j].apexClass) {
          profileObj.classAccesses[j].enabled = classAccess.enabled;
          found = true;
          break;
        }
      }
      if (!found) {
        profileObj.classAccesses.push(classAccess);
      }
    }

    profileObj.classAccesses.sort((class1, class2) => {
      let order = 0;
      if (class1.apexClass < class2.apexClass) {
        order = -1;
      } else if (class1.apexClass > class2.apexClass) {
        order = 1;
      }
      return order;
    });

    return profileObj;
  }

  private mergeFields(
    profileObj: Profile,
    fieldPermissions: ProfileFieldLevelSecurity[]
  ): Profile {
    if (
      profileObj.fieldPermissions === null ||
      profileObj.fieldPermissions === undefined
    ) {
      profileObj.fieldPermissions = [];
    } else if (!Array.isArray(profileObj.fieldPermissions)) {
      profileObj.fieldPermissions = [profileObj.fieldPermissions];
    }
    for (var i = 0; i < fieldPermissions.length; i++) {
      let fieldPermission = fieldPermissions[i];
      let found = false;
      for (var j = 0; j < profileObj.fieldPermissions.length; j++) {
        if (fieldPermission.field === profileObj.fieldPermissions[j].field) {
          profileObj.fieldPermissions[j].editable = fieldPermission.editable;
          if (
            fieldPermission.hidden !== undefined &&
            fieldPermission.hidden !== null
          ) {
            profileObj.fieldPermissions[j].hidden = fieldPermission.hidden;
          }
          profileObj.fieldPermissions[j].readable = fieldPermission.readable;
          found = true;
          break;
        }
      }
      if (!found) {
        profileObj.fieldPermissions.push(fieldPermission);
      }
    }

    profileObj.fieldPermissions.sort((field1, field2) => {
      let order = 0;
      if (field1.field < field2.field) {
        order = -1;
      } else if (field1.field > field2.field) {
        order = 1;
      }
      return order;
    });

    return profileObj;
  }

  private mergeLayouts(
    profileObj: Profile,
    layoutAssignments: ProfileLayoutAssignments[]
  ): Profile {
    if (
      profileObj.layoutAssignments === null ||
      profileObj.layoutAssignments === undefined
    ) {
      profileObj.layoutAssignments = [];
    } else if (!Array.isArray(profileObj.layoutAssignments)) {
      profileObj.layoutAssignments = [profileObj.layoutAssignments];
    }
    for (var i = 0; i < layoutAssignments.length; i++) {
      let layoutAssignment = layoutAssignments[i];
      let objName = layoutAssignment.layout.split("-")[0];
      profileObj.layoutAssignments = profileObj.layoutAssignments.filter(
        layoutAss => {
          const otherObjName = layoutAss.layout.split("-")[0];
          return objName !== otherObjName;
        }
      );
    }

    for (var i = 0; i < layoutAssignments.length; i++) {
      let layoutAssignment = layoutAssignments[i];
      let found = false;
      for (var j = 0; j < profileObj.layoutAssignments.length; j++) {
        if (
          layoutAssignment.layout === profileObj.layoutAssignments[j].layout &&
          layoutAssignment.recordType ===
            profileObj.layoutAssignments[j].recordType
        ) {
          found = true;
          break;
        }
      }
      if (!found) {
        profileObj.layoutAssignments.push(layoutAssignment);
      }
    }

    profileObj.layoutAssignments.sort((layout1, layout2) => {
      let order = 0;
      if (layout1.layout === layout2.layout) {
        if (layout1.recordType === undefined) {
          order = -1;
        } else if (layout1.recordType < layout2.recordType) {
          order = -1;
        } else {
          order = 1;
        }
      } else {
        if (layout1.layout < layout2.layout) {
          order = -1;
        } else if (layout1.layout > layout2.layout) {
          order = 1;
        }
      }
      return order;
    });

    return profileObj;
  }

  private mergeObjects(
    profileObj: Profile,
    objectPermissions: ProfileObjectPermissions[]
  ): Profile {
    if (
      profileObj.objectPermissions === null ||
      profileObj.objectPermissions === undefined
    ) {
      profileObj.objectPermissions = [];
    } else if (!Array.isArray(profileObj.objectPermissions)) {
      profileObj.objectPermissions = [profileObj.objectPermissions];
    }
    for (var i = 0; i < objectPermissions.length; i++) {
      let objPerm = objectPermissions[i];
      let found = false;
      for (var j = 0; j < profileObj.objectPermissions.length; j++) {
        if (objPerm.object === profileObj.objectPermissions[j].object) {
          profileObj.objectPermissions[j].allowCreate = objPerm.allowCreate;
          profileObj.objectPermissions[j].allowDelete = objPerm.allowDelete;
          profileObj.objectPermissions[j].allowEdit = objPerm.allowEdit;
          profileObj.objectPermissions[j].allowRead = objPerm.allowRead;
          profileObj.objectPermissions[j].modifyAllRecords =
            objPerm.modifyAllRecords;
          profileObj.objectPermissions[j].viewAllRecords =
            objPerm.viewAllRecords;
          found = true;
          break;
        }
      }
      if (!found) {
        profileObj.objectPermissions.push(objPerm);
      }
    }

    profileObj.objectPermissions.sort((obj1, obj2) => {
      let order = 0;
      if (obj1.object < obj2.object) {
        order = -1;
      } else if (obj1.object > obj2.object) {
        order = 1;
      }
      return order;
    });

    return profileObj;
  }

  private mergePages(
    profileObj: Profile,
    pages: ProfileApexPageAccess[]
  ): Profile {
    if (
      profileObj.pageAccesses === null ||
      profileObj.pageAccesses === undefined
    ) {
      profileObj.pageAccesses = [];
    } else if (!Array.isArray(profileObj.pageAccesses)) {
      profileObj.pageAccesses = [profileObj.pageAccesses];
    }
    for (var i = 0; i < pages.length; i++) {
      let page = pages[i];
      let found = false;
      for (var j = 0; j < profileObj.pageAccesses.length; j++) {
        if (page.apexPage === profileObj.pageAccesses[j].apexPage) {
          profileObj.pageAccesses[j].enabled = page.enabled;
          found = true;
          break;
        }
      }
      if (!found) {
        profileObj.pageAccesses.push(page);
      }
    }

    profileObj.pageAccesses.sort((page1, page2) => {
      let order = 0;
      if (page1.apexPage < page2.apexPage) {
        order = -1;
      } else if (page1.apexPage > page2.apexPage) {
        order = 1;
      }
      return order;
    });

    return profileObj;
  }

  private mergeRecordTypes(
    profileObj: Profile,
    recordTypes: RecordTypeVisibility[]
  ): Profile {
    if (
      profileObj.recordTypeVisibilities === null ||
      profileObj.recordTypeVisibilities === undefined
    ) {
      profileObj.recordTypeVisibilities = [];
    } else if (!Array.isArray(profileObj.recordTypeVisibilities)) {
      profileObj.recordTypeVisibilities = [profileObj.recordTypeVisibilities];
    }
    for (var i = 0; i < recordTypes.length; i++) {
      let recordType = recordTypes[i];
      let found = false;
      for (var j = 0; j < profileObj.recordTypeVisibilities.length; j++) {
        if (
          recordType.recordType ===
          profileObj.recordTypeVisibilities[j].recordType
        ) {
          profileObj.recordTypeVisibilities[j].default = recordType.default;
          if (
            recordType.personAccountDefault !== undefined &&
            recordType.personAccountDefault !== null
          ) {
            profileObj.recordTypeVisibilities[j].personAccountDefault =
              recordType.personAccountDefault;
          }
          profileObj.recordTypeVisibilities[j].visible = recordType.visible;
          found = true;
          break;
        }
      }
      if (!found) {
        profileObj.recordTypeVisibilities.push(recordType);
      }
    }

    profileObj.recordTypeVisibilities.sort((recordtype1, recordtype2) => {
      let order = 0;
      if (recordtype1.recordType < recordtype2.recordType) {
        order = -1;
      } else if (recordtype1.recordType > recordtype2.recordType) {
        order = 1;
      }
      return order;
    });

    return profileObj;
  }

  private mergeTabs(
    profileObj: Profile,
    tabs: ProfileTabVisibility[]
  ): Profile {
    if (
      profileObj.tabVisibilities === null ||
      profileObj.tabVisibilities === undefined
    ) {
      profileObj.tabVisibilities = [];
    } else if (!Array.isArray(profileObj.tabVisibilities)) {
      profileObj.tabVisibilities = [profileObj.tabVisibilities];
    }
    for (var i = 0; i < tabs.length; i++) {
      let tab = tabs[i];
      let found = false;
      for (var j = 0; j < profileObj.tabVisibilities.length; j++) {
        if (tab.tab === profileObj.tabVisibilities[j].tab) {
          profileObj.tabVisibilities[j].visibility = tab.visibility;
          found = true;
          break;
        }
      }
      if (!found) {
        profileObj.tabVisibilities.push(tab);
      }
    }

    profileObj.tabVisibilities.sort((tab1, tab2) => {
      let order = 0;
      if (tab1.tab < tab2.tab) {
        order = -1;
      } else if (tab1.tab > tab2.tab) {
        order = 1;
      }
      return order;
    });

    return profileObj;
  }

  private mergePermissions(
    profileObj: Profile,
    permissions: ProfileUserPermission[]
  ): Profile {
    if (
      profileObj.userPermissions === null ||
      profileObj.userPermissions === undefined
    ) {
      profileObj.userPermissions = [];
    } else if (!Array.isArray(profileObj.userPermissions)) {
      profileObj.userPermissions = [profileObj.userPermissions];
    }
    for (let i = 0; i < permissions.length; i++) {
      let perm = permissions[i];
      let found = false;
      for (let j = 0; j < profileObj.userPermissions.length; j++) {
        if (perm.name === profileObj.userPermissions[j].name) {
          profileObj.userPermissions[j].enabled = perm.enabled;
          found = true;
          break;
        }
      }
      if (!found) {
        profileObj.userPermissions.push(perm);
      }
    }

    profileObj.userPermissions.sort((perm1, perm2) => {
      let order = 0;
      if (perm1.name < perm2.name) {
        order = -1;
      } else if (perm1.name > perm2.name) {
        order = 1;
      }
      return order;
    });

    return profileObj;
  }

  private mergeCustomPermissions(
    profileObj: Profile,
    permissions: ProfileCustomPermissions[]
  ): Profile {
    if (
      profileObj.customPermissions === null ||
      profileObj.customPermissions === undefined
    ) {
      profileObj.customPermissions = [];
    } else if (!Array.isArray(profileObj.customPermissions)) {
      profileObj.customPermissions = [profileObj.customPermissions];
    }
    for (let i = 0; i < permissions.length; i++) {
      let perm = permissions[i];
      let found = false;
      for (let j = 0; j < profileObj.customPermissions.length; j++) {
        if (perm.name === profileObj.customPermissions[j].name) {
          profileObj.customPermissions[j].enabled = perm.enabled;
          found = true;
          break;
        }
      }
      if (!found) {
        profileObj.customPermissions.push(perm);
      }
    }

    profileObj.customPermissions.sort((perm1, perm2) => {
      let order = 0;
      if (perm1.name < perm2.name) {
        order = -1;
      } else if (perm1.name > perm2.name) {
        order = 1;
      }
      return order;
    });

    return profileObj;
  }

  public async merge(
    srcFolders: string[],
    profiles: string[],
    metadatas: any,
    isdelete?: boolean
  ): Promise<{
    added: string[];
    deleted: string[];
    updated: string[];
  }> {
    if (this.debugFlag) SfPowerKit.ux.log("Merging profiles...");
    this.metadataFiles = new MetadataFiles();
    for (let i = 0; i < srcFolders.length; i++) {
      let srcFolder = srcFolders[i];
      let normalizedPath = path.join(process.cwd(), srcFolder);
      this.metadataFiles.loadComponents(normalizedPath);
    }
    let profileListToReturn: string[] = [];
    let profileNames: string[] = [];
    var profilePathAssoc = {};
    let profileStatus = await this.getMetadataComponents(profiles);
    let metadataFiles = _.union(profileStatus.added, profileStatus.updated);
    metadataFiles.sort();
    for (var i = 0; i < metadataFiles.length; i++) {
      var profileComponent = metadataFiles[i];
      var profileName = path.basename(
        profileComponent,
        METADATA_INFO.Profile.sourceExtension
      );
      var supported = !unsupportedprofiles.includes(profileName);
      if (supported) {
        profilePathAssoc[profileName] = profileComponent;
        profileNames.push(profileName);
      }
    }

    //SfPowerKit.ux.log("Loading profiles from server ");
    var i: number,
      j: number,
      chunk: number = 10;
    var temparray;
    SfPowerKit.ux.log(
      `${profileNames.length}  profiles found in the directory `
    );
    for (i = 0, j = profileNames.length; i < j; i += chunk) {
      temparray = profileNames.slice(i, i + chunk);
      //SfPowerKit.ux.log(temparray.length);
      let start = i + 1;
      let end = i + chunk;
      SfPowerKit.ux.log("Loading a chunk of profiles " + start + " to " + end);
      let profileList: string[] = [];
      var metadataList = await this.loadProfiles(temparray, this.conn);

      for (var count = 0; count < metadataList.length; count++) {
        //handle profile merge here
        var profileObjFromServer = metadataList[count] as Profile;

        profileObjFromServer = await this.completeObjects(
          profileObjFromServer,
          false
        );

        this.handleViewAllDataPermission(profileObjFromServer);
        this.handleInstallPackagingPermission(profileObjFromServer);

        //Check if the permission QueryAllFiles is true and give read access to objects
        this.handleQueryAllFilesPermission(profileObjFromServer);

        profileObjFromServer = await this.completeUserPermissions(
          profileObjFromServer
        );

        if (metadatas !== undefined) {
          //remove metadatas from profile
          profileObjFromServer = this.removeUnwantedPermissions(
            profileObjFromServer,
            metadatas
          );
        }
        //Check if the component exists in the file system
        let filePath = profilePathAssoc[profileObjFromServer.fullName];
        var profileObj: Profile = profileObjFromServer;

        var exists = fs.existsSync(filePath);
        if (exists) {
          if (this.debugFlag)
            SfPowerKit.ux.log(
              "Merging profile " + profileObjFromServer.fullName
            );
          var profileXml = fs.readFileSync(filePath);

          const parser = new xml2js.Parser({ explicitArray: false });
          const parseString = util.promisify(parser.parseString);
          let parseResult = await parseString(parseString);

          profileObj = ProfileUtils.toProfile(parseResult.Profile);
          this.mergeProfile(profileObj, profileObjFromServer);
        } else {
          if (this.debugFlag)
            SfPowerKit.ux.log("New Profile " + profileObjFromServer.fullName);
        }

        await this.writeProfile(profileObj, filePath);

        if (this.debugFlag)
          SfPowerKit.ux.log("Profile " + profileObj.fullName + " merged");
        profileList.push(profileObj.fullName);
      }
      profileListToReturn.push(...profileList);
    }

    if (profileStatus.deleted && isdelete) {
      profileStatus.deleted.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    }
    return Promise.resolve(profileStatus);
  }
  private removeUnwantedPermissions(
    profileObjFromServer: Profile,
    metadatas: any
  ) {
    profileObjFromServer.applicationVisibilities = profileObjFromServer.applicationVisibilities.filter(
      elem => {
        return (
          metadatas["CustomApplication"].includes(elem.application) ||
          metadatas["CustomApplication"].includes("*")
        );
      }
    );
    profileObjFromServer.classAccesses = profileObjFromServer.classAccesses.filter(
      elem => {
        return (
          metadatas["ApexClass"].includes(elem.apexClass) ||
          metadatas["ApexClass"].includes("*")
        );
      }
    );
    profileObjFromServer.layoutAssignments = profileObjFromServer.layoutAssignments.filter(
      elem => {
        return (
          metadatas["Layout"].includes(elem.layout) ||
          metadatas["Layout"].includes("*")
        );
      }
    );
    profileObjFromServer.objectPermissions = profileObjFromServer.objectPermissions.filter(
      elem => {
        return (
          metadatas["CustomObject"].includes(elem.object) ||
          metadatas["CustomObject"].includes("*")
        );
      }
    );
    profileObjFromServer.pageAccesses = profileObjFromServer.pageAccesses.filter(
      elem => {
        return (
          metadatas["ApexPage"].includes(elem.apexPage) ||
          metadatas["ApexPage"].includes("*")
        );
      }
    );
    profileObjFromServer.fieldPermissions = profileObjFromServer.fieldPermissions.filter(
      elem => {
        return metadatas["CustomField"].includes(elem.field);
      }
    );
    profileObjFromServer.recordTypeVisibilities = profileObjFromServer.recordTypeVisibilities.filter(
      elem => {
        return metadatas["RecordType"].includes(elem.recordType);
      }
    );
    profileObjFromServer.tabVisibilities = profileObjFromServer.tabVisibilities.filter(
      elem => {
        return (
          metadatas["CustomTab"].includes(elem.tab) ||
          metadatas["CustomTab"].includes("*")
        );
      }
    );
    if (metadatas["SystemPermissions"].length == 0) {
      delete profileObjFromServer.userPermissions;
    }
    return profileObjFromServer;
  }

  public async sync(
    srcFolders: string[],
    profiles?: string[],
    isdelete?: boolean
  ): Promise<{
    added: string[];
    deleted: string[];
    updated: string[];
  }> {
    if (this.debugFlag) SfPowerKit.ux.log("Syncing profiles");
    this.metadataFiles = new MetadataFiles();
    for (let i = 0; i < srcFolders.length; i++) {
      let srcFolder = srcFolders[i];
      let normalizedPath = path.join(process.cwd(), srcFolder);
      this.metadataFiles.loadComponents(normalizedPath);
    }
    let profileList: string[] = [];
    let profileNames: string[] = [];
    let profilePathAssoc = {};
    let profileStatus = await this.getMetadataComponents(profiles);
    let metadataFiles = _.union(profileStatus.added, profileStatus.updated);
    metadataFiles.sort();
    for (var i = 0; i < metadataFiles.length; i++) {
      var profileComponent = metadataFiles[i];
      var profileName = path.basename(
        profileComponent,
        METADATA_INFO.Profile.sourceExtension
      );
      var supported = !unsupportedprofiles.includes(profileName);
      if (supported) {
        profilePathAssoc[profileName] = profileComponent;
        profileNames.push(profileName);
      }
    }

    var i: number,
      j: number,
      chunk: number = 10;
    var temparray;
    SfPowerKit.ux.log(
      "Number of profiles found in the target org " + profileNames.length
    );
    for (i = 0, j = profileNames.length; i < j; i += chunk) {
      temparray = profileNames.slice(i, i + chunk);
      //SfPowerKit.ux.log(temparray.length);
      let start = i + 1;
      let end = i + chunk;
      SfPowerKit.ux.log("Loading profiles in batches " + start + " to " + end);
      var metadataList = await this.loadProfiles(temparray, this.conn);
      for (var count = 0; count < metadataList.length; count++) {
        var profileObj = metadataList[count] as Profile;

        //Add No access on objects and fields
        profileObj = await this.completeObjects(profileObj, false);

        this.handleViewAllDataPermission(profileObj);
        this.handleInstallPackagingPermission(profileObj);

        //Check if the permission QueryAllFiles is true and give read access to objects
        this.handleQueryAllFilesPermission(profileObj);

        //await this.completeFieldPermissions(profileObj, false)
        profileObj = await this.completeUserPermissions(profileObj);

        await this.writeProfile(
          profileObj,
          profilePathAssoc[profileObj.fullName]
        );
        //SfPowerKit.ux.log("Profile " + profileObj.fullName + " Sync!");
        profileList.push(profileObj.fullName);
      }
    }

    if (profileStatus.deleted && isdelete) {
      profileStatus.deleted.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    }
    return Promise.resolve(profileStatus);
  }

  private async loadProfiles(
    profileNames: string[],
    conn
  ): Promise<MetadataInfo[]> {
    var toReturn: Promise<MetadataInfo[]> = null;
    var metadata = await conn.metadata.readSync("Profile", profileNames);
    if (Array.isArray(metadata)) {
      toReturn = Promise.resolve(metadata);
    } else if (metadata !== null) {
      toReturn = Promise.resolve([metadata]);
    } else {
      toReturn = Promise.resolve([]);
    }
    return toReturn;
  }

  private async writeProfile(profileObj: Profile, filePath: string) {
    //Delete eampty arrays
    for (var key in profileObj) {
      if (Array.isArray(profileObj[key])) {
        //All top element must be arays exept non arrayProperties
        if (!nonArayProperties.includes(key) && profileObj[key].length === 0) {
          delete profileObj[key];
        }
      }
    }
    if (profileObj.fullName !== undefined) {
      var builder = new xml2js.Builder({ rootName: "Profile" });
      profileObj["$"] = {
        xmlns: PROFILE_NAMESPACE
      };
      var xml = builder.buildObject(profileObj);
      fs.writeFileSync(filePath, xml);
    } else {
      SfPowerKit.ux.log("No ful name on profile component");
    }
  }
  private async completeUserPermissions(profileObj: Profile): Promise<Profile> {
    await this.loadSupportedPermissions();

    // remove unsupported userLicence
    var unsupportedLicencePermissions = this.getUnsupportedLicencePermissions(
      profileObj.userLicense
    );
    if (
      profileObj.userPermissions != null &&
      profileObj.userPermissions.length > 0
    ) {
      profileObj.userPermissions = profileObj.userPermissions.filter(
        permission => {
          var supported = !unsupportedLicencePermissions.includes(
            permission.name
          );
          return supported;
        }
      );
    }

    let notRetrievedPermissions = this.supportedPermissions.filter(
      permission => {
        let found = null;
        if (
          profileObj.userPermissions != null &&
          profileObj.userPermissions.length > 0
        ) {
          found = profileObj.userPermissions.find(element => {
            return element.name === permission;
          });
        }
        return found === null || found === undefined;
      }
    );

    var isCustom = "" + profileObj.custom;
    //SfPowerKit.ux.log("Is Custom: " + isCustom);
    if (isCustom == "false") {
      //Remove System permission for standard profile as Salesforce does not support edition on those profile
      delete profileObj.userPermissions;
    } else {
      for (var i = 0; i < notRetrievedPermissions.length; i++) {
        var newPermission: ProfileUserPermission = {
          enabled: false,
          name: notRetrievedPermissions[i]
        };
        if (profileObj.userPermissions === undefined) {
          profileObj.userPermissions = new Array();
        }
        profileObj.userPermissions.push(newPermission);
      }
    }

    if (profileObj.userPermissions !== undefined) {
      profileObj.userPermissions.sort((perm1, perm2) => {
        let order = 0;
        if (perm1.name < perm2.name) {
          order = -1;
        } else if (perm1.name > perm2.name) {
          order = 1;
        }
        return order;
      });
    }

    return profileObj;
  }
  hasPermission(profileObj: Profile, permissionName: string): boolean {
    let found = false;
    if (
      profileObj.userPermissions !== null &&
      profileObj.userPermissions !== undefined &&
      profileObj.userPermissions.length > 0
    ) {
      for (var i = 0; i < profileObj.userPermissions.length; i++) {
        let element = profileObj.userPermissions[i];
        if (element.name === permissionName) {
          found = element.enabled;
          break;
        }
      }
    }
    return found;
  }
  togglePermission(profileObj: Profile, permissionName: string) {
    if (
      profileObj.userPermissions !== null &&
      profileObj.userPermissions.length > 0
    ) {
      for (var i = 0; i < profileObj.userPermissions.length; i++) {
        let element = profileObj.userPermissions[i];
        if (element.name === permissionName) {
          element.enabled = !element.enabled;
          break;
        }
      }
    }
  }
  enablePermission(profileObj: Profile, permissionName: string) {
    let found = false;
    if (
      profileObj.userPermissions !== null &&
      profileObj.userPermissions.length > 0
    ) {
      for (var i = 0; i < profileObj.userPermissions.length; i++) {
        let element = profileObj.userPermissions[i];
        if (element.name === permissionName) {
          element.enabled = true;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      if (
        profileObj.userPermissions === null ||
        profileObj.userPermissions === undefined
      ) {
        profileObj.userPermissions = [];
      }
      if (this.supportedPermissions.includes(permissionName)) {
        let permission = {
          name: permissionName,
          enabled: true
        } as ProfileUserPermission;
        profileObj.userPermissions.push(permission);
      }
    }
  }
  handleQueryAllFilesPermission(profileObj: Profile): any {
    let isQueryAllFilesPermission = this.hasPermission(
      profileObj,
      "QueryAllFiles"
    );
    if (
      isQueryAllFilesPermission &&
      profileObj.objectPermissions !== undefined &&
      profileObj.objectPermissions.length > 0
    ) {
      for (var i = 0; i < profileObj.objectPermissions.length; i++) {
        profileObj.objectPermissions[i].allowRead = true;
        profileObj.objectPermissions[i].viewAllRecords = true;
      }
    }
  }
  handleViewAllDataPermission(profileObj: Profile): any {
    let isViewAllData = this.hasPermission(profileObj, "ViewAllData");
    if (
      isViewAllData &&
      profileObj.objectPermissions !== undefined &&
      profileObj.objectPermissions.length > 0
    ) {
      for (var i = 0; i < profileObj.objectPermissions.length; i++) {
        profileObj.objectPermissions[i].allowRead = true;
        profileObj.objectPermissions[i].viewAllRecords = true;
      }
    }
    if (isViewAllData) {
      this.enablePermission(profileObj, "ViewPlatformEvents");
      this.enablePermission(profileObj, "ViewDataLeakageEvents");
    }
  }
  handleInstallPackagingPermission(profileObj: Profile): any {
    let hasPermission = this.hasPermission(profileObj, "InstallPackaging");
    if (hasPermission) {
      this.enablePermission(profileObj, "ViewDataLeakageEvents");
    }
  }
  getUnsupportedLicencePermissions(licence: string): any {
    if (!_.isNil(licence)) {
      for (var i = 0; i < userLicenceMap.length; i++) {
        if (
          userLicenceMap[i].name.trim().toLocaleLowerCase() ===
          licence.trim().toLocaleLowerCase()
        ) {
          return userLicenceMap[i].unsupportedPermissions;
        }
      }
    }
    return [];
  }

  private async getMetadataComponents(
    profileNames: string[]
  ): Promise<{
    added: string[];
    deleted: string[];
    updated: string[];
  }> {
    let profilesStatus = {
      added: [],
      deleted: [],
      updated: []
    };
    let metadataFiles = METADATA_INFO.Profile.files || [];
    //generate path for new profiles
    let profilePath = path.join(
      process.cwd(),
      SfPowerKit.defaultFolder,
      "main",
      "default",
      "profiles"
    );
    if (metadataFiles && metadataFiles.length > 0) {
      profilePath = path.dirname(metadataFiles[0]);
    } else {
      //create folder structure
      FileUtils.mkDirByPathSync(profilePath);
    }

    if (profileNames && profileNames.length > 0) {
      metadataFiles = [];
      for (let i = 0; i < profileNames.length; i++) {
        let profileName = profileNames[i];
        let found = false;
        for (let j = 0; j < METADATA_INFO.Profile.files.length; j++) {
          let profileComponent = METADATA_INFO.Profile.files[j];
          let oneName = path.basename(
            profileComponent,
            METADATA_INFO.Profile.sourceExtension
          );
          if (profileName === oneName) {
            //metadataFiles.push(profileComponent);
            profilesStatus.updated.push(profileComponent);
            found = true;
            break;
          }
        }
        //Query the profile from the server
        let profiles = await this.getProfilesMetadata(this.conn);
        if (!found) {
          for (let k = 0; k < profiles.length; k++) {
            if (profiles[k] === profileName) {
              let newProfilePath = path.join(
                profilePath,
                profiles[k] + METADATA_INFO.Profile.sourceExtension
              );
              //metadataFiles.push(newProfilePath);
              profilesStatus.added.push(newProfilePath);
              found = true;
              break;
            }
          }
        }
        if (!found) {
          profilesStatus.deleted.push(profileName);
        }
      }
    } else {
      if (this.debugFlag)
        SfPowerKit.ux.log(
          "Load new profiles from server and generate a path for future save"
        );
      // Query the org
      const profiles = await this.getProfilesMetadata(this.conn);
      profilesStatus.deleted = metadataFiles.filter(file => {
        let oneName = path.basename(
          file,
          METADATA_INFO.Profile.sourceExtension
        );
        return !profiles.includes(oneName);
      });
      profilesStatus.updated = metadataFiles.filter(file => {
        let oneName = path.basename(
          file,
          METADATA_INFO.Profile.sourceExtension
        );
        return profiles.includes(oneName);
      });

      if (profiles && profiles.length > 0) {
        let newProfiles = profiles.filter(profileObj => {
          let found = false;
          for (let i = 0; i < profilesStatus.updated.length; i++) {
            let profileComponent = profilesStatus.updated[i];
            let oneName = path.basename(
              profileComponent,
              METADATA_INFO.Profile.sourceExtension
            );
            //escape some caracters
            let onlineName = profileObj.replace("'", "%27");
            onlineName = onlineName.replace("/", "%2F");
            if (onlineName === oneName) {
              found = true;
              break;
            }
          }
          return !found;
        });
        if (newProfiles && newProfiles.length > 0) {
          if (this.debugFlag) SfPowerKit.ux.log("New profiles founds");
          for (let i = 0; i < newProfiles.length; i++) {
            if (this.debugFlag) SfPowerKit.ux.log(newProfiles[i]);
            let newPRofilePath = path.join(
              profilePath,
              newProfiles[i] + METADATA_INFO.Profile.sourceExtension
            );
            //metadataFiles.push(newPRofilePath);
            profilesStatus.added.push(newPRofilePath);
          }
        } else {
          SfPowerKit.ux.log("No new profile found");
        }
      }
    }
    //metadataFiles = metadataFiles.sort();
    return Promise.resolve(profilesStatus);
  }
  public async reconcile(
    srcFolders: string[],
    profileList: string[]
  ): Promise<string[]> {
    let result: string[] = [];
    this.metadataFiles = new MetadataFiles();
    srcFolders.forEach(srcFolder => {
      let normalizedPath = path.join(process.cwd(), srcFolder);
      this.metadataFiles.loadComponents(normalizedPath);
    });

    profileList = profileList.map(element => {
      return element + METADATA_INFO.Profile.sourceExtension;
    });

    await this.loadSupportedPermissions();
    for (let count = 0; count < METADATA_INFO.Profile.files.length; count++) {
      let profileComponent = METADATA_INFO.Profile.files[count];
      if (
        profileList.length == 0 ||
        profileList.includes(path.basename(profileComponent))
      ) {
        SfPowerKit.ux.log(
          "Reconciling profile " + path.basename(profileComponent)
        );

        const parser = new xml2js.Parser({ explicitArray: false });
        const parseString = util.promisify(parser.parseString);
        let parseResult = await parseString(parseString);

        let profileObj: Profile = ProfileUtils.toProfile(parseResult.Profile); // as Profile

        profileObj = await this.removePermissions(profileObj);

        //Manage licences
        let licenceUtils = UserLicenceUtils.getInstance(this.org);
        const isSupportedLicence = await licenceUtils.userLicenseExists(
          profileObj.userLicense
        );
        if (!isSupportedLicence) {
          delete profileObj.userLicense;
        }

        // remove unsupported userPermission
        let unsupportedLicencePermissions = this.getUnsupportedLicencePermissions(
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

        if (
          profileObj.userPermissions !== undefined &&
          profileObj.userPermissions.length > 0
        ) {
          //Remove permission that are not present in the target org
          profileObj.userPermissions = profileObj.userPermissions.filter(
            permission => {
              let supported = this.supportedPermissions.includes(
                permission.name
              );
              return supported;
            }
          );
        }

        //UserPermissionUtils.addPermissionDependencies(profileObj);

        let isCustom = "" + profileObj.custom;
        if (isCustom == "false") {
          delete profileObj.userPermissions;
        }

        //this.handleViewAllDataPermission(profileObj);
        //this.handleInstallPackagingPermission(profileObj);
        //this.handleQueryAllFilesPermission(profileObj);

        UserPermissionUtils.handlePermissionDependency(
          profileObj,
          this.supportedPermissions
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
        SfPowerKit.ux.log("profile reconciled " + profileObj.fullName);
        let builder = new xml2js.Builder({ rootName: "Profile" });
        let xml = builder.buildObject(profileObj);
        fs.writeFileSync(profileComponent, xml);

        result.push(profileComponent);
      }
    }
    return result;
  }

  private static toProfile(profileObj: any): Profile {
    var convertedObject: any = {};
    for (var key in profileObj) {
      if (Array.isArray(profileObj[key])) {
        //All top element must be arays exept non arrayProperties
        if (nonArayProperties.includes(key)) {
          convertedObject[key] =
            profileObj[key][0] === "true"
              ? true
              : profileObj[key][0] === "false"
              ? false
              : profileObj[key][0];
        } else {
          var data = [];
          for (var i = 0; i < profileObj[key].length; i++) {
            var element = ProfileUtils.removeArrayNatureOnValue(
              profileObj[key][i]
            );
            if (element !== "") {
              data.push(element);
            }
          }
          convertedObject[key] = data;
        }
      } else if (nonArayProperties.includes(key)) {
        convertedObject[key] = profileObj[key];
      }
    }
    return convertedObject as Profile;
  }

  public static removeArrayNatureOnValue(obj: any): any {
    var toReturn = {};
    for (var key in obj) {
      if (Array.isArray(obj[key]) && obj[key].length > 0) {
        //All top element must be arays exept non arrayProperties
        toReturn[key] =
          obj[key][0] === "true"
            ? true
            : obj[key][0] === "false"
            ? false
            : obj[key][0];
      } else {
        toReturn[key] = obj[key];
      }
    }
    return toReturn;
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

  private async reconcileApp(profileObj: Profile): Promise<Profile> {
    let utils = AppUtils.getInstance(this.org);
    if (profileObj.applicationVisibilities !== undefined) {
      let validArray = [];
      for (let i = 0; i < profileObj.applicationVisibilities.length; i++) {
        let cmpObj = profileObj.applicationVisibilities[i];
        let exist = utils.appExists(cmpObj.application);
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      profileObj.applicationVisibilities = validArray;
    }

    return profileObj;
  }

  private async reconcileClasses(profileObj: Profile): Promise<Profile> {
    let utils = ClassUtils.getInstance(this.org);

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
    let utils = FieldUtils.getInstance(this.org);
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
    let utils = LayoutUtils.getInstance(this.org);
    let rtUtils = RecordTypeUtils.getInstance(this.org);

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
    let utils = EntityDefinitionUtils.getInstance(this.org);

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
    let utils = PageUtils.getInstance(this.org);
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
    let utils = RecordTypeUtils.getInstance(this.org);

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
    let utils = TabUtils.getInstance(this.org);

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

  private async completeObjects(
    profileObj: Profile,
    access: boolean = true
  ): Promise<Profile> {
    let objPerm = ProfileUtils.filterObjects(profileObj);
    if (objPerm === undefined) {
      objPerm = new Array();
    } else if (!Array.isArray(objPerm)) {
      objPerm = [objPerm];
    }

    let utils = EntityDefinitionUtils.getInstance(this.org);

    let objects = await utils.getObjectForPermission();

    objects.forEach(name => {
      if (unsuportedObjects.includes(name)) {
        return;
      }
      let objectIsPresent: boolean = false;

      for (let i = 0; i < objPerm.length; i++) {
        if (objPerm[i].object === name) {
          objectIsPresent = true;
          break;
        } else {
          objectIsPresent = false;
        }
      }

      if (objectIsPresent === false) {
        //SfPowerKit.ux.log("\n Inserting this object");
        let objToInsert = ProfileUtils.buildObjPermArray(name, access);
        //SfPowerKit.ux.log(objToInsert);
        if (profileObj.objectPermissions === undefined) {
          profileObj.objectPermissions = new Array();
        } else if (!Array.isArray(profileObj.objectPermissions)) {
          profileObj.objectPermissions = [profileObj.objectPermissions];
        }
        profileObj.objectPermissions.push(objToInsert);
      }
    });

    if (profileObj.objectPermissions !== undefined) {
      profileObj.objectPermissions.sort((obj1, obj2) => {
        let order = 0;
        if (obj1.object < obj2.object) {
          order = -1;
        } else if (obj1.object > obj2.object) {
          order = 1;
        }
        return order;
      });
    }
    return profileObj;
  }

  private static filterObjects(
    profileObj: Profile
  ): ProfileObjectPermissions[] {
    return profileObj.objectPermissions;
  }

  private static buildObjPermArray(
    objectName: string,
    access: boolean = true
  ): ProfileObjectPermissions {
    var newObjPerm = {
      allowCreate: access,
      allowDelete: access,
      allowEdit: access,
      allowRead: access,
      modifyAllRecords: access,
      object: objectName,
      viewAllRecords: access
    };
    return newObjPerm;
  }

  /**
   * Return All profile object from the connected Org
   */
  public async getProfiles(): Promise<ProfileTooling[]> {
    super.setQuery(QUERY);
    return await super.getObjects();
  }
  /**
   * Get a profile by Profile Name
   * @param name The name of the profile to return
   */
  public async getProfileByName(name: string): Promise<ProfileTooling> {
    super.setQuery(QUERY + " WHERE Name='" + name + "'");
    let profiles = await super.getObjects();
    if (profiles.length > 0) {
      return profiles[0];
    }
    return undefined;
  }

  public async getProfilesMetadata(conn: any): Promise<string[]> {
    var types = [{ type: "Profile", folder: null }];
    //let metadata = await conn.metadata.list(types);
    // console.log(metadata);
    const apiversion = await this.org.getConnection().retrieveMaxApiVersion();
    let toReturn: Promise<string[]> = new Promise<string[]>(
      (resolve, reject) => {
        conn.metadata.list(types, apiversion, function(err, metadata) {
          if (err) {
            return reject(err);
          }
          let profileNames = [];
          for (let i = 0; i < metadata.length; i++) {
            profileNames.push(metadata[i].fullName);
          }
          resolve(profileNames);
        });
      }
    );

    return toReturn;
  }
}
