/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-array-constructor */
import ScratchOrgUtils, { ScratchOrg } from '../../../utils/scratchOrgUtils';
import { Connection, Org, AuthInfo } from '@salesforce/core';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import Bottleneck from 'bottleneck';
import { isNullOrUndefined } from 'util';
import RelaxIPRangeImpl from '../../org/relaxIPRangeImpl';
import FileUtils from '../../../utils/fileutils';
import * as path from 'path';
import * as rimraf from 'rimraf';
import Ajv from 'ajv';

export default class PoolCreateImpl {
    private hubConn: Connection;

    private poolConfig: PoolConfig;
    private totalToBeAllocated: number;
    private ipRangeExecResults;
    private ipRangeExecResultsAsObject;
    private limits;
    private scriptFileExists: boolean;
    private totalAllocated = 0;
    private limiter;
    private scriptExecutorWrappedForBottleneck;
    private ipRangeRelaxerWrappedForBottleneck;

    public constructor(
        private poolconfigFilePath: string,
        private hubOrg: Org,
        private apiversion: string,
        private batchSize: number
    ) {
        this.limiter = new Bottleneck({
            maxConcurrent: batchSize,
        });

        this.scriptExecutorWrappedForBottleneck = this.limiter.wrap(this.scriptExecutor);
        this.ipRangeRelaxerWrappedForBottleneck = this.limiter.wrap(this.ipRangeRelaxer);
    }

