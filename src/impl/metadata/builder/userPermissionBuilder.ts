import { core } from "@salesforce/command";
import { DescribeSObjectResult } from "jsforce/describe-result";
import { ProfileObjectPermissions, ProfileUserPermission } from "../schema";
import * as _ from "lodash";

const userPermissionDependencies = [
  {
    name: "ViewAllData",
    permissionsRequired: ["ViewPlatformEvents", "ViewDataLeakageEvents"],
    hasAccessOnData: true,
  },
  {
    name: "QueryAllFiles",
    hasAccessOnData: true,
  },
  {
    name: "InstallPackaging",
    permissionsRequired: ["ViewDataLeakageEvents", "EditPublicReports"],
  },
  {
    name: "CanUseNewDashboardBuilder",
    permissionsRequired: ["ManageDashboards"],
  },
  {
    name: "ScheduleReports",
    permissionsRequired: ["EditReports", "RunReports"],
  },
  {
    name: "EditReports",
    permissionsRequired: ["RunReports"],
  },
  {
    name: "ModifyAllData",
    permissionsRequired: ["EditPublicReports", "ManageDashboards"],
  },
  {
    name: "BulkMacrosAllowed",
    objectsAccessRequired: [
      {
        object: "Macro",
        allowCreate: "false",
        allowDelete: "false",
        allowEdit: "false",
        allowRead: "true",
        modifyAllRecords: "false",
        viewAllRecords: "false",
      },
    ],
  },
  {
    name: "ManageSolutions",
    objectsAccessRequired: [
      {
        object: "Solution",
        allowCreate: "true",
        allowDelete: "true",
        allowEdit: "true",
        allowRead: "true",
        modifyAllRecords: "false",
        viewAllRecords: "false",
      },
    ],
  },
  {
    name: "ManageCssUsers",
    objectsAccessRequired: [
      {
        object: "Contact",
        allowCreate: "true",
        allowDelete: "false",
        allowEdit: "true",
        allowRead: "true",
        modifyAllRecords: "false",
        viewAllRecords: "false",
      },
    ],
  },
  {
    name: "TransferAnyCase",
    objectsAccessRequired: [
      {
        object: "Case",
        allowCreate: "true",
        allowDelete: "false",
        allowEdit: "false",
        allowRead: "true",
        modifyAllRecords: "false",
        viewAllRecords: "false",
      },
    ],
  },
];

export default class UserPermissionBuilder {
  static supportedPermissions: string[];
  public static addPermissionDependencies(profileOrPermissionSet: any) {
    let objectAccessRequired = [];
    for (let i = 0; i < userPermissionDependencies.length; i++) {
      let dependedPermission = userPermissionDependencies[i];
      if (
        profileOrPermissionSet.userPermissions != null &&
        profileOrPermissionSet.userPermissions.length > 0
      ) {
        for (
          let j = 0;
          j < profileOrPermissionSet.userPermissions.length;
          j++
        ) {
          let permission = profileOrPermissionSet.userPermissions[j];
          if (permission.name == dependedPermission.name) {
            objectAccessRequired.push(
              ...dependedPermission.objectsAccessRequired
            );
          }
        }
      }
    }
    if (objectAccessRequired.length > 0) {
      UserPermissionBuilder.addRequiredObjectAccess(
        profileOrPermissionSet,
        UserPermissionBuilder.mergeObjectAccess(objectAccessRequired)
      );
    }
  }

  private static mergeObjectAccess(objectAccessRequired: any[]) {
    var objectMapping = {};
    for (var i = 0; i < objectAccessRequired.length; i++) {
      var objectAccess = objectAccessRequired[i];
      if (objectMapping[objectAccess.object] != undefined) {
        //console.log('Adding access');
        UserPermissionBuilder.addAccess(
          objectMapping[objectAccess.object],
          objectAccess
        );
      } else {
        //console.log('object access does not exists ');
        objectMapping[objectAccess.object] = objectAccess;
      }
    }
    return Object.values(objectMapping);
  }
  private static addAccess(objectAccess1, ObjectAccess2) {
    objectAccess1.allowCreate =
      objectAccess1.allowCreate.toString() === "true"
        ? true
        : ObjectAccess2.allowCreate;
    objectAccess1.allowDelete =
      objectAccess1.allowDelete.toString() === "true"
        ? true
        : ObjectAccess2.allowDelete;
    objectAccess1.allowEdit =
      objectAccess1.allowEdit.toString() === "true"
        ? true
        : ObjectAccess2.allowEdit;
    objectAccess1.allowRead =
      objectAccess1.allowRead.toString() === "true"
        ? true
        : ObjectAccess2.allowRead;
    objectAccess1.modifyAllRecords =
      objectAccess1.modifyAllRecords.toString() === true
        ? true
        : ObjectAccess2.modifyAllRecords;
    objectAccess1.viewAllRecords =
      objectAccess1.viewAllRecords.toString() === "true"
        ? true
        : ObjectAccess2.viewAllRecords;
  }
  private static addRequiredObjectAccess(
    profileOrPermissionSet: any,
    objectAccessRequired: any
  ) {
    if (
      profileOrPermissionSet.objectPermissions == null ||
      profileOrPermissionSet.objectPermissions == undefined ||
      !Array.isArray(profileOrPermissionSet.objectPermissions)
    ) {
      profileOrPermissionSet.objectPermissions = objectAccessRequired;
    } else {
      let objectAccesses = objectAccessRequired.filter((objectAccess) => {
        let exist = false;
        for (
          let i = 0;
          i < profileOrPermissionSet.objectPermissions.length;
          i++
        ) {
          let profileObjectAccess = profileOrPermissionSet.objectPermissions[i];
          exist = profileObjectAccess.object == objectAccess.object;
          if (exist) {
            UserPermissionBuilder.addAccess(profileObjectAccess, objectAccess);
            break;
          }
        }
        return !exist;
      });
      if (objectAccesses.length > 0) {
        profileOrPermissionSet.objectPermissions.push(...objectAccesses);
      }
    }
  }

