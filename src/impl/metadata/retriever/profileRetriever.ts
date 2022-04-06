/* eslint-disable @typescript-eslint/no-array-constructor */
import Profile, { ProfileObjectPermissions, ProfileUserPermission } from '../schema';
import { Connection } from 'jsforce';
import { MetadataInfo } from 'jsforce';
import * as _ from 'lodash';
import MetadataRetriever from './metadataRetriever';
import QueryExecutor from '../../../utils/queryExecutor';
import MetadataOperation from '../../../utils/metadataOperation';

const unsuportedObjects = ['PersonAccount'];
/**
 *
 * Used to track Unsupported Userpermission per Licence
 * Update this list when Salesforce change supported permission per licence
 */
const userLicenceMap = [
    {
        name: 'Guest User License',
        unsupportedPermissions: ['PasswordNeverExpires'],
    },
];

export default class ProfileRetriever {
    static supportedMetadataTypes = [
        'ApexClass',
        'CustomApplication',
        'CustomObject',
        'CustomField',
        'Layout',
        'ApexPage',
        'CustomTab',
        'RecordType',
        'SystemPermissions',
    ];

    public constructor(private conn: Connection) {}

    public async loadProfiles(profileNames: string[]): Promise<MetadataInfo[]> {
        let profilePermissions = await this.fetchPermissionsWithValue(profileNames);

        let profiles = (await this.conn.metadata.readSync('Profile', profileNames)) as any;
        if (Array.isArray(profiles)) {
            for (let i = 0; i < profiles.length; i++) {
                await this.handlePermissions(profiles[i], profilePermissions);
                profiles[i] = await this.completeObjects(profiles[i], false);
            }
            return profiles;
        } else if (profiles !== null) {
            await this.handlePermissions(profiles, profilePermissions);
            profiles = await this.completeObjects(profiles, false);
            return [profiles];
        } else {
            return [];
        }
    }

    public async handlePermissions(profileObj: Profile, permissions): Promise<Profile> {
        await this.handleViewAllDataPermission(profileObj);
        await this.handleInstallPackagingPermission(profileObj);

        this.handleQueryAllFilesPermission(profileObj);

        //Check if the permission QueryAllFiles is true and give read access to objects
        profileObj = await this.completeUserPermissions(profileObj, permissions);

        return profileObj;
    }

