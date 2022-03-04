import * as _ from 'lodash';
import * as path from 'path';
import * as fs from 'fs-extra';

export const SOURCE_EXTENSION_REGEX = /\.[a-zA-Z]+-meta\.xml/;
const SPLITED_TYPES = {
    CustomField: {
        suffix: 'field',
        folder: 'fields',
    },
    BusinessProcess: {
        suffix: 'businessProcess',
        folder: 'businessProcesses',
    },
    CompactLayout: {
        suffix: 'compactLayout',
        folder: 'compactLayouts',
    },
    FieldSet: {
        suffix: 'fieldSet',
        folder: 'fieldSets',
    },
    RecordType: {
        suffix: 'recordType',
        folder: 'recordTypes',
    },
    ListView: {
        suffix: 'listView',
        folder: 'listViews',
    },
    SharingReason: {
        suffix: 'sharingReason',
        folder: 'sharingReasons',
    },
    ValidationRule: {
        suffix: 'validationRule',
        folder: 'validationRules',
    },
    WebLink: {
        suffix: 'webLink',
        folder: 'webLinks',
    },
};

export interface MetadataDescribe {
    directoryName?: string;
    inFolder?: boolean;
    metaFile?: boolean;
    suffix?: string;
    xmlName?: string;
    sourceExtension?: string;
    childXmlNames?: string[];
    folderExtension?: string;
    files?: string[];
    components?: string[];
    isChildComponent?: boolean;
}

export interface MetadataInfo {
    CustomApplication?: MetadataDescribe;
    ApexClass?: MetadataDescribe;
    ApexPage?: MetadataDescribe;
    CustomField?: MetadataDescribe;
    CustomObject?: MetadataDescribe;
    CustomPermission?: MetadataDescribe;
    ExternalDataSource?: MetadataDescribe;
    ExperienceBundle?: MetadataDescribe;
    Flow?: MetadataDescribe;
    RecordType?: MetadataDescribe;
    ListView?: MetadataDescribe;
    WebLink?: MetadataDescribe;
    ValidationRule?: MetadataDescribe;
    CompactLayout?: MetadataDescribe;
    BujsinessProcess?: MetadataDescribe;
    CustomTab?: MetadataDescribe;
    Layout?: MetadataDescribe;
    Profile?: MetadataDescribe;
    Translations?: MetadataDescribe;
    CustomLabel?: MetadataDescribe;
    CustomLabels?: MetadataDescribe;
    GlobalValueSet?: MetadataDescribe;
    CustomMetadata?: MetadataDescribe;
    Document?: MetadataDescribe;
    Queue?: MetadataDescribe;
    Group?: MetadataDescribe;
    Role?: MetadataDescribe;
    Report?: MetadataDescribe;
    Dashboard?: MetadataDescribe;
    EmailTemplate?: MetadataDescribe;
    CustomSite?: MetadataDescribe;
    PermissionSet?: MetadataDescribe;
    StaticResource?: MetadataDescribe;
    CustomObjectTranslation?: MetadataDescribe;
    AuraDefinitionBundle?: MetadataDescribe;
    Workflow?: MetadataDescribe;
    SharingRules?: MetadataDescribe;
    LightningComponentBundle?: MetadataDescribe;
}

