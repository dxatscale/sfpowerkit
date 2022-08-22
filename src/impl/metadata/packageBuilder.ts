import { Connection } from 'jsforce';
import * as _ from 'lodash';
import * as xml2js from 'xml2js';
import * as fs from 'fs-extra';
import * as path from 'path';
import FileUtils from '../../utils/fileutils';
import { FileProperties } from 'jsforce';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';
import { SfdxError } from '@salesforce/core';

if (Symbol['asyncIterator'] === undefined) {
    // tslint:disable-next-line:no-any
    (Symbol as any)['asyncIterator'] = Symbol.for('asyncIterator');
}

const STANDARD_VALUE_SETS = [
    'AccountContactMultiRoles',
    'AccountContactRole',
    'AccountOwnership',
    'AccountRating',
    'AccountType',
    'AddressCountryCode',
    'AddressStateCode',
    'AssetStatus',
    'CampaignMemberStatus',
    'CampaignStatus',
    'CampaignType',
    'CaseContactRole',
    'CaseOrigin',
    'CasePriority',
    'CaseReason',
    'CaseStatus',
    'CaseType',
    'ContactRole',
    'ContractContactRole',
    'ContractStatus',
    'EntitlementType',
    'EventSubject',
    'EventType',
    'FiscalYearPeriodName',
    'FiscalYearPeriodPrefix',
    'FiscalYearQuarterName',
    'FiscalYearQuarterPrefix',
    'IdeaCategory',
    'IdeaMultiCategory',
    'IdeaStatus',
    'IdeaThemeStatus',
    'Industry',
    'InvoiceStatus',
    'LeadSource',
    'LeadStatus',
    'OpportunityCompetitor',
    'OpportunityStage',
    'OpportunityType',
    'OrderStatus',
    'OrderType',
    'PartnerRole',
    'Product2Family',
    'QuestionOrigin',
    'QuickTextCategory',
    'QuickTextChannel',
    'QuoteStatus',
    'SalesTeamRole',
    'Salutation',
    'ServiceContractApprovalStatus',
    'SocialPostClassification',
    'SocialPostEngagementLevel',
    'SocialPostReviewedStatus',
    'SolutionStatus',
    'TaskPriority',
    'TaskStatus',
    'TaskSubject',
    'TaskType',
    'WorkOrderLineItemStatus',
    'WorkOrderPriority',
    'WorkOrderStatus',
];
/**
 * This code was adapted from github:sfdx-jayree-plugin project which was
 * based on the original github:sfdx-hydrate project
 */
export class Packagexml {
    public configs: BuildConfig;
    private conn: Connection;
    private packageTypes = {};
    private ipRegex: RegExp;

    public result: {
        type: string;
        createdById?: string;
        createdByName?: string;
        createdDate?: string;
        fileName?: string;
        fullName: string;
        id?: string;
        lastModifiedById?: string;
        lastModifiedByName?: string;
        lastModifiedDate?: string;
        manageableState?: string;
        namespacePrefix?: string;
    }[];

    constructor(conn: Connection, configs: BuildConfig) {
        this.conn = conn;
        this.configs = configs;
        this.result = [];
    }

    public async build() {
        if (this.configs.excludeFilters.length > 0 && this.configs.includeFilters.length > 0) {
            let conflict = this.configs.excludeFilters.filter((element) =>
                this.configs.includeFilters.includes(element)
            );
            if (conflict.length > 0) {
                throw new SfdxError(`Unable to process the request, found ${conflict} in both include and exlude list`);
            }
        }

        try {
            await this.buildInstalledPackageRegex();

            await this.describeMetadata();

            this.setStandardValueset();

            let packageXml = this.generateXml();

            let dir = path.parse(this.configs.outputFile).dir;
            if (!fs.existsSync(dir)) {
                FileUtils.mkDirByPathSync(dir);
            }
            fs.writeFileSync(this.configs.outputFile, packageXml);
            SFPLogger.log(`Mainfest ${this.configs.outputFile} is created successfully `, LoggerLevel.INFO);
            return packageXml;
        } catch (err) {
            SFPLogger.log(err, LoggerLevel.ERROR);
        }
    }
    private setStandardValueset() {
        if (
            (this.configs.excludeFilters.length === 0 || !this.configs.excludeFilters.includes('StandardValueSet')) &&
            (this.configs.includeFilters.length === 0 || this.configs.includeFilters.includes('StandardValueSet'))
        ) {
            if (!this.packageTypes['StandardValueSet']) {
                this.packageTypes['StandardValueSet'] = [];
            }
            STANDARD_VALUE_SETS.forEach((member) => {
                this.packageTypes['StandardValueSet'].push(member);
                this.result.push({
                    type: 'StandardValueSet',
                    fullName: member,
                });
            });
        }
    }

