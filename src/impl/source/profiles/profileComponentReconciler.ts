import { Connection } from '@salesforce/core';
import { registry } from '@salesforce/source-deploy-retrieve';
import MetadataFiles from '../../../impl/metadata/metadataFiles';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';
import { Sfpowerkit } from '../../../sfpowerkit';
import UserPermissionBuilder from '../../metadata/builder/userPermissionBuilder';
import MetadataRetriever from '../../metadata/retriever/metadataRetriever';
import ProfileRetriever from '../../metadata/retriever/profileRetriever';
import Profile, { ProfileFieldLevelSecurity } from '../../metadata/schema';

export default class ProfileComponentReconciler {
    //rivate profileRetriever;

    public constructor(private conn: Connection, private isSourceOnly: boolean) {}

    public async reconcileProfileComponents(profileObj: Profile, profileName: string): Promise<Profile> {
        SFPLogger.log(`Reconciling App: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileApp(profileObj);
        SFPLogger.log(`Reconciling Classes: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileClasses(profileObj);
        SFPLogger.log(`Reconciling Fields: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileFields(profileObj);
        SFPLogger.log(`Reconciling Objects: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileObjects(profileObj);
        SFPLogger.log(`Reconciling Pages: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcilePages(profileObj);
        SFPLogger.log(`Reconciling Layouts: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileLayouts(profileObj);
        SFPLogger.log(`Reconciling Record Types: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileRecordTypes(profileObj);
        SFPLogger.log(`Reconciling  Tabs: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileTabs(profileObj);
        SFPLogger.log(`Reconciling  ExternalDataSources: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileExternalDataSource(profileObj);
        SFPLogger.log(`Reconciling  CustomPermissions: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileCustomPermission(profileObj);
        SFPLogger.log(`Reconciling  CustomMetadata: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileCustomMetadata(profileObj);
        SFPLogger.log(`Reconciling  CustomSettings: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileCustomSettings(profileObj);
        SFPLogger.log(`Reconciling  Flow: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileFlow(profileObj);
        SFPLogger.log(`Reconciling  Login Flows: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileLoginFlow(profileObj);
        SFPLogger.log(`Reconciling  User Licenses: ${profileName}`, LoggerLevel.DEBUG);
        await this.cleanupUserLicenses(profileObj);
        SFPLogger.log(`Reconciling  User Permissions: ${profileName}`, LoggerLevel.DEBUG);
        await this.reconcileUserPermissions(profileObj);

        SFPLogger.log(`All Components for ${profileName} reconciled`, LoggerLevel.DEBUG);
        return profileObj;
    }

    private async removeUserPermissionNotAvailableInOrg(profileObj: Profile, supportedPermissions: string[]) {
        if (profileObj.userPermissions !== undefined && profileObj.userPermissions.length > 0) {
            //Remove permission that are not present in the target org
            profileObj.userPermissions = profileObj.userPermissions.filter((permission) => {
                let supported = supportedPermissions.includes(permission.name);
                return supported;
            });
        }
    }

    private async removePermissionsBasedOnProjectConfig(profileObj: Profile) {
        let pluginConfig = await Sfpowerkit.getConfig();
        let ignorePermissions = pluginConfig.ignoredPermissions || [];
        if (profileObj.userPermissions !== undefined && profileObj.userPermissions.length > 0) {
            profileObj.userPermissions = profileObj.userPermissions.filter((permission) => {
                let supported = !ignorePermissions.includes(permission.name);
                return supported;
            });
        }
    }

    private removeUnsupportedUserPermissions(profileObj: Profile) {
        let profileRetriever;
        //if sourceonly mode load profileRetriever
        if (MetadataFiles.sourceOnly) {
            profileRetriever = new ProfileRetriever(null);
        } else {
            profileRetriever = new ProfileRetriever(this.conn);
        }
        let unsupportedLicencePermissions = profileRetriever.getUnsupportedLicencePermissions(profileObj.userLicense);
        if (profileObj.userPermissions != null && profileObj.userPermissions.length > 0) {
            profileObj.userPermissions = profileObj.userPermissions.filter((permission) => {
                let supported = !unsupportedLicencePermissions.includes(permission.name);
                return supported;
            });
        }
    }

    private async cleanupUserLicenses(profileObj: Profile) {
        if (!this.isSourceOnly) {
            //Manage licences
            let userLicenseRetriever = new MetadataRetriever(this.conn, 'UserLicense');
            const isSupportedLicence = await userLicenseRetriever.isComponentExistsInTheOrg(profileObj.userLicense);
            if (!isSupportedLicence) {
                delete profileObj.userLicense;
            }
        }
    }

    private async reconcileApp(profileObj: Profile): Promise<void> {
        let customApplications = new MetadataRetriever(this.conn, registry.types.customapplication.name);
        if (profileObj.applicationVisibilities !== undefined) {
            let validArray = [];
            for (let i = 0; i < profileObj.applicationVisibilities.length; i++) {
                let cmpObj = profileObj.applicationVisibilities[i];
                let exist = await customApplications.isComponentExistsInProjectDirectoryOrInOrg(cmpObj.application);
                if (exist) {
                    validArray.push(cmpObj);
                }
            }
            SFPLogger.log(
                `Application Visiblitilties reduced from ${profileObj.applicationVisibilities.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.applicationVisibilities = validArray;
        }
    }

    private async reconcileClasses(profileObj: Profile): Promise<void> {
        let apexClasses = new MetadataRetriever(this.conn, registry.types.apexclass.name);

        if (profileObj.classAccesses !== undefined) {
            if (!Array.isArray(profileObj.classAccesses)) {
                profileObj.classAccesses = [profileObj.classAccesses];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.classAccesses.length; i++) {
                let cmpObj = profileObj.classAccesses[i];
                let exists = await apexClasses.isComponentExistsInProjectDirectoryOrInOrg(cmpObj.apexClass);
                if (exists) {
                    validArray.push(cmpObj);
                }
            }

            SFPLogger.log(
                `Class Access reduced from ${profileObj.classAccesses.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.classAccesses = validArray;
        }
    }

    private async reconcileFields(profileObj: Profile): Promise<void> {
        if (profileObj.fieldPermissions) {
            if (!Array.isArray(profileObj.fieldPermissions)) {
                profileObj.fieldPermissions = [profileObj.fieldPermissions];
            }
            let validArray: ProfileFieldLevelSecurity[] = [];
            for (let i = 0; i < profileObj.fieldPermissions.length; i++) {
                let fieldRetriever = new MetadataRetriever(
                    this.conn,
                    registry.types.customobject.children.types.customfield.name
                );
                let cmpObj = profileObj.fieldPermissions[i];
                let parent = cmpObj.field.split('.')[0];
                let exists = await fieldRetriever.isComponentExistsInProjectDirectoryOrInOrg(cmpObj.field, parent);
                if (exists) {
                    validArray.push(cmpObj);
                }
            }
            SFPLogger.log(
                `Fields Level Permissions reduced from ${profileObj.fieldPermissions.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.fieldPermissions = validArray;
        }
    }

    private async reconcileLayouts(profileObj: Profile): Promise<void> {
        let layoutRetreiver = new MetadataRetriever(this.conn, registry.types.layout.name);
        let recordTypeRetriever = new MetadataRetriever(
            this.conn,
            registry.types.customobject.children.types.recordtype.name
        );

        if (profileObj.layoutAssignments !== undefined) {
            let validArray = [];
            for (let count = 0; count < profileObj.layoutAssignments.length; count++) {
                let cmpObj = profileObj.layoutAssignments[count];
                let exist =
                    (await layoutRetreiver.isComponentExistsInProjectDirectoryOrInOrg(cmpObj.layout)) &&
                    (cmpObj.recordType == null ||
                        cmpObj.recordType == undefined ||
                        (await recordTypeRetriever.isComponentExistsInProjectDirectoryOrInOrg(cmpObj.recordType)));
                if (exist) {
                    validArray.push(cmpObj);
                }
            }
            SFPLogger.log(
                `Layout Assignnments reduced from ${profileObj.layoutAssignments.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.layoutAssignments = validArray;
        }
    }

    private async reconcileObjects(profileObj: Profile): Promise<void> {
        let objectPermissionRetriever = new MetadataRetriever(this.conn, 'ObjectPermissions');
        let objectRetriever = new MetadataRetriever(this.conn, registry.types.customobject.name);

        if (profileObj.objectPermissions !== undefined) {
            if (!Array.isArray(profileObj.objectPermissions)) {
                profileObj.objectPermissions = [profileObj.objectPermissions];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.objectPermissions.length; i++) {
                let cmpObj = profileObj.objectPermissions[i];

                //Check Object exist in Source Directory
                let exist = await objectRetriever.isComponentExistsInProjectDirectory(cmpObj.object);
                if (!exist) exist = await objectPermissionRetriever.isComponentExistsInTheOrg(cmpObj.object);

                if (exist) {
                    validArray.push(cmpObj);
                }
            }
            SFPLogger.log(
                `Object Permissions reduced from ${profileObj.objectPermissions.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.objectPermissions = validArray;
        }
    }

    private async reconcileCustomMetadata(profileObj: Profile): Promise<void> {
        let objectRetriever = new MetadataRetriever(this.conn, registry.types.customobject.name);

        if (profileObj.customMetadataTypeAccesses !== undefined) {
            if (!Array.isArray(profileObj.customMetadataTypeAccesses)) {
                profileObj.customMetadataTypeAccesses = [profileObj.customMetadataTypeAccesses];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.customMetadataTypeAccesses.length; i++) {
                let cmpCM = profileObj.customMetadataTypeAccesses[i];
                let exist = await objectRetriever.isComponentExistsInProjectDirectoryOrInOrg(cmpCM.name);
                if (exist) {
                    validArray.push(cmpCM);
                }
            }
            SFPLogger.log(
                `CustomMetadata Access reduced from ${profileObj.customMetadataTypeAccesses.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.customMetadataTypeAccesses = validArray;
        }
    }

    private async reconcileCustomSettings(profileObj: Profile): Promise<void> {
        let objectRetriever = new MetadataRetriever(this.conn, registry.types.customobject.name);

        if (profileObj.customSettingAccesses !== undefined) {
            if (!Array.isArray(profileObj.customSettingAccesses)) {
                profileObj.customSettingAccesses = [profileObj.customSettingAccesses];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.customSettingAccesses.length; i++) {
                let cmpCS = profileObj.customSettingAccesses[i];
                let exist = await objectRetriever.isComponentExistsInProjectDirectoryOrInOrg(cmpCS.name);
                if (exist) {
                    validArray.push(cmpCS);
                }
            }
            SFPLogger.log(
                `CustomSettings Access reduced from ${profileObj.customSettingAccesses.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.customSettingAccesses = validArray;
        }
    }

    private async reconcileExternalDataSource(profileObj: Profile): Promise<void> {
        let externalDataSourceRetriever = new MetadataRetriever(this.conn, registry.types.externaldatasource.name);

        if (profileObj.externalDataSourceAccesses !== undefined) {
            if (!Array.isArray(profileObj.externalDataSourceAccesses)) {
                profileObj.externalDataSourceAccesses = [profileObj.externalDataSourceAccesses];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.externalDataSourceAccesses.length; i++) {
                let dts = profileObj.externalDataSourceAccesses[i];
                let exist = await externalDataSourceRetriever.isComponentExistsInProjectDirectoryOrInOrg(
                    dts.externalDataSource
                );
                if (exist) {
                    validArray.push(dts);
                }
            }
            SFPLogger.log(
                `ExternalDataSource Access reduced from ${profileObj.externalDataSourceAccesses.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.externalDataSourceAccesses = validArray;
        }
    }

    private async reconcileFlow(profileObj: Profile): Promise<void> {
        let flowRetreiver = new MetadataRetriever(this.conn, registry.types.flow.name);

        if (profileObj.flowAccesses !== undefined) {
            if (!Array.isArray(profileObj.flowAccesses)) {
                profileObj.flowAccesses = [profileObj.flowAccesses];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.flowAccesses.length; i++) {
                let flow = profileObj.flowAccesses[i];
                let exist = await flowRetreiver.isComponentExistsInProjectDirectoryOrInOrg(flow.flow);
                if (exist) {
                    validArray.push(flow);
                }
            }
            SFPLogger.log(
                `Flow Access reduced from ${profileObj.flowAccesses.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.flowAccesses = validArray;
        }
    }

    private async reconcileLoginFlow(profileObj: Profile): Promise<void> {
        let apexPageRetriver = new MetadataRetriever(this.conn, registry.types.apexpage.name);

        let flowRetreiver = new MetadataRetriever(this.conn, registry.types.flow.name);

        if (profileObj.loginFlows !== undefined) {
            if (!Array.isArray(profileObj.loginFlows)) {
                profileObj.loginFlows = [profileObj.loginFlows];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.loginFlows.length; i++) {
                let loginFlow = profileObj.loginFlows[i];
                if (loginFlow.flow !== undefined) {
                    let exist = await flowRetreiver.isComponentExistsInProjectDirectoryOrInOrg(loginFlow.flow);
                    if (exist) {
                        validArray.push(loginFlow);
                    }
                } else if (loginFlow.vfFlowPage !== undefined) {
                    let exist = await apexPageRetriver.isComponentExistsInProjectDirectoryOrInOrg(loginFlow.vfFlowPage);
                    if (exist) {
                        validArray.push(loginFlow);
                    }
                }
            }
            SFPLogger.log(
                `LoginFlows reduced from ${profileObj.loginFlows.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.loginFlows = validArray;
        }
    }

    private async reconcileCustomPermission(profileObj: Profile): Promise<void> {
        let customPermissionsRetriever = new MetadataRetriever(this.conn, registry.types.custompermission.name);

        if (profileObj.customPermissions !== undefined) {
            if (!Array.isArray(profileObj.customPermissions)) {
                profileObj.customPermissions = [profileObj.customPermissions];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.customPermissions.length; i++) {
                let customPermission = profileObj.customPermissions[i];
                let exist = await customPermissionsRetriever.isComponentExistsInProjectDirectoryOrInOrg(
                    customPermission.name
                );
                if (exist) {
                    validArray.push(customPermission);
                }
            }
            SFPLogger.log(
                `CustomPermission reduced from ${profileObj.customPermissions.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.customPermissions = validArray;
        }
    }

    private async reconcilePages(profileObj: Profile): Promise<void> {
        let apexPageRetriver = new MetadataRetriever(this.conn, registry.types.apexpage.name);

        if (profileObj.pageAccesses !== undefined) {
            if (!Array.isArray(profileObj.pageAccesses)) {
                profileObj.pageAccesses = [profileObj.pageAccesses];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.pageAccesses.length; i++) {
                let cmpObj = profileObj.pageAccesses[i];
                let exist = await apexPageRetriver.isComponentExistsInProjectDirectoryOrInOrg(cmpObj.apexPage);
                if (exist) {
                    validArray.push(cmpObj);
                }
            }
            SFPLogger.log(
                `Page Access Permissions reduced from ${profileObj.pageAccesses.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.pageAccesses = validArray;
        }
    }

    private async reconcileRecordTypes(profileObj: Profile): Promise<void> {
        let recordTypeRetriever = new MetadataRetriever(
            this.conn,
            registry.types.customobject.children.types.recordtype.name
        );

        if (profileObj.recordTypeVisibilities !== undefined) {
            if (!Array.isArray(profileObj.recordTypeVisibilities)) {
                profileObj.recordTypeVisibilities = [profileObj.recordTypeVisibilities];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.recordTypeVisibilities.length; i++) {
                let cmpObj = profileObj.recordTypeVisibilities[i];
                let exist = await recordTypeRetriever.isComponentExistsInProjectDirectoryOrInOrg(cmpObj.recordType);
                if (exist) {
                    validArray.push(cmpObj);
                }
            }
            SFPLogger.log(
                `Record Type Visibilities reduced from ${profileObj.recordTypeVisibilities.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.recordTypeVisibilities = validArray;
        }
    }

    private async reconcileTabs(profileObj: Profile): Promise<void> {
        let tabRetriever = new MetadataRetriever(this.conn, registry.types.customtab.name);

        if (profileObj.tabVisibilities !== undefined) {
            if (!Array.isArray(profileObj.tabVisibilities)) {
                profileObj.tabVisibilities = [profileObj.tabVisibilities];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.tabVisibilities.length; i++) {
                let cmpObj = profileObj.tabVisibilities[i];
                let exist = await tabRetriever.isComponentExistsInProjectDirectoryOrInOrg(cmpObj.tab);
                if (exist) {
                    validArray.push(cmpObj);
                }
            }
            SFPLogger.log(
                `Tab Visibilities reduced from ${profileObj.tabVisibilities.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.tabVisibilities = validArray;
        }
    }

    private async fetchPermissions() {
        let permissionRetriever = new MetadataRetriever(this.conn, 'UserPermissions');
        let permissionSets = await permissionRetriever.getComponents();
        let supportedPermissions = permissionSets.map((elem) => {
            return elem.fullName;
        });
        return supportedPermissions;
    }

    private async reconcileUserPermissions(profileObj: Profile) {
        if (profileObj.userPermissions == null || profileObj.userPermissions.length === 0) {
            return;
        }

        //Delete all user Permissions if the profile is standard one
        let isCustom = profileObj.custom;
        if (!isCustom) {
            delete profileObj.userPermissions;
            return;
        }

        //Remove unsupported userPermission
        this.removeUnsupportedUserPermissions(profileObj);

        SFPLogger.log('Removed Unsupported User Pemrmisions ', LoggerLevel.TRACE);
        let userPermissionBuilder: UserPermissionBuilder = new UserPermissionBuilder();
        //IS sourceonly, use ignorePermission set in sfdxProject.json file
        if (MetadataFiles.sourceOnly) {
            await this.removePermissionsBasedOnProjectConfig(profileObj);

            await userPermissionBuilder.handlePermissionDependency(profileObj, []);
        } else {
            let supportedPermissions = await this.fetchPermissions();
            await this.removeUserPermissionNotAvailableInOrg(profileObj, supportedPermissions);

            await userPermissionBuilder.handlePermissionDependency(profileObj, supportedPermissions);
        }
    }
}
