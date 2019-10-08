import { SFPowerkit } from "../../../sfpowerkit";
import MetadataFiles from "../../metadata/metadataFiles";
import * as fs from "fs";
import * as path from "path";
import xml2js = require("xml2js");
import { METADATA_INFO } from "../../metadata/metadataInfo";
import _ from "lodash";
import Profile, {
  ApplicationVisibility,
  ProfileApexClassAccess,
  ProfileFieldLevelSecurity,
  ProfileLayoutAssignments,
  ProfileObjectPermissions,
  ProfileApexPageAccess,
  RecordTypeVisibility,
  ProfileTabVisibility,
  ProfileUserPermission,
  ProfileCustomPermissions
} from "../../../impl/metadata/schema";
import util = require("util");
import ProfileActions from "./profileActions";
import ProfileWriter from "../../../impl/metadata/writer/profileWriter";

const unsupportedprofiles = [];

export default class ProfileMerge extends ProfileActions {
  metadataFiles: MetadataFiles;

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
    if (this.debugFlag) SFPowerkit.ux.log("Merging profiles...");
    let fetchNewProfiles = _.isNil(srcFolders) || srcFolders.length === 0;
    if (fetchNewProfiles) {
      srcFolders = await SFPowerkit.getProjectDirectories();
    }
    this.metadataFiles = new MetadataFiles();
    for (let i = 0; i < srcFolders.length; i++) {
      let srcFolder = srcFolders[i];
      let normalizedPath = path.join(process.cwd(), srcFolder);
      this.metadataFiles.loadComponents(normalizedPath);
    }
    let profileListToReturn: string[] = [];
    let profileNames: string[] = [];
    var profilePathAssoc = {};
    let profileStatus = await this.getProfileFullNamesWithLocalStatus(profiles);
    let metadataFiles = profileStatus.updated || [];
    if (fetchNewProfiles) {
      metadataFiles = _.union(profileStatus.added, profileStatus.updated);
    } else {
      profileStatus.added = [];
    }
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
    SFPowerkit.ux.log(
      `${profileNames.length}  profiles found in the directory `
    );
    for (i = 0, j = profileNames.length; i < j; i += chunk) {
      temparray = profileNames.slice(i, i + chunk);
      //SfPowerKit.ux.log(temparray.length);
      let start = i + 1;
      let end = i + chunk;
      SFPowerkit.ux.log("Loading a chunk of profiles " + start + " to " + end);
      let profileList: string[] = [];
      var metadataList = await this.profileRetriever.loadProfiles(
        temparray,
        this.conn
      );

      for (var count = 0; count < metadataList.length; count++) {
        //handle profile merge here
        var profileObjFromServer = metadataList[count] as Profile;

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
        let profileWriter = new ProfileWriter();

        var exists = fs.existsSync(filePath);
        if (exists) {
          if (this.debugFlag)
            SFPowerkit.ux.log(
              "Merging profile " + profileObjFromServer.fullName
            );
          var profileXml = fs.readFileSync(filePath);

          const parser = new xml2js.Parser({ explicitArray: false });
          const parseString = util.promisify(parser.parseString);
          let parseResult = await parseString(profileXml);

          profileObj = profileWriter.toProfile(parseResult.Profile);
          await this.mergeProfile(profileObj, profileObjFromServer);
        } else {
          if (this.debugFlag)
            SFPowerkit.ux.log("New Profile " + profileObjFromServer.fullName);
        }

        profileObj.fullName = profileObjFromServer.fullName;
        profileWriter.writeProfile(profileObj, filePath);

        if (this.debugFlag)
          SFPowerkit.ux.log("Profile " + profileObj.fullName + " merged");
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
}