    public async poolScratchOrgs(): Promise<boolean> {
        let scriptExecPromises: Array<Promise<ScriptExecutionResult>> = new Array();
        let ipRangeExecPromises: Array<Promise<{
            username: string;
            success: boolean;
        }>> = new Array();

        await this.hubOrg.refreshAuth();
        this.hubConn = this.hubOrg.getConnection();

        let preRequisiteCheck = await ScratchOrgUtils.checkForPreRequisite(this.hubOrg);

        if (!preRequisiteCheck) {
            SFPLogger.log(
                'Required Prerequisite fields are missing in the DevHub, Refer to https://github.com/dxatscale/sfpower-scratchorg-pool',
                LoggerLevel.ERROR
            );
            return false;
        }

        //Read pool config file

        if (!fs.existsSync(this.poolconfigFilePath)) {
            SFPLogger.log('Poll Config Path not provided, Unable to create pool without this file', LoggerLevel.ERROR);
            return false;
        }

        this.poolConfig = JSON.parse(fs.readFileSync(this.poolconfigFilePath).toString());

        //Temporarily remove validate SO Pool Config
        this.validateSoPoolConfig(this.poolConfig);

        //Validate Inputs
        if (isNullOrUndefined(this.poolConfig.pool.config_file_path)) {
            SFPLogger.log(
                'Scratch Org Config Path not provided, Unable to create pool without this file',
                LoggerLevel.ERROR
            );
            return true;
        }

        if (isNullOrUndefined(this.poolConfig.pool.expiry) || isNullOrUndefined(this.poolConfig.pool.tag)) {
            SFPLogger.log(
                'Some Key parameters are missing in the schema,Please consult the documentation',
                LoggerLevel.ERROR
            );
            return true;
        }

        this.validateScriptFile();

        if (this.poolConfig.poolUsers && this.poolConfig.poolUsers.length > 0) this.poolConfig.pool.user_mode = true;
        else this.poolConfig.pool.user_mode = false;

        //Set Tag Only mode activated for the default use case
        if (this.poolConfig.pool.user_mode == false) this.setASingleUserForTagOnlyMode();

        SFPLogger.log('Pool Config:' + JSON.stringify(this.poolConfig), LoggerLevel.TRACE);

        if (
            !this.poolConfig.pool.relax_all_ip_ranges &&
            isNullOrUndefined(this.poolConfig.pool.relax_ip_ranges) &&
            !this.poolConfig.pool.user_mode
        ) {
            SFPLogger.log(
                "IP Ranges are not relaxed, The created scratch org's will have the pool creators email as Admin Email and has to be verifed before use",
                LoggerLevel.WARN
            );
        }

        //fetch current status limits
        await this.fetchCurrentLimits();

        //Compute allocation
        this.totalToBeAllocated = await this.computeAllocation();

        if (this.totalToBeAllocated === 0) {
            if (this.limits.ActiveScratchOrgs.Remaining > 0)
                SFPLogger.log(
                    `The tag provided ${this.poolConfig.pool.tag} is currently at the maximum capacity , No scratch orgs will be allocated`,
                    LoggerLevel.INFO
                );
            else
                SFPLogger.log(
                    `There is no capacity to create a pool at this time, Please try again later`,
                    LoggerLevel.INFO
                );
            return;
        }

        //Generate Scratch Orgs
        await this.generateScratchOrgs();

        // Setup Logging Directory
        rimraf.sync('script_exec_outputs');
        FileUtils.mkDirByPathSync('script_exec_outputs');

        // Assign workers to executed scripts
        let ts = Math.floor(Date.now() / 1000);
        for (let poolUser of this.poolConfig.poolUsers) {
            for (let scratchOrg of poolUser.scratchOrgs) {
                SFPLogger.log(JSON.stringify(scratchOrg), LoggerLevel.DEBUG);

                if (this.poolConfig.pool.relax_all_ip_ranges || this.poolConfig.pool.relax_ip_ranges) {
                    let resultForIPRelaxation = this.ipRangeRelaxerWrappedForBottleneck(scratchOrg);
                    ipRangeExecPromises.push(resultForIPRelaxation);
                }

                //Wait for scripts to finish execution
                if (this.poolConfig.pool.relax_all_ip_ranges || this.poolConfig.pool.relax_ip_ranges) {
                    this.ipRangeExecResults = await Promise.all(ipRangeExecPromises);
                    this.ipRangeExecResultsAsObject = this.arrayToObject(this.ipRangeExecResults, 'username');
                }

                if (this.scriptFileExists) {
                    let result = this.scriptExecutorWrappedForBottleneck(
                        this.poolConfig.pool.script_file_path,
                        scratchOrg,
                        this.hubOrg.getUsername()
                    );
                    scriptExecPromises.push(result);
                } else {
                    //Just commit it to the pool as there is no script, and ensuring it doesnt get deleted
                    scratchOrg.isScriptExecuted = true;
                    await ScratchOrgUtils.setScratchOrgInfo(
                        {
                            Id: scratchOrg.recordId,
                            Pooltag__c: this.poolConfig.pool.tag,
                            Allocation_status__c: 'Available',
                            Password__c: scratchOrg.password,
                            SfdxAuthUrl__c: scratchOrg.sfdxAuthUrl,
                        },
                        this.hubOrg
                    );
                }
            }
        }

        let scriptExecResults = await Promise.all(scriptExecPromises);

        if (this.scriptFileExists) {
            SFPLogger.log(JSON.stringify(scriptExecResults), LoggerLevel.TRACE);
            ts = Math.floor(Date.now() / 1000) - ts;
            SFPLogger.log(`Pool Execution completed in ${ts} Seconds`, LoggerLevel.INFO);
        }

        //Commit Succesfull Scratch Orgs
        let commit_result: {
            success: number;
            failed: number;
        } = await this.finalizeGeneratedScratchOrgs();

        if (this.totalAllocated > 0) {
            SFPLogger.log(
                `Request for provisioning ${this.totalToBeAllocated} scratchOrgs of which ${this.totalAllocated} were allocated with ${commit_result.success} success and ${commit_result.failed} failures`,
                LoggerLevel.INFO
            );
        } else {
            SFPLogger.log(
                `Request for provisioning ${this.totalToBeAllocated} scratchOrgs not successfull.`,
                LoggerLevel.ERROR
            );
        }
        return true;
    }

    private validateScriptFile() {
        if (isNullOrUndefined(this.poolConfig.pool.script_file_path)) {
            SFPLogger.log(
                'Script Path not provided, will create a pool of scratch orgs without any post creation steps',
                LoggerLevel.WARN
            );
            this.scriptFileExists = false;
        } else if (fs.existsSync(this.poolConfig.pool.script_file_path)) {
            this.scriptFileExists = true;
        } else {
            SFPLogger.log(
                'Unable to locate Script File path, will crete a pool of scratch orgs without any post creation steps',
                LoggerLevel.WARN
            );
            this.scriptFileExists = false;
        }
    }

