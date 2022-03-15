/* eslint-disable @typescript-eslint/no-unused-vars */
import { LoggerLevel, AuthInfo, Org } from '@salesforce/core';
let request = require('request-promise-native');
import { SFPowerkit } from '../sfpowerkit';
let retry = require('async-retry');
import { isNullOrUndefined } from 'util';
import Passwordgenerateimpl from '../impl/user/passwordgenerateimpl';
import queryApi from '../utils/queryExecutor';
const child_process = require('child_process');

const ORDER_BY_FILTER = ' ORDER BY CreatedDate ASC';
export default class ScratchOrgUtils {
    public static isNewVersionCompatible = false;
    private static isVersionCompatibilityChecked = false;
    private static sfdxAuthUrlFieldExists = false;

    public static async checkForNewVersionCompatible(hubOrg: Org) {
        let conn = hubOrg.getConnection();
        let expectedValues = ['In Progress', 'Available', 'Allocate', 'Assigned'];
        let availableValues: string[] = [];
        if (!this.isVersionCompatibilityChecked) {
            await retry(
                async (bail) => {
                    const describeResult: any = await conn.sobject('ScratchOrgInfo').describe();
                    if (describeResult) {
                        for (const field of describeResult.fields) {
                            if (field.name === 'SfdxAuthUrl__c') {
                                this.sfdxAuthUrlFieldExists = true;
                            }

                            if (field.name === 'Allocation_status__c' && field.picklistValues.length === 4) {
                                for (let picklistValue of field.picklistValues) {
                                    if (picklistValue.active) {
                                        availableValues.push(picklistValue.value);
                                    }
                                }
                            }
                        }
                    }
                },
                { retries: 3, minTimeout: 30000 }
            );

            this.isVersionCompatibilityChecked = true;
            //If there are values returned, its not compatible
            this.isNewVersionCompatible =
                expectedValues.filter((item) => {
                    return !availableValues.includes(item);
                }).length == 0
                    ? true
                    : false;

            if (!this.isNewVersionCompatible) {
                SFPowerkit.log(
                    `Required Prerequisite values in ScratchOrgInfo.Allocation_status__c field is missing in the DevHub, expected values are : ${expectedValues}\n` +
                        `Switching back to previous version, we request you to update ScratchOrgInfo.Allocation_status__c field in the DevHub \n` +
                        `For more information Please refer https://github.com/Accenture/sfpowerkit/blob/main/src_saleforce_packages/scratchorgpool/force-app/main/default/objects/ScratchOrgInfo/fields/Allocation_status__c.field-meta.xml \n`,
                    LoggerLevel.WARN
                );
            }
        }

        return this.isNewVersionCompatible;
    }

    public static async getScratchOrgLimits(hubOrg: Org, apiversion: string) {
        let conn = hubOrg.getConnection();

        let query_uri = `${conn.instanceUrl}/services/data/v${apiversion}/limits`;
        const limits = await request({
            method: 'get',
            url: query_uri,
            headers: {
                Authorization: `Bearer ${conn.accessToken}`,
            },
            json: true,
        });

        SFPowerkit.log(`Limits Fetched: ${JSON.stringify(limits)}`, LoggerLevel.TRACE);
        return limits;
    }

    public static async getScratchOrgRecordsAsMapByUser(hubOrg: Org) {
        let conn = hubOrg.getConnection();
        let query =
            'SELECT count(id) In_Use, SignupEmail FROM ActiveScratchOrg GROUP BY SignupEmail ORDER BY count(id) DESC';
        const results = (await conn.query(query)) as any;
        SFPowerkit.log(`Info Fetched: ${JSON.stringify(results)}`, LoggerLevel.DEBUG);

        let scratchOrgRecordAsMapByUser = ScratchOrgUtils.arrayToObject(results.records, 'SignupEmail');
        return scratchOrgRecordAsMapByUser;
    }