  public static async describeSObject(
    conn: core.Connection,
    sObjectName: string
  ): Promise<DescribeSObjectResult> {
    var toReturn: Promise<DescribeSObjectResult> = new Promise<
      DescribeSObjectResult
    >((resolve, reject) => {
      conn
        .sobject(sObjectName)
        .describe(function (err, meta: DescribeSObjectResult) {
          if (err) {
            console.error(err);
            reject(err);
          }
          resolve(meta);
        });
    });
    return toReturn;
  }

  public static async getSupportedPermissions(
    conn: core.Connection
  ): Promise<string[]> {
    if (_.isNil(UserPermissionBuilder.supportedPermissions)) {
      let describeResult = await UserPermissionBuilder.describeSObject(
        conn,
        "PermissionSet"
      );
      UserPermissionBuilder.supportedPermissions = [];
      describeResult.fields.forEach((field) => {
        let fieldName = field["name"] as string;
        if (fieldName.startsWith("Permissions")) {
          UserPermissionBuilder.supportedPermissions.push(
            fieldName.replace("Permissions", "").trim()
          );
        }
      });
    }
    return UserPermissionBuilder.supportedPermissions;
  }

  public static async isSupportedPermission(
    permission: string
  ): Promise<boolean> {
    let found = false;
    if (!_.isNil(UserPermissionBuilder.supportedPermissions)) {
      found = UserPermissionBuilder.supportedPermissions.includes(permission);
    }
    return found;
  }

  public static handlePermissionDependency(
    profileOrPermissionSet: {
      objectPermissions?: ProfileObjectPermissions[];
      userPermissions?: ProfileUserPermission[];
    },
    supportedPermissions: string[]
  ): any {
    userPermissionDependencies.forEach((userPermission) => {
      let hasPermission = UserPermissionBuilder.hasPermission(
        profileOrPermissionSet,
        userPermission.name
      );
      if (
        hasPermission &&
        userPermission.hasAccessOnData &&
        profileOrPermissionSet.objectPermissions !== undefined &&
        profileOrPermissionSet.objectPermissions.length > 0
      ) {
        for (
          var i = 0;
          i < profileOrPermissionSet.objectPermissions.length;
          i++
        ) {
          profileOrPermissionSet.objectPermissions[i].allowRead = true;
          profileOrPermissionSet.objectPermissions[i].viewAllRecords = true;
        }
      }

      if (
        hasPermission &&
        userPermission.permissionsRequired !== undefined &&
        userPermission.permissionsRequired.length > 0
      ) {
        for (let i = 0; i < userPermission.permissionsRequired.length; i++) {
          UserPermissionBuilder.enablePermission(
            profileOrPermissionSet,
            userPermission.permissionsRequired[i],
            supportedPermissions
          );
        }
      }
    });
  }

  static enablePermission(
    profileObj: {
      objectPermissions?: ProfileObjectPermissions[];
      userPermissions?: ProfileUserPermission[];
    },
    permissionName: string,
    supportedPermission: string[]
  ) {
    let found = false;
    if (
      profileObj.userPermissions !== undefined &&
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
      if (_.isNil(profileObj.userPermissions)) {
        profileObj.userPermissions = [];
      }
      if (supportedPermission.includes(permissionName)) {
        let permission = {
          name: permissionName,
          enabled: true,
        } as ProfileUserPermission;
        profileObj.userPermissions.push(permission);
      }
    }
  }

  static hasPermission(
    profileOrPermissionSet: {
      objectPermissions?: ProfileObjectPermissions[];
      userPermissions?: ProfileUserPermission[];
    },
    permissionName: string
  ): boolean {
    let found = false;
    if (!_.isNil(profileOrPermissionSet.userPermissions)) {
      for (var i = 0; i < profileOrPermissionSet.userPermissions.length; i++) {
        let element = profileOrPermissionSet.userPermissions[i];
        if (element.name === permissionName) {
          found = element.enabled;
          break;
        }
      }
    }
    return found;
  }
}
