export interface BaseObject {
    Id: string;
    Name?: string;
    DeveloperName?: string;
    SobjectType?: string;
    FullName?: string;
    NamespacePrefix?: string;
    ManageableState?: string;
    attributes?: {
        type: string;
        url: string;
    };
}

export interface RecordType extends BaseObject {
    Description?: string;
    IsActive?: boolean;
    IsPersonType?: boolean;
    BusinessProcessId?: string;
}

export interface EntityDefinition extends BaseObject {
    DurableId?: string;
    QualifiedApiName?: string;
}

export interface Layout extends BaseObject {
    ObjectName?: string;
    EntityDefinitionId?: string;
    EntityDefinition?: EntityDefinition;
}

export interface ValidationRule extends BaseObject {
    ValidationName: string;
    EntityDefinitionId?: string;
    ObjectName?: string;
    Description?: string;
}

export interface WebLink extends BaseObject {
    PageOrSObjectType?: string;
}

export interface ListView extends BaseObject {}
export interface ExternalDataSource extends BaseObject {}
export interface Flow extends BaseObject {}
export interface CustomPermission extends BaseObject {
    MasterLabel: string;
}

export interface BusinessProcess extends BaseObject {
    TableEnumOrId?: string;
    ObjectName?: string;
    Description?: string;
}

export interface CompactLayout extends BaseObject {}

export interface CustomMetadata extends BaseObject {
    MasterLabel: string;
    Language: string;
    Label: string;
    QualifiedApiName: string;
}
export interface Group extends BaseObject {
    Type: string;
    RelatedId: string;
}
export interface Role extends BaseObject {
    ParentRoleId: string;
}
export interface Folder extends BaseObject {
    ParentId: string;
    AccessType: string;
    Type: string;
    AbsolutePath: string;
    Parent: Folder;
}

export interface Report extends BaseObject {
    Folder: Folder;
    FolderName: string;
    AbsolutePath: string;
}
export interface Dashboard extends Report {
    FolderId: Folder;
    Type: string;
}

export interface Field extends EntityDefinition {}
export interface ProfileTooling extends BaseObject {
    UserType?: string;
    IsSsoEnabled?: boolean;
    PermissionSetId?: string;
}
export interface PermissionSetTooling extends BaseObject {
    Profile?: ProfileTooling;
    Label?: string;
    IsOwnedByProfile?: boolean;
    IsCustom?: boolean;
    Type?: boolean;
}

export interface TabDefinition extends BaseObject {
    DurableId: string;
    Label?: string;
    SobjectName?: string;
    IsCustom?: boolean;
}
export interface CustomApplication extends BaseObject {
    UiType: string;
    NavType?: string;
    Label?: string;
    IsNavPersonalizationDisabled?: boolean;
    IsNavAutoTempTabsDisabled?: boolean;
}
export interface ApexClass extends BaseObject {}
export interface ApexPage extends BaseObject {}
export interface UserLicence {
    Id: string;
    Name: string;
    LicenseDefinitionKey: string;
}

export interface ProfileSObject {
    Id: string;
    Name: string;
}

export interface PermissionSetSObject {
    Id: string;
    Name: string;
    Label: string;
    Profile: ProfileSObject;
}

export default interface Profile {
    applicationVisibilities?: ApplicationVisibility[];
    classAccesses?: ProfileApexClassAccess[];
    custom: boolean;
    customPermissions?: ProfileCustomPermissions[];
    customMetadataTypeAccesses?: CustomMetadataTypeAccess[];
    customSettingAccesses?: CustomSettingAccess[];
    description?: string;
    externalDataSourceAccesses?: ProfileExternalDataSourceAccess[];
    fieldLevelSecurities?: ProfileFieldLevelSecurity[];
    fieldPermissions?: ProfileFieldLevelSecurity[];
    flowAccesses?: FlowAccess[];
    fullName?: string;
    layoutAssignments?: ProfileLayoutAssignments[];
    loginFlows?: ProfileLoginFlows[];
    loginHours?: ProfileLoginHours[];
    loginIpRanges?: ProfileLoginIpRange[];
    objectPermissions?: ProfileObjectPermissions[];
    pageAccesses?: ProfileApexPageAccess[];
    profileActionOverrides?: ProfileActionOverride[];
    recordTypeVisibilities?: RecordTypeVisibility[];
    tabVisibilities?: ProfileTabVisibility[];
    userLicense: string;
    userPermissions?: ProfileUserPermission[];
}

export interface ApplicationVisibility {
    application: string;
    visible: boolean;
    default?: boolean;
}