    private setASingleUserForTagOnlyMode() {
        //Remove any existing pool Config for pool users
        if (this.poolConfig.poolUsers) delete this.poolConfig.poolUsers;

        let poolUser: PoolUser = {
            min_allocation: this.poolConfig.pool.max_allocation,
            max_allocation: this.poolConfig.pool.max_allocation,
            is_build_pooluser: false,
            expiry: this.poolConfig.pool.expiry,
            priority: 1,
        };
        //Add a single user
        this.poolConfig.poolUsers = [];
        this.poolConfig.poolUsers.push(poolUser);
        this.poolConfig.pool.user_mode = false;
    }

    private async fetchCurrentLimits() {
        try {
            this.limits = await ScratchOrgUtils.getScratchOrgLimits(this.hubOrg, this.apiversion);
        } catch (error) {
            SFPLogger.log('Unable to connect to DevHub', LoggerLevel.ERROR);
            return;
        }

        SFPLogger.log(
            `Active Scratch Orgs Remaining: ${this.limits.ActiveScratchOrgs.Remaining} out of ${this.limits.ActiveScratchOrgs.Max}`,
            LoggerLevel.TRACE
        );
    }

    private async computeAllocation(): Promise<number> {
        //Compute current pool requirement
        if (this.poolConfig.pool.user_mode) {
            //Retrieve Number of active SOs in the org
            let scratchOrgsResult = await ScratchOrgUtils.getScratchOrgsByTag(
                this.poolConfig.pool.tag,
                this.hubOrg,
                false,
                false
            );

            scratchOrgsResult.records = scratchOrgsResult.records.sort();

            let scratchOrgsRecordAsMapByUser = scratchOrgsResult.records.reduce(function (obj, v) {
                obj[v.SignupEmail] = (obj[v.SignupEmail] || 0) + 1;
                return obj;
            }, {});

            SFPLogger.log(JSON.stringify(scratchOrgsRecordAsMapByUser), LoggerLevel.TRACE);

            return this.allocateScratchOrgsPerUser(
                this.limits.ActiveScratchOrgs.Remaining,
                scratchOrgsRecordAsMapByUser,
                this.poolConfig.poolUsers
            );
        } else {
            let activeCount = await ScratchOrgUtils.getCountOfActiveScratchOrgsByTag(
                this.poolConfig.pool.tag,
                this.hubOrg
            );
            return this.allocateScratchOrgsPerTag(
                this.limits.ActiveScratchOrgs.Remaining,
                activeCount,
                this.poolConfig.pool.tag,
                this.poolConfig.poolUsers[0]
            );
        }
    }

    private async generateScratchOrgs() {
        //Generate Scratch Orgs
        let soCount = 1;
        for (let [index, poolUser] of this.poolConfig.poolUsers.entries()) {
            let userCount = 1;
            poolUser.scratchOrgs = new Array<ScratchOrg>();
            for (let i = 0; i < poolUser.to_allocate; i++) {
                SFPLogger.log(`Creating Scratch  Org ${soCount}/${this.totalToBeAllocated}`, LoggerLevel.INFO);
                if (this.poolConfig.pool.user_mode) {
                    SFPLogger.log(
                        `Scratch  Org allocation:${poolUser.username}  alias:${soCount} count:${userCount}/${poolUser.to_allocate}`,
                        LoggerLevel.INFO
                    );
                }

                try {
                    let scratchOrg: ScratchOrg = await ScratchOrgUtils.createScratchOrg(
                        soCount,
                        poolUser.username,
                        this.poolConfig.pool.config_file_path,
                        poolUser.expiry ? poolUser.expiry : this.poolConfig.pool.expiry,
                        this.hubOrg,
                        this.poolConfig.pool.alias_prefix
                    );
                    poolUser.scratchOrgs.push(scratchOrg);
                    this.totalAllocated++;
                } catch (error) {
                    SFPLogger.log(
                        `Unable to provision scratch org  ${soCount} . Due to following Error: ${error.message}`,
                        LoggerLevel.INFO
                    );
                }
                soCount++;
                userCount++;
            }

            await ScratchOrgUtils.getScratchOrgRecordId(poolUser.scratchOrgs, this.hubOrg);


            let scratchOrgInprogress = [];

            poolUser.scratchOrgs.forEach((scratchOrg) => {
                scratchOrgInprogress.push({
                    Id: scratchOrg.recordId,
                    Pooltag__c: this.poolConfig.pool.tag,
                    Allocation_status__c: 'In Progress',
                });
            });

            if (scratchOrgInprogress.length > 0) {
                //set pool tag
                await ScratchOrgUtils.setScratchOrgInfo(scratchOrgInprogress, this.hubOrg);

            }
        }
    }

