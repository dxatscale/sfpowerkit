import { ProfileObjectPermissions, ProfileUserPermission } from '../schema';
import * as _ from 'lodash';

const userPermissionDependencies = [
    {
        name: 'ViewAllData',
        permissionsRequired: ['ViewPlatformEvents', 'ViewDataLeakageEvents'],
        hasAccessOnData: true,
    },
    {
        name: 'QueryAllFiles',
        hasAccessOnData: true,
    },
    {
        name: 'InstallPackaging',
        permissionsRequired: ['ViewDataLeakageEvents', 'EditPublicReports'],
    },
    {
        name: 'CanUseNewDashboardBuilder',
        permissionsRequired: ['ManageDashboards'],
    },
    {
        name: 'ScheduleReports',
        permissionsRequired: ['EditReports', 'RunReports'],
    },
    {
        name: 'EditReports',
        permissionsRequired: ['RunReports'],
    },
    {
        name: 'ModifyAllData',
        permissionsRequired: ['EditPublicReports', 'ManageDashboards'],
    },
    {
        name: 'BulkMacrosAllowed',
        objectsAccessRequired: [
            {
                object: 'Macro',
                allowCreate: 'false',
                allowDelete: 'false',
                allowEdit: 'false',
                allowRead: 'true',
                modifyAllRecords: 'false',
                viewAllRecords: 'false',
            },
        ],
    },
    {
        name: 'ManageSolutions',
        objectsAccessRequired: [
            {
                object: 'Solution',
                allowCreate: 'true',
                allowDelete: 'true',
                allowEdit: 'true',
                allowRead: 'true',
                modifyAllRecords: 'false',
                viewAllRecords: 'false',
            },
        ],
    },
    {
        name: 'ManageCssUsers',
        objectsAccessRequired: [
            {
                object: 'Contact',
                allowCreate: 'true',
                allowDelete: 'false',
                allowEdit: 'true',
                allowRead: 'true',
                modifyAllRecords: 'false',
                viewAllRecords: 'false',
            },
        ],
    },
    {
        name: 'TransferAnyCase',
        objectsAccessRequired: [
            {
                object: 'Case',
                allowCreate: 'true',
                allowDelete: 'false',
                allowEdit: 'false',
                allowRead: 'true',
                modifyAllRecords: 'false',
                viewAllRecords: 'false',
            },
        ],
    },
];

export default class UserPermissionBuilder {
    constructor() {}

    public addPermissionDependencies(profileOrPermissionSet: any) {
        let objectAccessRequired = [];
        for (let i = 0; i < userPermissionDependencies.length; i++) {
            let dependedPermission = userPermissionDependencies[i];
            if (profileOrPermissionSet.userPermissions != null && profileOrPermissionSet.userPermissions.length > 0) {
                for (let j = 0; j < profileOrPermissionSet.userPermissions.length; j++) {
                    let permission = profileOrPermissionSet.userPermissions[j];
                    if (permission.name == dependedPermission.name) {
                        objectAccessRequired.push(...dependedPermission.objectsAccessRequired);
                    }
                }
            }
        }
        if (objectAccessRequired.length > 0) {
            this.addRequiredObjectAccess(profileOrPermissionSet, this.mergeObjectAccess(objectAccessRequired));
        }
    }

    private mergeObjectAccess(objectAccessRequired: any[]) {
        let objectMapping = {};
        for (let i = 0; i < objectAccessRequired.length; i++) {
            let objectAccess = objectAccessRequired[i];
            if (objectMapping[objectAccess.object] != undefined) {
                //console.log('Adding access');
                this.addAccess(objectMapping[objectAccess.object], objectAccess);
            } else {
                //console.log('object access does not exists ');
                objectMapping[objectAccess.object] = objectAccess;
            }
        }
        return Object.values(objectMapping);
    }
    private addAccess(objectAccess1, ObjectAccess2) {
        objectAccess1.allowCreate = objectAccess1.allowCreate.toString() === 'true' ? true : ObjectAccess2.allowCreate;
        objectAccess1.allowDelete = objectAccess1.allowDelete.toString() === 'true' ? true : ObjectAccess2.allowDelete;
        objectAccess1.allowEdit = objectAccess1.allowEdit.toString() === 'true' ? true : ObjectAccess2.allowEdit;
        objectAccess1.allowRead = objectAccess1.allowRead.toString() === 'true' ? true : ObjectAccess2.allowRead;
        objectAccess1.modifyAllRecords =
            objectAccess1.modifyAllRecords.toString() === true ? true : ObjectAccess2.modifyAllRecords;
        objectAccess1.viewAllRecords =
            objectAccess1.viewAllRecords.toString() === 'true' ? true : ObjectAccess2.viewAllRecords;
    }
    private addRequiredObjectAccess(profileOrPermissionSet: any, objectAccessRequired: any) {
        if (
            profileOrPermissionSet.objectPermissions == null ||
            profileOrPermissionSet.objectPermissions == undefined ||
            !Array.isArray(profileOrPermissionSet.objectPermissions)
        ) {
            profileOrPermissionSet.objectPermissions = objectAccessRequired;
        } else {
            let objectAccesses = objectAccessRequired.filter((objectAccess) => {
                let exist = false;
                for (let i = 0; i < profileOrPermissionSet.objectPermissions.length; i++) {
                    let profileObjectAccess = profileOrPermissionSet.objectPermissions[i];
                    exist = profileObjectAccess.object == objectAccess.object;
                    if (exist) {
                        this.addAccess(profileObjectAccess, objectAccess);
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

    public handlePermissionDependency(
        profileOrPermissionSet: {
            objectPermissions?: ProfileObjectPermissions[];
            userPermissions?: ProfileUserPermission[];
        },
        supportedPermissions: string[]
    ): any {
        userPermissionDependencies.forEach((userPermission) => {
            let hasPermission = this.hasPermission(profileOrPermissionSet, userPermission.name);
            if (
                hasPermission &&
                userPermission.hasAccessOnData &&
                profileOrPermissionSet.objectPermissions !== undefined &&
                profileOrPermissionSet.objectPermissions.length > 0
            ) {
                for (let i = 0; i < profileOrPermissionSet.objectPermissions.length; i++) {
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
                    this.enablePermission(
                        profileOrPermissionSet,
                        userPermission.permissionsRequired[i],
                        supportedPermissions
                    );
                }
            }
        });
    }

    private enablePermission(
        profileObj: {
            objectPermissions?: ProfileObjectPermissions[];
            userPermissions?: ProfileUserPermission[];
        },
        permissionName: string,
        supportedPermission: string[]
    ) {
        let found = false;
        if (profileObj.userPermissions !== undefined && profileObj.userPermissions.length > 0) {
            for (let i = 0; i < profileObj.userPermissions.length; i++) {
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
            if (!_.isNil(supportedPermission) && supportedPermission.includes(permissionName)) {
                let permission = {
                    name: permissionName,
                    enabled: true,
                } as ProfileUserPermission;
                profileObj.userPermissions.push(permission);
            }
        }
    }

    private hasPermission(
        profileOrPermissionSet: {
            objectPermissions?: ProfileObjectPermissions[];
            userPermissions?: ProfileUserPermission[];
        },
        permissionName: string
    ): boolean {
        let found = false;
        if (!_.isNil(profileOrPermissionSet.userPermissions)) {
            for (let i = 0; i < profileOrPermissionSet.userPermissions.length; i++) {
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