    private async buildInstalledPackageRegex() {
        // fetch and execute installed package promise to build regex
        let ipRegexStr = '^(';

        let instPack = await this.conn.metadata.list(
            {
                type: 'InstalledPackage',
            },
            this.configs.apiVersion
        );
        try {
            instPack.forEach((pkg) => {
                ipRegexStr += pkg.namespacePrefix + '|';
            });
            ipRegexStr += ')+__';
            this.ipRegex = RegExp(ipRegexStr);
        } catch (err) {
            this.ipRegex = RegExp('');
        }
    }

    private async describeMetadata() {
        const describe = await this.conn.metadata.describe(this.configs.apiVersion);

        for (const object of describe.metadataObjects) {
            if (this.configs.excludeFilters.length > 0 && this.configs.excludeFilters.includes(object.xmlName)) {
                continue;
            } else if (this.configs.includeFilters.length > 0 && !this.isAvailableinIncludeList(object.xmlName)) {
                continue;
            }

            if (object.inFolder) {
                await this.handleFolderObject(object);
            } else {
                await this.handleNonFolderObject(object);
            }
        }
    }
    private async handleFolderObject(object) {
        const folderType = object.xmlName.replace('Template', '');
        let folderdescribeRes = await this.conn.metadata.list(
            {
                type: `${folderType}Folder`,
            },
            this.configs.apiVersion
        );
        try {
            //Handle Folder
            let folderDescribeItems = this.convertToArray(folderdescribeRes);
            folderDescribeItems.forEach(async (FolderMetadataEntries) => {
                this.addMember(FolderMetadataEntries.type, FolderMetadataEntries);

                //Handle Folder Item
                let folderItemsRes = await this.conn.metadata.list(
                    {
                        type: object.xmlName,
                        folder: FolderMetadataEntries.fullName,
                    },
                    this.configs.apiVersion
                );
                try {
                    //Handle Folder
                    let folderItems = this.convertToArray(folderItemsRes);
                    folderItems.forEach((FolderItemMetadataEntries) => {
                        this.addMember(FolderItemMetadataEntries.type, FolderItemMetadataEntries);
                    });
                } catch (err) {
                    SFPLogger.log(`Error in processing Type ${object.xmlName} ${err}`, LoggerLevel.ERROR);
                }
            });
        } catch (err) {
            SFPLogger.log(`Error in processing Type ${folderType} ${err}`, LoggerLevel.ERROR);
        }
    }
    private async handleNonFolderObject(object) {
        let unfolderItemsRes = await this.conn.metadata.list(
            {
                type: object.xmlName,
            },
            this.configs.apiVersion
        );
        try {
            //Handle Parent
            let unfolderItems = this.convertToArray(unfolderItemsRes);
            let filterunfolderItems = this.filterItems(unfolderItems);

            filterunfolderItems.forEach((metadataEntries) => {
                this.addMember(metadataEntries.type, metadataEntries);
            });

            //Handle Child
            if (object.childXmlNames && object.childXmlNames.length > 0 && this.configs.includeChilds) {
                for (let child of object.childXmlNames) {
                    if (child === 'ManagedTopic') {
                        continue;
                    }
                    let unfolderChildItemsRes = await this.conn.metadata.list(
                        {
                            type: child,
                        },
                        this.configs.apiVersion
                    );
                    try {
                        let unfolderChilItems = this.convertToArray(unfolderChildItemsRes);
                        let filterunfolderChildItems = this.filterChildItems(unfolderChilItems, object.xmlName);

                        filterunfolderChildItems.forEach((metadataEntries) => {
                            this.addMember(metadataEntries.type, metadataEntries);
                        });
                    } catch (err) {
                        SFPLogger.log(`Error in processing Type ${child} ${err}`, LoggerLevel.ERROR);
                    }
                }
            }
        } catch (err) {
            SFPLogger.log(`Error in processing Type ${object.xmlName} ${err}`, LoggerLevel.ERROR);
        }
    }

    private isAvailableinIncludeList(type: string, member = '') {
        let found = false;

        for (let includeFilter of this.configs.includeFilters) {
            if (!includeFilter.includes(':') && includeFilter === type) {
                found = true;
                break;
            } else if (
                includeFilter.includes(':') &&
                includeFilter.split(':')[0] === type &&
                (member === '' || includeFilter.split(':')[1] === member)
            ) {
                found = true;
                break;
            }
        }

        return found;
    }