    private async finalizeGeneratedScratchOrgs(): Promise<{
        success: number;
        failed: number;
    }> {
        //Store Username Passwords
        let failed = 0;
        let success = 0;

        for (let poolUser of this.poolConfig.poolUsers) {
            for (let scratchOrg of poolUser.scratchOrgs) {
                if (scratchOrg.isScriptExecuted) {
                    success++;
                    continue;
                }

                SFPLogger.log(
                    `Failed to execute scripts for ${scratchOrg.username} with alias ${scratchOrg.alias}.. Returning to Pool`,
                    LoggerLevel.ERROR
                );

                try {
                    //Delete scratchorgs that failed to execute script

                    let activeScratchOrgRecordId = await ScratchOrgUtils.getActiveScratchOrgRecordIdGivenScratchOrg(
                        this.hubOrg,
                        this.apiversion,
                        scratchOrg.orgId
                    );

                    await ScratchOrgUtils.deleteScratchOrg(this.hubOrg, [activeScratchOrgRecordId]);
                    SFPLogger.log(`Succesfully deleted scratchorg  ${scratchOrg.username}`, LoggerLevel.TRACE);
                } catch (error) {
                    SFPLogger.log(`Unable to delete the scratchorg ${scratchOrg.username}..`, LoggerLevel.WARN);
                }

                failed++;
            }
        }

        return { success: success, failed: failed };
    }

    private allocateScratchOrgsPerTag(
        remainingScratchOrgs: number,
        countOfActiveScratchOrgs: number,
        tag: string,
        poolUser: PoolUser
    ) {
        SFPLogger.log('Remaining ScratchOrgs' + remainingScratchOrgs, LoggerLevel.TRACE);
        poolUser.current_allocation = countOfActiveScratchOrgs;
        poolUser.to_allocate = 0;
        poolUser.to_satisfy_max =
            poolUser.max_allocation - poolUser.current_allocation > 0
                ? poolUser.max_allocation - poolUser.current_allocation
                : 0;

        if (poolUser.to_satisfy_max > 0 && poolUser.to_satisfy_max <= remainingScratchOrgs) {
            poolUser.to_allocate = poolUser.to_satisfy_max;
        } else if (poolUser.to_satisfy_max > 0 && poolUser.to_satisfy_max > remainingScratchOrgs) {
            poolUser.to_allocate = remainingScratchOrgs;
        }

        SFPLogger.log('Computed Allocation' + JSON.stringify(poolUser), LoggerLevel.TRACE);
        return poolUser.to_allocate;
    }

