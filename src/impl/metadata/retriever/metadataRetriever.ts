import { Sfpowerkit } from '../../../sfpowerkit';
import * as _ from 'lodash';
import { Connection } from 'jsforce';
import QueryExecutor from '../../../utils/queryExecutor';
import MetadataOperation from '../../../utils/metadataOperation';
import { registry } from '@salesforce/source-deploy-retrieve';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';

export default class MetadataRetriever {
    protected _componentType;
    protected _conn;

    public constructor(conn: Connection, componentType: string) {
        this._conn = conn;
        this._componentType = componentType;
    }

    public get componentType() {
        return this._componentType;
    }

    public async getComponents(parent?: string) {
        let key = parent ? this._componentType + '_' + parent : this._componentType;

        if (!this._conn) {
            return [];
        }

        if (!Sfpowerkit.getFromCache(key)) {
            let items;
            if (this._componentType === 'UserLicense') {
                items = await this.getUserLicense();
            } else if (this._componentType === registry.types.customobject.name) {
                items = await this.getCustomObjects();
            } else if (this._componentType === 'ObjectPermissions') {
                items = await this.getObjectPermissions();
            } else if (this._componentType === registry.types.customobject.children.types.customfield.name) {
                items = await this.getFieldsByObjectName(parent);
            } else if (this._componentType === 'UserPermissions') {
                items = await this.getUserPermissions();
            } else if (this._componentType === registry.types.layout.name) {
                items = await this.getLayouts();
            } else if (this._componentType === registry.types.customtab.name) {
                items = await this.getTabs();
            } else if (this._componentType === registry.types.customobject.children.types.recordtype.name) {
                items = await this.getRecordTypes();
            } else {
                items = await new MetadataOperation(this._conn).getComponentsFromOrgUsingListMetadata(
                    this._componentType
                );
            }

            //Set Full..
            Sfpowerkit.addToCache(key, items);

            for (const item of items) {
                Sfpowerkit.addToCache(`${this.componentType}_${item.fullName}`, true);
            }
        }
        return Sfpowerkit.getFromCache(key);
    }

    private async getUserLicense() {
        let query = `Select Id, Name, LicenseDefinitionKey From UserLicense`;

        let queryUtil = new QueryExecutor(this._conn);
        let items = await queryUtil.executeQuery(query, false);

        if (items === undefined || items === null) {
            items = [];
        }

        return items.map((lic) => {
            lic.fullName = lic.Name;

            return lic;
        });
    }
    private async getTabs() {
        let query = `SELECT Id,  Name, SobjectName, DurableId, IsCustom, Label FROM TabDefinition`;

        let queryUtil = new QueryExecutor(this._conn);
        let items = await queryUtil.executeQuery(query, false);

        if (items === undefined || items === null) {
            items = [];
        }

        items.map((tab) => {
            tab.fullName = tab.Name;
            return tab;
        });

        let listMetadataItems = await new MetadataOperation(this._conn).getComponentsFromOrgUsingListMetadata(
            this._componentType
        );
        if (listMetadataItems.length > 0) {
            items = items.concat(listMetadataItems);
        }

        return items;
    }

    public async isComponentExistsInTheOrg(item: string, parent?: string): Promise<boolean> {
        let items = await this.getComponents(parent);
        //Do a cache hit before deep interospection
        let foundItem = item ? Sfpowerkit.getFromCache(`${this.componentType}_${item}`) : null;
        if (_.isNil(foundItem) && !_.isNil(items) && Array.isArray(items)) {
            foundItem = items.find((p) => {
                return p?.fullName === item;
            });
            foundItem = !_.isNil(foundItem);
        }
        return foundItem;
    }

    public async isComponentExistsInProjectDirectory(item: string): Promise<boolean> {
        let found = false;
        if (!_.isNil(Sfpowerkit.getFromCache(`SOURCE_${this.componentType}_${item}`))) {
            found = true;
        }
        return found;
    }

    public async isComponentExistsInProjectDirectoryOrInOrg(item: string, parent?: string): Promise<boolean> {
        let found = false;
        //First check in directory
        found = await this.isComponentExistsInProjectDirectory(item);
        if (found === false) {
            found = await this.isComponentExistsInTheOrg(item, parent);
            SFPLogger.log(`Found in Org? ${item} ${found}`, LoggerLevel.TRACE);
        }
        return found;
    }

    private async getCustomObjects(): Promise<any> {
        let results = await this._conn.describeGlobal();
        let entities = results.sobjects.map((sObject) => {
            return {
                QualifiedApiName: sObject.name,
                fullName: sObject.name,
            };
        });

        return entities;
    }