    private async completeUserPermissions(profileObj: Profile, profilePermissions): Promise<Profile> {
        let supportedPermissions = await this.fetchPermissions();
        // remove unsupported userLicence
        let unsupportedLicencePermissions = this.getUnsupportedLicencePermissions(profileObj.userLicense);
        if (profileObj.userPermissions != null && profileObj.userPermissions.length > 0) {
            profileObj.userPermissions = profileObj.userPermissions.filter((permission) => {
                let supported = !unsupportedLicencePermissions.includes(permission.name);
                return supported;
            });
        }

        let notRetrievedPermissions = supportedPermissions.filter((permission) => {
            let found = null;
            if (profileObj.userPermissions != null && profileObj.userPermissions.length > 0) {
                found = profileObj.userPermissions.find((element) => {
                    return element.name === permission;
                });
            }
            return found === null || found === undefined;
        });

        let isCustom = '' + profileObj.custom;

        if (isCustom == 'false') {
            //Remove System permission for standard profile as Salesforce does not support edition on those profile
            delete profileObj.userPermissions;
        } else {
            for (let i = 0; i < notRetrievedPermissions.length; i++) {
                let profileName = decodeURIComponent(profileObj.fullName);
                let profilePermission = profilePermissions.find((record) => {
                    return record.Name == profileName;
                });
                let permissionField = 'Permissions' + notRetrievedPermissions[i];
                let permissionValue = false;
                if (profilePermission) {
                    permissionValue = profilePermission[permissionField];
                    if (permissionValue == undefined) {
                        permissionValue = false;
                    }
                }
                let newPermission: ProfileUserPermission = {
                    enabled: permissionValue,
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
            for (let i = 0; i < profileObj.userPermissions.length; i++) {
                let element = profileObj.userPermissions[i];
                if (element.name === permissionName) {
                    found = element.enabled;
                    break;
                }
            }
        }
        return found;
    }

    private async completeObjects(profileObj: Profile, access = true): Promise<Profile> {
        let objPerm = ProfileRetriever.filterObjects(profileObj);
        if (objPerm === undefined) {
            objPerm = new Array();
        } else if (!Array.isArray(objPerm)) {
            objPerm = [objPerm];
        }

        let objectPermissionsRetriever = new MetadataRetriever(this.conn, 'ObjectPermissions');
        let objectPermissions = await objectPermissionsRetriever.getComponents();

        objectPermissions.forEach((obj) => {
            let name = obj.fullName;
            if (unsuportedObjects.includes(name)) {
                return;
            }
            let objectIsPresent = false;

            for (let i = 0; i < objPerm.length; i++) {
                if (objPerm[i].object === name) {
                    objectIsPresent = true;
                    break;
                } else {
                    objectIsPresent = false;
                }
            }

            if (objectIsPresent === false) {
                let objToInsert = ProfileRetriever.buildObjPermArray(name, access);
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

    private static buildObjPermArray(objectName: string, access = true): ProfileObjectPermissions {
        let newObjPerm = {
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

    private static filterObjects(profileObj: Profile): ProfileObjectPermissions[] {
        return profileObj.objectPermissions;
    }

    private async enablePermission(profileObj: Profile, permissionName: string) {
        let found = false;
        if (profileObj.userPermissions !== null && profileObj.userPermissions.length > 0) {
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
            if (profileObj.userPermissions === null || profileObj.userPermissions === undefined) {
                profileObj.userPermissions = [];
            }

            let supportedPermissions = await this.fetchPermissions();
            if (supportedPermissions.includes(permissionName)) {
                let permission = {
                    name: permissionName,
                    enabled: true,
                } as ProfileUserPermission;
                profileObj.userPermissions.push(permission);
            }
        }
    }

    private handleQueryAllFilesPermission(profileObj: Profile) {
        let isQueryAllFilesPermission = this.hasPermission(profileObj, 'QueryAllFiles');
        if (
            isQueryAllFilesPermission &&
            profileObj.objectPermissions !== undefined &&
            profileObj.objectPermissions.length > 0
        ) {
            for (let i = 0; i < profileObj.objectPermissions.length; i++) {
                profileObj.objectPermissions[i].allowRead = true;
                profileObj.objectPermissions[i].viewAllRecords = true;
            }
        }
    }

    private async handleViewAllDataPermission(profileObj: Profile): Promise<void> {
        let isViewAllData = this.hasPermission(profileObj, 'ViewAllData');
        if (isViewAllData && profileObj.objectPermissions !== undefined && profileObj.objectPermissions.length > 0) {
            for (let i = 0; i < profileObj.objectPermissions.length; i++) {
                profileObj.objectPermissions[i].allowRead = true;
                profileObj.objectPermissions[i].viewAllRecords = true;
            }
        }
        if (isViewAllData) {
            await this.enablePermission(profileObj, 'ViewPlatformEvents');
            await this.enablePermission(profileObj, 'ViewDataLeakageEvents');
        }
    }

    private async handleInstallPackagingPermission(profileObj: Profile): Promise<void> {
        let hasPermission = this.hasPermission(profileObj, 'InstallPackaging');
        if (hasPermission) {
            await this.enablePermission(profileObj, 'ViewDataLeakageEvents');
        }
    }

    public getUnsupportedLicencePermissions(licence: string): any {
        if (!_.isNil(licence)) {
            for (let i = 0; i < userLicenceMap.length; i++) {
                if (userLicenceMap[i].name.trim().toLocaleLowerCase() === licence.trim().toLocaleLowerCase()) {
                    return userLicenceMap[i].unsupportedPermissions;
                }
            }
        }
        return [];
    }

    private async fetchPermissions() {
        let permissionRetriever = new MetadataRetriever(this.conn, 'UserPermissions');
        let permissionSets = await permissionRetriever.getComponents();
        let supportedPermissions = permissionSets.map((elem) => {
            return elem.fullName;
        });
        return supportedPermissions;
    }

    private async fetchPermissionsWithValue(profileNames: string[]) {
        let describeResult = await new MetadataOperation(this.conn).describeAnObject('Profile');
        let permissions = [];
        describeResult.fields.forEach((field) => {
            let fieldName = field['name'] as string;
            if (fieldName.startsWith('Permissions')) {
                permissions.push(fieldName.trim());
            }
        });
        let permissionStr = permissions.join(', ');
        let query = `SELECT Name, ${permissionStr} FROM Profile WHERE Name IN ('${profileNames.join("','")}')`;
        query = decodeURIComponent(query);
        let executor = new QueryExecutor(this.conn);
        let profiles = await executor.executeQuery(query, false);
        return profiles;
    }
}
