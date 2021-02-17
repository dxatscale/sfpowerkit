import Profile, {
  ProfileObjectPermissions,
  ProfileUserPermission,
} from "../schema";
import MetadataFiles from "../metadataFiles";
import { Connection, Org } from "@salesforce/core";
import { MetadataInfo } from "jsforce";
import UserPermissionBuilder from "../builder/userPermissionBuilder";
import * as _ from "lodash";
import MetadataRetriever from "./metadataRetriever";
import { METADATA_INFO } from "../metadataInfo";

const unsuportedObjects = ["PersonAccount"];
/**
 *
 * Used to track Unsupported Userpermission per Licence
 * Update this list when Salesforce change supported permission per licence
 */
const userLicenceMap = [
  {
    name: "Guest User License",
    unsupportedPermissions: ["PasswordNeverExpires"],
  },
];

const QUERY = "SELECT Id, Name, UserType, Description From Profile";
export default class ProfileRetriever {
  static supportedMetadataTypes = [
    "ApexClass",
    "CustomApplication",
    "CustomObject",
    "CustomField",
    "Layout",
    "ApexPage",
    "CustomTab",
    "RecordType",
    "SystemPermissions",
  ];

  supportedPermissions: string[] = [];
  conn: Connection;

  metadataFiles: MetadataFiles;

  public constructor(private org: Org, private debugFlag?: boolean) {}

  public async loadSupportedPermissions() {
    if (this.supportedPermissions.length === 0) {
      this.supportedPermissions = await UserPermissionBuilder.getSupportedPermissions(
        this.conn
      );
    }
  }

  public async loadProfiles(
    profileNames: string[],
    conn
  ): Promise<MetadataInfo[]> {
    var metadata = await conn.metadata.readSync("Profile", profileNames);
    if (Array.isArray(metadata)) {
      for (let i = 0; i < metadata.length; i++) {
        await this.handlePermissions(metadata[i]);
        metadata[i] = this.completeObjects(metadata[i], false);
      }
      await Promise.all(metadata);
      return metadata;
    } else if (metadata !== null) {
      await this.handlePermissions(metadata);
      metadata = await this.completeObjects(metadata, false);
      return [metadata];
    } else {
      return [];
    }
  }

  public async handlePermissions(profileObj: Profile): Promise<Profile> {
    this.handleViewAllDataPermission(profileObj);
    this.handleInstallPackagingPermission(profileObj);
    this.handleQueryAllFilesPermission(profileObj);
    //Check if the permission QueryAllFiles is true and give read access to objects
    profileObj = await this.completeUserPermissions(profileObj);

    return profileObj;
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
        (permission) => {
          var supported = !unsupportedLicencePermissions.includes(
            permission.name
          );
          return supported;
        }
      );
    }

    let notRetrievedPermissions = this.supportedPermissions.filter(
      (permission) => {
        let found = null;
        if (
          profileObj.userPermissions != null &&
          profileObj.userPermissions.length > 0
        ) {
          found = profileObj.userPermissions.find((element) => {
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
          name: notRetrievedPermissions[i],
        };
        if (profileObj.userPermissions === undefined) {
          profileObj.userPermissions = new Array();
        }
        if (!Array.isArray(profileObj.userPermissions)) {
          profileObj.userPermissions = [profileObj.userPermissions];
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

  private hasPermission(profileObj: Profile, permissionName: string): boolean {
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

  private async completeObjects(
    profileObj: Profile,
    access: boolean = true
  ): Promise<Profile> {
    let objPerm = ProfileRetriever.filterObjects(profileObj);
    if (objPerm === undefined) {
      objPerm = new Array();
    } else if (!Array.isArray(objPerm)) {
      objPerm = [objPerm];
    }

    let objectPermissionsRetriever = new MetadataRetriever(
      this.conn,
      "ObjectPermissions",
      METADATA_INFO
    );
    let objectPermissions = await objectPermissionsRetriever.getComponents();

    objectPermissions.forEach((name) => {
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
        let objToInsert = ProfileRetriever.buildObjPermArray(name, access);
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
      viewAllRecords: access,
    };
    return newObjPerm;
  }
  private static filterObjects(
    profileObj: Profile
  ): ProfileObjectPermissions[] {
    return profileObj.objectPermissions;
  }

  private enablePermission(profileObj: Profile, permissionName: string) {
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
          enabled: true,
        } as ProfileUserPermission;
        profileObj.userPermissions.push(permission);
      }
    }
  }

  private handleQueryAllFilesPermission(profileObj: Profile): any {
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

  private handleViewAllDataPermission(profileObj: Profile): any {
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

  private handleInstallPackagingPermission(profileObj: Profile): any {
    let hasPermission = this.hasPermission(profileObj, "InstallPackaging");
    if (hasPermission) {
      this.enablePermission(profileObj, "ViewDataLeakageEvents");
    }
  }

  public getUnsupportedLicencePermissions(licence: string): any {
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
}