    private static async getScratchOrgLoginURL(hubOrg: Org, username: string): Promise<any> {
        let conn = hubOrg.getConnection();

        let query = `SELECT Id, SignupUsername, LoginUrl FROM ScratchOrgInfo WHERE SignupUsername = '${username}'`;
        SFPowerkit.log('QUERY:' + query, LoggerLevel.DEBUG);
        const results = (await conn.query(query)) as any;
        SFPowerkit.log(`Login URL Fetched: ${JSON.stringify(results)}`, LoggerLevel.DEBUG);

        return results.records[0].LoginUrl;
    }

    public static async createScratchOrg(
        id: number,
        adminEmail: string,
        config_file_path: string,
        expiry: number,
        hubOrg: Org
    ): Promise<ScratchOrg> {
        SFPowerkit.log(
            'Parameters: ' + id + ' ' + adminEmail + ' ' + config_file_path + ' ' + expiry + ' ',
            LoggerLevel.TRACE
        );

        let result;
        let getSFDXCommand = `sfdx force:org:create -f ${config_file_path} -d ${expiry} -a SO${id} -w 10 -v ${hubOrg.getUsername()} --json`;

        if (adminEmail) {
            getSFDXCommand += ` adminEmail=${adminEmail}`;
        }

        result = child_process.execSync(getSFDXCommand, { stdio: 'pipe' });
        const resultObject = JSON.parse(result);

        SFPowerkit.log(JSON.stringify(result), LoggerLevel.TRACE);

        let scratchOrg: ScratchOrg = {
            alias: `SO${id}`,
            orgId: resultObject.result.orgId,
            username: resultObject.result.username,
            signupEmail: adminEmail ? adminEmail : '',
        };

        //Get FrontDoor URL
        scratchOrg.loginURL = await this.getScratchOrgLoginURL(hubOrg, scratchOrg.username);

        //Generate Password
        let passwordData = await Passwordgenerateimpl.run(scratchOrg.username);

        scratchOrg.password = passwordData.password;

        //Get Sfdx Auth URL
        try {
            const authInfo = await AuthInfo.create({ username: scratchOrg.username });
            scratchOrg.sfdxAuthUrl = authInfo.getSfdxAuthUrl();
        } catch (error) {
            SFPowerkit.log(
                `Unable to fetch authURL for ${scratchOrg.username}. Only Scratch Orgs created from DevHub using authenticated using auth:sfdxurl or auth:web will have access token and enabled for autoLogin`,
                LoggerLevel.INFO
            );
        }

        if (!passwordData.password) {
            throw new Error('Unable to setup password to scratch org');
        } else {
            SFPowerkit.log(`Password successfully set for ${passwordData.username}`, LoggerLevel.INFO);
        }

        return scratchOrg;
    }

    public static async shareScratchOrgThroughEmail(emailId: string, scratchOrg: ScratchOrg, hubOrg: Org) {
        let hubOrgUserName = hubOrg.getUsername();
        let body = `${hubOrgUserName} has fetched a new scratch org from the Scratch Org Pool!\n
   All the post scratch org scripts have been succesfully completed in this org!\n
   The Login url for this org is : ${scratchOrg.loginURL}\n
   Username: ${scratchOrg.username}\n
   Password: ${scratchOrg.password}\n
   Please use sfdx force:auth:web:login -r ${scratchOrg.loginURL} -a <alias>  command to authenticate against this Scratch org</p>
   Thank you for using sfpowerkit!`;

        const options = {
            method: 'post',
            body: JSON.stringify({
                inputs: [
                    {
                        emailBody: body,
                        emailAddresses: emailId,
                        emailSubject: `${hubOrgUserName} created you a new Salesforce org`,
                        senderType: 'CurrentUser',
                    },
                ],
            }),
            url: '/services/data/v50.0/actions/standard/emailSimple',
        };

        await retry(
            async (bail) => {
                await hubOrg.getConnection().request(options);
            },
            { retries: 3, minTimeout: 30000 }
        );

        SFPowerkit.log(`Succesfully send email to ${emailId} for ${scratchOrg.username}`, LoggerLevel.INFO);
    }