    private allocateScratchOrgsPerUser(
        remainingScratchOrgs: number,
        scratchOrgsRecordAsMapByUser: any,
        poolUsers: PoolUser[]
    ) {
        let totalToBeAllocated = 0;

        //sort pooleconfig.poolusers based on priority
        poolUsers = poolUsers.sort((a, b) => a.priority - b.priority);
        let totalMaxOrgRequired = 0,
            totalMinOrgRequired = 0;

        poolUsers.forEach((pooluser) => {
            SFPLogger.log(pooluser, LoggerLevel.TRACE);
            pooluser.to_allocate = 0;

            if (scratchOrgsRecordAsMapByUser[pooluser.username]) {
                pooluser.current_allocation = scratchOrgsRecordAsMapByUser[pooluser.username];

                pooluser.to_satisfy_max =
                    pooluser.max_allocation - pooluser.current_allocation > 0
                        ? pooluser.max_allocation - pooluser.current_allocation
                        : 0;
                pooluser.to_satisfy_min =
                    pooluser.min_allocation - pooluser.current_allocation > 0
                        ? pooluser.min_allocation - pooluser.current_allocation
                        : 0;
            } else {
                pooluser.current_allocation = 0;
                pooluser.to_satisfy_max = pooluser.max_allocation;
                pooluser.to_satisfy_min = pooluser.min_allocation;
            }
            totalMaxOrgRequired += pooluser.to_satisfy_max;
            totalMinOrgRequired += pooluser.to_satisfy_min;
        });

        //All good..

        if (totalMaxOrgRequired <= remainingScratchOrgs) {
            // Satisfy max. allocate max
            poolUsers.forEach((pooluser) => {
                pooluser.to_allocate = pooluser.to_satisfy_max;
                totalToBeAllocated += pooluser.to_satisfy_max;
            });
        } else if (totalMinOrgRequired <= remainingScratchOrgs) {
            // Satisfy min
            //First allocate minimum to everyone

            poolUsers.forEach((pooluser) => {
                pooluser.to_allocate = pooluser.to_satisfy_min;
                totalToBeAllocated += pooluser.to_satisfy_min;
            });
            //Check for left overs
            let leftOver = remainingScratchOrgs - totalMinOrgRequired;

            if (leftOver > 0) {
                //Allocate LeftOver in a round robin model
                while (leftOver > 0) {
                    poolUsers.forEach((pooluser) => {
                        if (leftOver == 0) return;
                        if (pooluser.current_allocation + pooluser.to_allocate < pooluser.to_satisfy_max) {
                            pooluser.to_allocate++;
                            totalToBeAllocated++;
                            leftOver--;
                        }
                    });
                }
            }
        } else {
            let leftOver = remainingScratchOrgs;

            //Allocate LeftOver in a round robin model
            while (leftOver >= 0) {
                poolUsers.forEach((pooluser) => {
                    if (pooluser.current_allocation + pooluser.to_allocate < pooluser.to_satisfy_max) {
                        pooluser.to_allocate++;
                        totalToBeAllocated++;

                        leftOver--;
                    }
                });
            }
        }

        return totalToBeAllocated;
    }

    private async ipRangeRelaxer(scratchOrg: ScratchOrg): Promise<{ username: string; success: boolean }> {
        //executue using bash
        SFPLogger.log(`Relaxing ip ranges for scratchOrg with user ${scratchOrg.username}`, LoggerLevel.INFO);
        const connection = await Connection.create({
            authInfo: await AuthInfo.create({ username: scratchOrg.username }),
        });

        if (this.poolConfig.pool.relax_all_ip_ranges) {
            this.poolConfig.pool.relax_ip_ranges = [];
            return RelaxIPRangeImpl.setIp(
                connection,
                scratchOrg.username,
                this.poolConfig.pool.relax_ip_ranges,
                this.poolConfig.pool.relax_all_ip_ranges
            );
        } else {
            return RelaxIPRangeImpl.setIp(connection, scratchOrg.username, this.poolConfig.pool.relax_ip_ranges);
        }
    }