export interface ProfileApexClassAccess {
    apexClass: string;
    enabled: boolean;
}

export interface ProfileCustomPermissions {
    name: string;
    enabled: boolean;
}

export interface FlowAccess {
    flow: string;
    enabled: boolean;
}
export interface CustomMetadataTypeAccess {
    name: string;
    enabled: boolean;
}

export interface CustomSettingAccess {
    name: string;
    enabled: boolean;
}

export interface ProfileExternalDataSourceAccess {
    externalDataSource: string;
    enabled: boolean;
}

export interface ProfileFieldLevelSecurity {
    field: string;
    editable: boolean;
    readable: boolean;
    hidden?: boolean;
}
export interface ProfileLayoutAssignments {
    layout: string;
    recordType: string;
}
export interface ProfileLoginHours {
    weekdayStart: string;
    weekdayEnd: string;
}
export interface ProfileLoginFlows {
    flow: string;
    flowType: string;
    friendlyName: string;
    uiLoginFlowType: string;
    useLightningRuntime: string;
    vfFlowPage: string;
    vfFlowPageTitle: string;
}
export interface ProfileLoginIpRange {
    description: string;
    endAddress: string;
    startAddress: string;
}

export interface ProfileObjectPermissions {
    object: string;
    allowCreate: boolean;
    allowDelete: boolean;
    allowEdit: boolean;
    allowRead: boolean;
    modifyAllRecords: boolean;
    viewAllRecords: boolean;
}
export interface ProfileActionOverride {
    actionName: string;
    content: string;
    formFactor: FormFactor;
    pageOrSobjectType: string;
    recordType: string;
    type: ActionOverrideType;
}

export enum FormFactor {
    Large = 'Large',
    Small = 'Small',
    Medium = 'Medium',
}
export enum ActionOverrideType {
    default = 'default',
    flexipage = 'flexipage',
    lightningcomponent = 'lightningcomponent',
    scontrol = 'scontrol',
    standard = 'standard',
    visualforce = 'visualforce',
}

export interface ProfileApexPageAccess {
    apexPage: string;
    enabled: boolean;
}

export interface RecordTypeVisibility {
    recordType: string;
    visible: boolean;
    personAccountDefault?: boolean;
    default?: boolean;
}

export interface ProfileTabVisibility {
    tab: string;
    visibility: TabVisibility;
}

export enum TabVisibility {
    DefaultOff = 'DefaultOff',
    DefaultOn = 'DefaultOn',
    Hidden = 'Hidden',
}

export interface ProfileUserPermission {
    name: string;
    enabled: boolean;
}

export default interface PermissionSet {
    applicationVisibilities?: ApplicationVisibility[];
    classAccesses?: PermissionSetApexClassAccess[];
    customPermissions?: PermissionSetCustomPermissions[];
    description?: string;
    externalDataSourceAccesses?: PermissionSetExternalDataSourceAccess[];
    fieldPermissions?: ProfileFieldLevelSecurity[];
    hasActivationRequired?: boolean;
    label?: string;
    license?: string;
    objectPermissions?: PermissionSetObjectPermissions[];
    pageAccesses?: PermissionSetApexPageAccess[];
    recordTypeVisibilities?: RecordTypeVisibility[];
    tabSettings?: PermissionSetTabSetting[];
    userPermissions?: PermissionSetUserPermission[];
}

export interface PermissionSetApexClassAccess {
    apexClass: string;
    enabled: boolean;
}

export interface PermissionSetCustomPermissions {
    name: string;
    enabled: boolean;
}

export interface PermissionSetExternalDataSourceAccess {
    externalDataSource: string;
    enabled: boolean;
}

export interface PermissionSetObjectPermissions {
    object: string;
    allowCreate: boolean;
    allowDelete: boolean;
    allowEdit: boolean;
    allowRead: boolean;
    modifyAllRecords: boolean;
    viewAllRecords: boolean;
}

export interface PermissionSetApexPageAccess {
    apexPage: string;
    enabled: boolean;
}

export interface PermissionSetTabSetting {
    tab: string;
    visibility: PermissionSetTabVisibility;
}

export enum PermissionSetTabVisibility {
    Available = 'Available',
    None = 'None',
    Visible = 'Visible',
}

export interface PermissionSetUserPermission {
    name: string;
    enabled: boolean;
}

export interface FileProperties {
    type: string;
    createdById: string;
    createdByName: string;
    createdDate: string;
    fileName: string;
    fullName: string;
    id: string;
    lastModifiedById: string;
    lastModifiedByName: string;
    lastModifiedDate: string;
    manageableState?: string;
    namespacePrefix?: string;
}