    public static async getScratchOrgRecordId(scratchOrgs: ScratchOrg[], hubOrg: Org) {
        if (scratchOrgs == undefined || scratchOrgs.length == 0) return;

        let hubConn = hubOrg.getConnection();

        let scratchOrgIds = scratchOrgs
            .map(function (scratchOrg) {
                scratchOrg.orgId = scratchOrg.orgId.slice(0, 15);
                return `'${scratchOrg.orgId}'`;
            })
            .join(',');

        let query = `SELECT Id, ScratchOrg FROM ScratchOrgInfo WHERE ScratchOrg IN ( ${scratchOrgIds} )`;
        SFPowerkit.log('QUERY:' + query, LoggerLevel.TRACE);

        return await retry(
            async (bail) => {
                const results = (await hubConn.query(query)) as any;
                let resultAsObject = this.arrayToObject(results.records, 'ScratchOrg');

                SFPowerkit.log(JSON.stringify(resultAsObject), LoggerLevel.TRACE);

                scratchOrgs.forEach((scratchOrg) => {
                    scratchOrg.recordId = resultAsObject[scratchOrg.orgId]['Id'];
                });

                return results;
            },
            { retries: 3, minTimeout: 3000 }
        );
    }

    public static async setScratchOrgInfo(soInfo: any, hubOrg: Org): Promise<boolean> {
        let hubConn = hubOrg.getConnection();

        if (!this.sfdxAuthUrlFieldExists) {
            delete soInfo.SfdxAuthUrl__c;
            SFPowerkit.log('Removed sfdxAuthUrl info as SfdxAuthUrl__c field is not found on Org', LoggerLevel.TRACE);
        }

        SFPowerkit.log(JSON.stringify(soInfo), LoggerLevel.TRACE);
        return await retry(
            async (bail) => {
                try {
                    let result = await hubConn.sobject('ScratchOrgInfo').update(soInfo);
                    SFPowerkit.log('Setting Scratch Org Info:' + JSON.stringify(result), LoggerLevel.TRACE);
                    return result.constructor !== Array ? result.success : true;
                } catch (err) {
                    SFPowerkit.log('Failure at setting ScratchOrg Info' + err, LoggerLevel.TRACE);
                    return false;
                }
            },
            { retries: 3, minTimeout: 3000 }
        );
    }

    public static async getScratchOrgsByTag(tag: string, hubOrg: Org, isMyPool: boolean, unAssigned: boolean) {
        let hubConn = hubOrg.getConnection();

        return await retry(
            async (bail) => {
                let query;

                if (this.sfdxAuthUrlFieldExists) {
                    if (!isNullOrUndefined(tag))
                        query = `SELECT Pooltag__c, Id,  CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl,SfdxAuthUrl__c FROM ScratchOrgInfo WHERE Pooltag__c = '${tag}'  AND Status = 'Active' `;
                    else
                        query = `SELECT Pooltag__c, Id,  CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl,SfdxAuthUrl__c FROM ScratchOrgInfo WHERE Pooltag__c != null  AND Status = 'Active' `;
                } else {
                    if (!isNullOrUndefined(tag))
                        query = `SELECT Pooltag__c, Id,  CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl FROM ScratchOrgInfo WHERE Pooltag__c = '${tag}'  AND Status = 'Active' `;
                    else
                        query = `SELECT Pooltag__c, Id,  CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl FROM ScratchOrgInfo WHERE Pooltag__c != null  AND Status = 'Active' `;
                }
                if (isMyPool) {
                    query = query + ` AND createdby.username = '${hubOrg.getUsername()}' `;
                }
                if (unAssigned && this.isNewVersionCompatible) {
                    // if new version compatible get Available / In progress
                    query =
                        query + `AND ( Allocation_status__c ='Available' OR Allocation_status__c = 'In Progress' ) `;
                } else if (unAssigned && !this.isNewVersionCompatible) {
                    // if new version not compatible get not Assigned
                    query = query + `AND Allocation_status__c !='Assigned' `;
                }
                query = query + ORDER_BY_FILTER;
                SFPowerkit.log('QUERY:' + query, LoggerLevel.TRACE);
                const results = (await hubConn.query(query)) as any;
                return results;
            },
            { retries: 3, minTimeout: 3000 }
        );
    }