    private async scriptExecutor(
        scriptFilePath,
        scratchOrg: ScratchOrg,
        hubOrgUserName
    ): Promise<ScriptExecutionResult> {
        //executue using bash
        let cmd;

        SFPLogger.log(`Script File Path: ${scriptFilePath}`, LoggerLevel.TRACE);

        scriptFilePath = path.normalize(scriptFilePath);

        if (process.platform != 'win32') {
            cmd = `bash ${scriptFilePath}  ${scratchOrg.username}  ${hubOrgUserName} `;
        } else {
            cmd = `cmd.exe /c ${scriptFilePath}  ${scratchOrg.username}  ${hubOrgUserName}`;
        }
        SFPLogger.log(`Executing command: ${cmd}`, LoggerLevel.INFO);

        SFPLogger.log(
            `Executing script for ${scratchOrg.alias} with username: ${scratchOrg.username}`,
            LoggerLevel.INFO
        );

        SFPLogger.log(
            `Script Execution result is being written to script_exec_outputs/${scratchOrg.alias}.log, Please note this will take a significant time depending on the  script being executed`,
            LoggerLevel.INFO
        );

        let fdr = fs.openSync(`script_exec_outputs/${scratchOrg.alias}.log`, 'a');

        return new Promise((resolve, reject) => {
            let ls = exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
                if (error) {
                    SFPLogger.log(`Failed to execute script for ${scratchOrg.username}`, LoggerLevel.WARN);
                    scratchOrg.isScriptExecuted = false;

                    resolve({
                        isSuccess: false,
                        message: error.message,
                        scratchOrgUsername: scratchOrg.username,
                        status: 'failure',
                    });
                    return;
                }

                scratchOrg.isScriptExecuted = true;

                if (
                    (this.poolConfig.pool.relax_all_ip_ranges || this.poolConfig.pool.relax_ip_ranges) &&
                    !this.ipRangeExecResultsAsObject[scratchOrg.username]['success']
                )
                    scratchOrg.isScriptExecuted = false;

                if (scratchOrg.isScriptExecuted) {
                    SFPLogger.log(
                        `Script Execution completed for ${scratchOrg.username} with alias ${scratchOrg.alias}`,
                        LoggerLevel.INFO
                    );
                    ScratchOrgUtils.setScratchOrgInfo(
                        {
                            Id: scratchOrg.recordId,
                            Pooltag__c: this.poolConfig.pool.tag,
                            Allocation_status__c: 'Available',
                            Password__c: scratchOrg.password,
                            SfdxAuthUrl__c: scratchOrg.sfdxAuthUrl,
                        },
                        this.hubOrg
                    ).then(
                        (result: boolean) => {
                            scratchOrg.isScriptExecuted = true;
                            fs.closeSync(fdr);
                            resolve({
                                isSuccess: true,
                                message: 'Successfuly set the scratch org record in Pool',
                                scratchOrgUsername: scratchOrg.username,
                                status: 'success',
                            });
                        },
                        (reason: any) => {
                            fs.closeSync(fdr);
                            scratchOrg.isScriptExecuted = false;
                            resolve({
                                isSuccess: false,
                                message: 'Unable to set the scratch org record in Pool',
                                scratchOrgUsername: scratchOrg.username,
                                status: 'failure',
                            });
                        }
                    );
                }
            });

            ls.stderr.on('data', function (data) {
                fs.appendFileSync(`script_exec_outputs/${scratchOrg.alias}.log`, data);
            });

            ls.stdout.on('data', function (data) {
                fs.appendFileSync(`script_exec_outputs/${scratchOrg.alias}.log`, data);
            });
        });
    }

    private arrayToObject = (array, keyfield) =>
        array.reduce((obj, item) => {
            obj[item[keyfield]] = item;
            return obj;
        }, {});

    private validateSoPoolConfig(soPoolConfig: PoolConfig): void {
        if (!soPoolConfig.pool.max_allocation && !soPoolConfig.poolUsers) {
            throw new Error('Max allocation field is required for tag mode.');
        }

        let schema = fs.readJSONSync(
            path.join(__dirname, '..', '..', '..', '..', 'resources', 'so_pool_config.schema.json'),
            { encoding: 'UTF-8' }
        );

        let validator = new Ajv({ allErrors: true, strictTuples: false }).compile(schema);
        let validationResult = validator(soPoolConfig);

        if (!validationResult) {
            let errorMsg: string =
                `SO Pool Config does not meet schema requirements, ` +
                `found ${validator.errors.length} validation errors:\n`;

            validator.errors.forEach((error, errorNum) => {
                errorMsg += `\n${errorNum + 1}: ${error.schemaPath}: ${error.message} ${JSON.stringify(
                    error.params,
                    null,
                    4
                )}`;
            });

            throw new Error(errorMsg);
        }
    }
}

export interface PoolConfig {
    pool: Pool;
    poolUsers: PoolUser[];
}

export interface Pool {
    expiry: number;
    config_file_path: string;
    script_file_path?: string;
    tag: string;
    user_mode: boolean;
    relax_all_ip_ranges: boolean;
    relax_ip_ranges: IpRanges[];
    max_allocation: number;
    alias_prefix?: string;
}

export interface PoolUser {
    max_allocation: number;
    min_allocation: number;
    is_build_pooluser: boolean;
    username?: string;
    expiry?: number;
    priority: number;
    scripts?: string[];
    current_allocation?: number;
    to_allocate?: number;
    to_satisfy_min?: number;
    to_satisfy_max?: number;
    scratchOrgs?: ScratchOrg[];
}

interface ScriptExecutionResult {
    status: string;
    message: string;
    scratchOrgUsername: string;
    isSuccess: boolean;
}
interface IpRanges {
    start: string;
    end: string;
}