    private convertToArray(item) {
        if (!item) {
            return [];
        } else if (Array.isArray(item)) {
            return item;
        } else {
            return [item];
        }
    }
    private filterItems(itemsArray: FileProperties[]) {
        return itemsArray.filter(
            (element) =>
                (this.configs.excludeFilters.length === 0 ||
                    !this.configs.excludeFilters.includes(element.type + ':' + element.fullName)) &&
                (this.configs.includeFilters.length === 0 ||
                    this.isAvailableinIncludeList(element.type, element.fullName))
        );
    }
    private filterChildItems(itemsArray: FileProperties[], parentType) {
        return itemsArray.filter(
            (element) =>
                ((this.configs.excludeFilters.length === 0 ||
                    !this.configs.excludeFilters.includes(element.type + ':' + element.fullName)) &&
                    (this.configs.includeFilters.length === 0 ||
                        this.isAvailableinIncludeList(element.type, element.fullName))) ||
                this.isAvailableinIncludeList(parentType, this.getParentName(element.fullName))
        );
    }
    private getParentName(fullName: string) {
        return fullName.includes('.') ? fullName.split('.')[0] : '';
    }

    private generateXml() {
        const packageJson = {
            $: { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
            types: [],
            version: this.configs.apiVersion,
        };
        let mdtypes = Object.keys(this.packageTypes);
        mdtypes.sort();
        mdtypes.forEach((mdtype) => {
            packageJson.types.push({
                name: mdtype,
                members: this.packageTypes[mdtype].sort(),
            });
        });

        const builder = new xml2js.Builder({
            xmldec: { version: '1.0', encoding: 'utf-8' },
        });
        let packageObj = {
            Package: packageJson,
        };
        let packageXml = builder.buildObject(packageObj);
        return packageXml;
    }

    private addMember(type: string, member: FileProperties) {
        /**
         * Managed package - fullName starts with 'namespacePrefix__' || namespacePrefix is not null || manageableState = installed
         * Unmanaged package - manageableState = unmanaged
         * Regular custom objects - manageableState = unmanaged or undefined
         */

        if (type && !this.isManagePackageIgnored(member)) {
            try {
                //Handle Object Translation
                if (member.fileName.includes('ValueSetTranslation')) {
                    const x =
                        member.fileName.split('.')[1].substring(0, 1).toUpperCase() +
                        member.fileName.split('.')[1].substring(1);
                    if (!this.packageTypes[x]) {
                        this.packageTypes[x] = [];
                    }
                    this.packageTypes[x].push(member.fullName);
                    this.result.push(member);
                } else {
                    if (!this.packageTypes[type]) {
                        this.packageTypes[type] = [];
                    }

                    //Handle Layout
                    if (member.type === 'Layout' && member.namespacePrefix && member.manageableState === 'installed') {
                        const { fullName, namespacePrefix } = member;
                        let objectName = fullName.substr(0, fullName.indexOf('-'));
                        let layoutName = fullName.substr(fullName.indexOf('-') + 1);
                        this.packageTypes[type].push(objectName + '-' + namespacePrefix + '__' + layoutName);
                        this.result.push(member);
                    } else {
                        this.packageTypes[type].push(member.fullName);
                        this.result.push(member);
                    }
                }
            } catch (ex) {
                SFPLogger.log(`Error in adding Type ${type} ${ex.message}`, LoggerLevel.ERROR);
            }
        }
    }
    private isManagePackageIgnored(member: any) {
        return (
            this.configs.excludeManaged &&
            (this.ipRegex.test(member.fullName) || member.namespacePrefix || member.manageableState === 'installed')
        );
    }
}

export class BuildConfig {
    public includeFilters: string[];
    public excludeFilters: string[];
    public excludeManaged: boolean;
    public includeChilds: boolean;
    public apiVersion: string;
    public targetDir: string;
    public outputFile: string;

    constructor(flags: object, apiVersion: string) {
        // flags always take precendence over configs from file
        this.excludeManaged = flags['excludemanaged'];
        this.includeChilds = flags['includechilds'];
        this.apiVersion = flags['apiversion'] || apiVersion;
        this.excludeFilters = flags['excludefilter']
            ? flags['excludefilter'].split(',').map((elem) => {
                  return elem.trim();
              })
            : [];

        if (flags['quickfilter']) {
            flags['quickfilter'].split(',').map((elem) => {
                if (!this.excludeFilters.includes(elem.trim())) {
                    this.excludeFilters.push(elem.trim());
                }
            });
        }

        this.includeFilters = flags['includefilter']
            ? flags['includefilter'].split(',').map((elem) => {
                  return elem.trim();
              })
            : [];

        this.outputFile = flags['outputfile'] || 'package.xml';
    }
}