    public async getUserPermissions(): Promise<any[]> {
        let describeResult = await this._conn.sobject('PermissionSet').describe();
        let supportedPermissions = [];
        describeResult.fields.forEach((field) => {
            let fieldName = field['name'] as string;
            if (fieldName.startsWith('Permissions')) {
                supportedPermissions.push({
                    fullName: fieldName.replace('Permissions', '').trim(),
                });
            }
        });
        return supportedPermissions;
    }

    private async getObjectPermissions(): Promise<any[]> {
        let objectForPermission = [];
        let res = await this._conn.query('SELECT SobjectType, count(Id) From ObjectPermissions Group By sObjectType');
        if (res !== undefined) {
            objectForPermission = res.records.map((elem) => {
                return { fullName: elem['SobjectType'] };
            });
        }
        if (!objectForPermission.includes('PersonAccount')) {
            objectForPermission.push({ fullName: 'PersonAccount' });
        }
        return objectForPermission;
    }

    private async getFieldsByObjectName(objectName: string): Promise<any[]> {
        let fields = [];
        try {
            SFPLogger.log(`Fetching Field of Object ${objectName}`, LoggerLevel.TRACE);

            let query = `SELECT Id, QualifiedApiName, EntityDefinitionId, DeveloperName, NameSpacePrefix FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName='${objectName}'`;
            let queryUtil = new QueryExecutor(this._conn);
            fields = await queryUtil.executeQuery(query, true);

            fields = fields.map((field) => {
                return { fullName: `${objectName}.${field.QualifiedApiName}` };
            });
        } catch (error) {
            SFPLogger.log(`Object not found ${objectName}..skipping`, LoggerLevel.TRACE);
        }
        return fields;
    }

    private async getRecordTypes(): Promise<any[]> {
        let recordTypes = [];
        try {
            SFPLogger.log(`Fetching RecordTypes`, LoggerLevel.TRACE);

            let queryUtil = new QueryExecutor(this._conn);

            let isPersonAccountFieldDefinitionQuery = `SELECT QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName='Account' AND QualifiedApiName='IsPersonAccount'`;
            let isPersonAccountFieldDefinitionRecords = await queryUtil.executeQuery(
                isPersonAccountFieldDefinitionQuery,
                true
            );

            let recordTypeQuery: string;
            if (isPersonAccountFieldDefinitionRecords.length > 0)
                recordTypeQuery = `SELECT Name, DeveloperName, SobjectType, NameSpacePrefix, IsPersonType FROM RecordType`;
            else recordTypeQuery = `SELECT Name, DeveloperName, SobjectType, NameSpacePrefix FROM RecordType`;

            recordTypes = await queryUtil.executeQuery(recordTypeQuery, false);

            recordTypes = recordTypes.map((recordType) => {
                let namespace = '';
                if (
                    recordType.NamespacePrefix !== undefined &&
                    recordType.NamespacePrefix !== '' &&
                    recordType.NamespacePrefix !== null &&
                    recordType.NamespacePrefix !== 'null'
                ) {
                    namespace = recordType.NamespacePrefix + '__';
                }
                let rtObj = {
                    fullName: `${recordType.SobjectType}.${namespace}${recordType.DeveloperName}`,
                };
                if (recordType.IsPersonType) {
                    rtObj = {
                        fullName: `PersonAccount.${namespace}${recordType.DeveloperName}`,
                    };
                }
                return rtObj;
            });
        } catch (error) {
            SFPLogger.log(`Error fetching record types...`, LoggerLevel.DEBUG);
            SFPLogger.log(error.message, LoggerLevel.DEBUG);
        }
        return recordTypes;
    }

    private async getLayouts(): Promise<any[]> {
        SFPLogger.log(`Fetching Layouts`, LoggerLevel.TRACE);
        let apiversion: string = await Sfpowerkit.getApiVersion();
        let layouts = await this._conn.metadata.list(
            {
                type: registry.types.layout.name,
            },
            apiversion
        );
        if (layouts != undefined && layouts.length > 0) {
            for (let i = 0; i < layouts.length; i++) {
                if (
                    layouts[i].namespacePrefix !== undefined &&
                    layouts[i].namespacePrefix !== '' &&
                    layouts[i].namespacePrefix !== null &&
                    layouts[i].namespacePrefix !== 'null'
                ) {
                    //apend namespacePrefix in layout
                    layouts[i].fullName = layouts[i].fullName.replace('-', `-${layouts[i].namespacePrefix}__`);
                }
            }
        } else {
            layouts = [];
        }

        return layouts;
    }
}