export class MetadataInfo {
    static loadMetadataInfo(): MetadataInfo {
        let metadataInfo: MetadataInfo = {};
        let resourcePath = path.join(__dirname, '..', '..', '..', 'resources', 'metadatainfo.json');
        const fileData = fs.readFileSync(resourcePath, 'utf8');
        let metadataInfoJSON = JSON.parse(fileData);
        metadataInfoJSON.metadataObjects.forEach((metadata) => {
            let metadataDescribe = metadata as MetadataDescribe;
            if (_.isNil(metadata.suffix)) {
                if (metadata.xmlName === 'AuraDefinitionBundle') {
                    metadata.suffix = 'cmp';
                    metadataDescribe.suffix = 'cmp';
                } else if (metadata.xmlName == 'LightningComponentBundle') {
                    metadata.suffix = 'js';
                    metadataDescribe.suffix = 'js';
                }
            }
            metadataDescribe.sourceExtension = `.${metadata.suffix}-meta.xml`;
            if (metadata.inFolder) {
                let folderExtensionPrefix = metadata.suffix;
                if (_.isNil(metadata.suffix)) {
                    folderExtensionPrefix = metadata.xmlName.charAt(0).toLowerCase + metadata.xmlName.slice(1);
                }
                metadataDescribe.folderExtension = `.${folderExtensionPrefix}Folder-meta.xml`;
            }

            //Generate Describe of cheildItems if exists
            if (!_.isNil(metadata.childXmlNames)) {
                metadata.childXmlNames.forEach((element) => {
                    let splitedElement = SPLITED_TYPES[element];
                    if (!_.isNil(splitedElement)) {
                        let childDescribe: MetadataDescribe = {};
                        childDescribe.directoryName = SPLITED_TYPES[element].folder;
                        childDescribe.suffix = SPLITED_TYPES[element].suffix;
                        childDescribe.xmlName = element;
                        childDescribe.inFolder = false;
                        childDescribe.metaFile = false;
                        childDescribe.isChildComponent = true;
                        childDescribe.sourceExtension = `.${SPLITED_TYPES[element].suffix}-meta.xml`;
                        metadataInfo[childDescribe.xmlName] = childDescribe;
                    }
                });
            }
            metadataInfo[metadataDescribe.xmlName] = metadataDescribe;
        });
        return metadataInfo;
    }

    static getMetadataName(metadataFile: string, validateSourceExtension = true): string {
        let matcher = metadataFile.match(SOURCE_EXTENSION_REGEX);
        let extension = '';
        if (matcher) {
            extension = matcher[0];
        } else {
            extension = path.parse(metadataFile).ext;
        }
        //SfPowerKit.ux.log(extension);
        let metadataName = '';

        const auraRegExp = new RegExp('aura');
        const lwcRegExp = new RegExp('lwc');
        const staticResourceRegExp = new RegExp('staticresources');
        const experienceBundleRegExp = new RegExp('experiences');
        const documentRegExp = new RegExp('documents');
        if (auraRegExp.test(metadataFile) && (SOURCE_EXTENSION_REGEX.test(metadataFile) || !validateSourceExtension)) {
            metadataName = METADATA_INFO.AuraDefinitionBundle.xmlName;
        } else if (
            lwcRegExp.test(metadataFile) &&
            (SOURCE_EXTENSION_REGEX.test(metadataFile) || !validateSourceExtension)
        ) {
            metadataName = METADATA_INFO.LightningComponentBundle.xmlName;
        } else if (
            staticResourceRegExp.test(metadataFile) &&
            (SOURCE_EXTENSION_REGEX.test(metadataFile) || !validateSourceExtension)
        ) {
            metadataName = METADATA_INFO.StaticResource.xmlName;
        } else if (
            experienceBundleRegExp.test(metadataFile) &&
            (SOURCE_EXTENSION_REGEX.test(metadataFile) || !validateSourceExtension)
        ) {
            metadataName = METADATA_INFO.ExperienceBundle.xmlName;
        } else if (
            documentRegExp.test(metadataFile) &&
            (SOURCE_EXTENSION_REGEX.test(metadataFile) || !validateSourceExtension)
        ) {
            metadataName = METADATA_INFO.Document.xmlName;
        } else {
            let keys = Object.keys(METADATA_INFO);
            for (let i = 0; i < keys.length; i++) {
                let metaDescribe = METADATA_INFO[keys[i]];
                if (
                    metaDescribe.sourceExtension === extension ||
                    ('.' + metaDescribe.suffix === extension && !validateSourceExtension) ||
                    metaDescribe.folderExtension === extension
                ) {
                    metadataName = metaDescribe.xmlName;
                    break;
                }
            }
        }
        return metadataName;
    }
}

export const METADATA_INFO = MetadataInfo.loadMetadataInfo();
export const UNSPLITED_METADATA = [
    METADATA_INFO.Workflow,
    METADATA_INFO.SharingRules,
    METADATA_INFO.CustomLabels,
    METADATA_INFO.Profile,
    METADATA_INFO.PermissionSet,
];

export const PROFILE_PERMISSIONSET_EXTENSION = [METADATA_INFO.Profile, METADATA_INFO.PermissionSet];