    public static async getActiveScratchOrgsByInfoId(hubOrg: Org, scrathOrgIds: string) {
        let hubConn = hubOrg.getConnection();

        return await retry(
            async (bail) => {
                let query = `SELECT Id, SignupUsername FROM ActiveScratchOrg WHERE ScratchOrgInfoId IN (${scrathOrgIds}) `;

                SFPowerkit.log('QUERY:' + query, LoggerLevel.TRACE);
                const results = (await hubConn.query(query)) as any;
                return results;
            },
            { retries: 3, minTimeout: 3000 }
        );
    }
    public static async getCountOfActiveScratchOrgsByTag(tag: string, hubOrg: Org): Promise<number> {
        let hubConn = hubOrg.getConnection();

        let query = `SELECT Id, CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl FROM ScratchOrgInfo WHERE Pooltag__c = '${tag}' AND Status = 'Active' `;
        SFPowerkit.log('QUERY:' + query, LoggerLevel.TRACE);
        
        let queryUtil = new queryApi(hubConn);
        let result = await queryUtil.executeQuery(query, false);

        SFPowerkit.log('RESULT:' + JSON.stringify(result), LoggerLevel.TRACE);

        return result.length ;

    }

    public static async getCountOfActiveScratchOrgsByTagAndUsername(tag: string, hubOrg: Org): Promise<number> {
        let hubConn = hubOrg.getConnection();
        let queryUtil = new queryApi(hubConn);
        let query = `SELECT Id, CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl FROM ScratchOrgInfo WHERE Pooltag__c = '${tag}' AND Status = 'Active' `;

        let result = await queryUtil.executeQuery(query, false);

        return result.length ;
    }

    public static async getActiveScratchOrgRecordIdGivenScratchOrg(
        hubOrg: Org,
        apiversion: string,
        scratchOrgId: string
    ): Promise<any> {
        let hubConn = hubOrg.getConnection();

        let query = `SELECT Id FROM ActiveScratchOrg WHERE ScratchOrg = '${scratchOrgId}'`;
        let queryUtil = new queryApi(hubConn);
        let result = await queryUtil.executeQuery(query, false);
        SFPowerkit.log('Retrieve Active ScratchOrg Id:' + JSON.stringify(result), LoggerLevel.TRACE);
        return result[0].Id;
    }

    public static async deleteScratchOrg(hubOrg: Org, scratchOrgIds: string[]) {
        let hubConn = hubOrg.getConnection();

        await retry(
            async (bail) => {
                await hubConn.sobject('ActiveScratchOrg').del(scratchOrgIds);
            },
            { retries: 3, minTimeout: 3000 }
        );
    }

    private static arrayToObject = (array, keyfield) =>
        array.reduce((obj, item) => {
            obj[item[keyfield]] = item;
            return obj;
        }, {});

    public static async checkForPreRequisite(hubOrg: Org) {
        let hubConn = hubOrg.getConnection();

        let query = `SELECT QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'ScratchOrgInfo' AND QualifiedApiName = 'Allocation_status__c'`;
        SFPowerkit.log('QUERY:' + query, LoggerLevel.TRACE);

        let queryUtil = new queryApi(hubConn);
        let result = await queryUtil.executeQuery(query, true);

        return result.length > 0;
    }
}

export interface ScratchOrg {
    tag?: string;
    recordId?: string;
    orgId?: string;
    loginURL?: string;
    signupEmail?: string;
    username?: string;
    alias?: string;
    password?: string;
    isScriptExecuted?: boolean;
    expiryDate?: string;
    accessToken?: string;
    instanceURL?: string;
    status?: string;
    sfdxAuthUrl?: string;
}
