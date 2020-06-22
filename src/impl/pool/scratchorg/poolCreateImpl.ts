import ScratchOrgUtils, { ScratchOrg } from "../../../utils/scratchOrgUtils";
import { Connection, LoggerLevel, Org, AuthInfo } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";
import * as fs from "fs-extra";

import { exec } from "child_process";
import Bottleneck from "bottleneck";
import { isNullOrUndefined } from "util";
import RelaxIPRangeImpl from "../../org/relaxIPRangeImpl";
import FileUtils from "../../../utils/fileutils";
import * as path from "path";
import * as rimraf from "rimraf";

const limiter = new Bottleneck({
  maxConcurrent: 10
});

export default class PoolCreateImpl {
  private poolconfigFilePath: string;
  private hubOrg: Org;
  private hubConn: Connection;
  private apiversion: string;
  private poolConfig: PoolConfig;
  private totalToBeAllocated: number;
  private ipRangeExecResults;
  private ipRangeExecResultsAsObject;
  private limits;
  private scriptFileExists: boolean;
  private totalAllocated: number = 0;

  private scriptExecutorWrappedForBottleneck = limiter.wrap(
    this.scriptExecutor
  );
  private ipRangeRelaxerWrappedForBottleneck = limiter.wrap(
    this.ipRangeRelaxer
  );

  public constructor(
    poolconfigFilePath: string,
    hubOrg: Org,
    apiversion: string
  ) {
    this.poolconfigFilePath = poolconfigFilePath;
    this.hubOrg = hubOrg;
    this.apiversion = apiversion;
  }

  public async poolScratchOrgs(): Promise<boolean> {
    let scriptExecPromises: Array<Promise<ScriptExecutionResult>> = new Array();
    let ipRangeExecPromises: Array<Promise<{
      username: string;
      success: boolean;
    }>> = new Array();

    await this.hubOrg.refreshAuth();
    this.hubConn = this.hubOrg.getConnection();

    let preRequisiteCheck = await ScratchOrgUtils.checkForPreRequisite(
      this.hubOrg
    );

    if (!preRequisiteCheck) {
      SFPowerkit.log(
        "Required Prerequisite fields are missing in the DevHub, Please look into the wiki to getting the fields deployed in DevHub",
        LoggerLevel.ERROR
      );
      return false;
    }

    //Read pool config file

    if (!fs.existsSync(this.poolconfigFilePath)) {
      SFPowerkit.log(
        "Poll Config Path not provided, Unable to create pool without this file",
        LoggerLevel.ERROR
      );
      return false;
    }

    this.poolConfig = JSON.parse(
      fs.readFileSync(this.poolconfigFilePath).toString()
    );

    //Validate Inputs
    if (isNullOrUndefined(this.poolConfig.pool.config_file_path)) {
      SFPowerkit.log(
        "Scratch Org Config Path not provided, Unable to create pool without this file",
        LoggerLevel.ERROR
      );
      return true;
    }

    if (
      isNullOrUndefined(this.poolConfig.pool.expiry) ||
      isNullOrUndefined(this.poolConfig.pool.tag)
    ) {
      SFPowerkit.log(
        "Some Key parameters are missing in the schema,Please consult the documentation",
        LoggerLevel.ERROR
      );
      return true;
    }

    this.validateScriptFile();

    if (this.poolConfig.poolUsers && this.poolConfig.poolUsers.length > 0)
      this.poolConfig.pool.user_mode = true;
    else this.poolConfig.pool.user_mode = false;

    //Set Tag Only mode activated for the default use case
    if (this.poolConfig.pool.user_mode == false)
      this.setASingleUserForTagOnlyMode();

    SFPowerkit.log(
      "Pool Config:" + JSON.stringify(this.poolConfig),
      LoggerLevel.TRACE
    );

    if (
      isNullOrUndefined(this.poolConfig.pool.relax_ip_ranges) &&
      !this.poolConfig.pool.user_mode
    ) {
      SFPowerkit.log(
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
        SFPowerkit.log(
          `The tag provided ${this.poolConfig.pool.tag} is currently at the maximum capacity , No scratch orgs will be allocated`,
          LoggerLevel.INFO
        );
      else
        SFPowerkit.log(
          `There is no capacity to create a pool at this time, Please try again later`,
          LoggerLevel.INFO
        );
      return;
    }

    //Generate Scratch Orgs
    await this.generateScratchOrgs();

    // Assign workers to executed scripts
    let ts = Math.floor(Date.now() / 1000);
    for (let poolUser of this.poolConfig.poolUsers) {
      for (let scratchOrg of poolUser.scratchOrgs) {
        SFPowerkit.log(JSON.stringify(scratchOrg), LoggerLevel.DEBUG);

        if (this.poolConfig.pool.relax_ip_ranges) {
          let resultForIPRelaxation = this.ipRangeRelaxerWrappedForBottleneck(
            scratchOrg
          );
          ipRangeExecPromises.push(resultForIPRelaxation);
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
              Password__c: scratchOrg.password
            },
            this.hubOrg
          );
        }
      }
    }

    //Wait for scripts to finish execution
    if (this.poolConfig.pool.relax_ip_ranges)
      this.ipRangeExecResults = await Promise.all(ipRangeExecPromises);

    //Get IP Range results
    if (!isNullOrUndefined(this.poolConfig.pool.relax_ip_ranges))
      this.ipRangeExecResultsAsObject = this.arrayToObject(
        this.ipRangeExecResults,
        "username"
      );

    let scriptExecResults = await Promise.all(scriptExecPromises);

    if (this.scriptFileExists) {
      SFPowerkit.log(JSON.stringify(scriptExecResults), LoggerLevel.TRACE);
      ts = Math.floor(Date.now() / 1000) - ts;
      SFPowerkit.log(
        `Script Execution completed in ${ts} Seconds`,
        LoggerLevel.INFO
      );
    }

    //Commit Succesfull Scratch Orgs
    let commit_result: {
      success: number;
      failed: number;
    } = await this.finalizeGeneratedScratchOrgs();

    if (this.totalAllocated > 0) {
      SFPowerkit.log(
        `Request for provisioning ${this.totalToBeAllocated} scratchOrgs of which ${this.totalAllocated} were allocated with ${commit_result.success} success and ${commit_result.failed} failures`,
        LoggerLevel.INFO
      );
    } else {
      SFPowerkit.log(
        `Request for provisioning ${this.totalToBeAllocated} scratchOrgs of which ${this.totalAllocated} were allocated with ${commit_result.success} success and ${commit_result.failed} failures`,
        LoggerLevel.INFO
      );
    }
    return true;
  }

  private validateScriptFile() {
    if (isNullOrUndefined(this.poolConfig.pool.script_file_path)) {
      SFPowerkit.log(
        "Script Path not provided, will crete a pool of scratch orgs without any post creation steps",
        LoggerLevel.WARN
      );
      this.scriptFileExists = false;
    } else if (fs.existsSync(this.poolConfig.pool.script_file_path)) {
      this.scriptFileExists = true;
    } else {
      SFPowerkit.log(
        "Unable to locate Script File path, will crete a pool of scratch orgs without any post creation steps",
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
      priority: 1
    };
    //Add a single user
    this.poolConfig.poolUsers = [];
    this.poolConfig.poolUsers.push(poolUser);
    this.poolConfig.pool.user_mode = false;
  }

  private async fetchCurrentLimits() {
    try {
      this.limits = await ScratchOrgUtils.getScratchOrgLimits(
        this.hubOrg,
        this.apiversion
      );
    } catch (error) {
      SFPowerkit.log("Unable to connect to DevHub", LoggerLevel.ERROR);
      return;
    }

    SFPowerkit.log(
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

      let scratchOrgsRecordAsMapByUser = scratchOrgsResult.records.reduce(
        function(obj, v) {
          obj[v.SignupEmail] = (obj[v.SignupEmail] || 0) + 1;
          return obj;
        },
        {}
      );

      SFPowerkit.log(
        JSON.stringify(scratchOrgsRecordAsMapByUser),
        LoggerLevel.TRACE
      );

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
    for (let poolUser of this.poolConfig.poolUsers) {
      let count = 1;
      poolUser.scratchOrgs = new Array<ScratchOrg>();
      for (let i = 0; i < poolUser.to_allocate; i++) {
        SFPowerkit.log(
          `Creating Scratch  Org for ${count} of ${this.totalToBeAllocated}..`,
          LoggerLevel.INFO
        );
        try {
          let scratchOrg: ScratchOrg = await ScratchOrgUtils.createScratchOrg(
            count,
            poolUser.username,
            this.poolConfig.pool.config_file_path,
            poolUser.expiry ? poolUser.expiry : this.poolConfig.pool.expiry,
            this.hubOrg
          );
          poolUser.scratchOrgs.push(scratchOrg);
          this.totalAllocated++;
        } catch (error) {
          SFPowerkit.log(
            `Unable to provision scratch org  ${count} ..   `,
            LoggerLevel.INFO
          );
        }
        count++;
      }

      await ScratchOrgUtils.getScratchOrgRecordId(
        poolUser.scratchOrgs,
        this.hubOrg
      );
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

        SFPowerkit.log(
          `Failed to execute scripts for ${scratchOrg.username}.. Returning to Pool`,
          LoggerLevel.WARN
        );

        try {
          //Delete scratchorgs that failed to execute script
          await ScratchOrgUtils.deleteScratchOrg(
            this.hubOrg,
            this.apiversion,
            scratchOrg.recordId
          );
        } catch (error) {
          SFPowerkit.log(
            `Unable to delete the scratchorg ${scratchOrg.username}..`,
            LoggerLevel.WARN
          );
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
    SFPowerkit.log(
      "Remaining ScratchOrgs" + remainingScratchOrgs,
      LoggerLevel.TRACE
    );
    poolUser.current_allocation = countOfActiveScratchOrgs;
    poolUser.to_allocate = 0;
    poolUser.to_satisfy_max =
      poolUser.max_allocation - poolUser.current_allocation > 0
        ? poolUser.max_allocation - poolUser.current_allocation
        : 0;

    if (
      poolUser.to_satisfy_max > 0 &&
      poolUser.to_satisfy_max <= remainingScratchOrgs
    ) {
      poolUser.to_allocate = poolUser.to_satisfy_max;
    } else if (
      poolUser.to_satisfy_max > 0 &&
      poolUser.to_satisfy_max > remainingScratchOrgs
    ) {
      poolUser.to_allocate = remainingScratchOrgs;
    }

    SFPowerkit.log(
      "Computed Allocation" + JSON.stringify(poolUser),
      LoggerLevel.TRACE
    );
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
    let totalMaxOrgRequired: number = 0,
      totalMinOrgRequired: number = 0;

    poolUsers.forEach(pooluser => {
      SFPowerkit.log(pooluser, LoggerLevel.TRACE);
      pooluser.to_allocate = 0;

      if (scratchOrgsRecordAsMapByUser[pooluser.username]) {
        pooluser.current_allocation =
          scratchOrgsRecordAsMapByUser[pooluser.username];

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
      poolUsers.forEach(pooluser => {
        pooluser.to_allocate = pooluser.to_satisfy_max;
        totalToBeAllocated += pooluser.to_satisfy_max;
      });
    } else if (totalMinOrgRequired <= remainingScratchOrgs) {
      // Satisfy min
      //First allocate minimum to everyone

      poolUsers.forEach(pooluser => {
        pooluser.to_allocate = pooluser.to_satisfy_min;
        totalToBeAllocated += pooluser.to_satisfy_min;
      });
      //Check for left overs
      let leftOver = remainingScratchOrgs - totalMinOrgRequired;

      if (leftOver > 0) {
        //Allocate LeftOver in a round robin model
        while (leftOver >= 0) {
          poolUsers.forEach(pooluser => {
            if (leftOver == 0) return;
            if (
              pooluser.current_allocation + pooluser.to_allocate <
              pooluser.to_satisfy_max
            ) {
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
        poolUsers.forEach(pooluser => {
          if (
            pooluser.current_allocation + pooluser.to_allocate <
            pooluser.to_satisfy_max
          ) {
            pooluser.to_allocate++;
            totalToBeAllocated++;

            leftOver--;
          }
        });
      }
    }

    return totalToBeAllocated;
  }

  private async ipRangeRelaxer(
    scratchOrg: ScratchOrg
  ): Promise<{ username: string; success: boolean }> {
    //executue using bash
    SFPowerkit.log(
      `Relaxing ip ranges for scratchOrg with user ${scratchOrg.username}`,
      LoggerLevel.INFO
    );
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username: scratchOrg.username })
    });
    return RelaxIPRangeImpl.setIp(
      connection,
      scratchOrg.username,
      this.poolConfig.pool.relax_ip_ranges
    );
  }

  private async scriptExecutor(
    scriptFilePath,
    scratchOrg: ScratchOrg,
    hubOrgUserName
  ): Promise<ScriptExecutionResult> {
    //executue using bash
    let cmd;
    let logRestricter = 0;

    SFPowerkit.log(`Script File Path: ${scriptFilePath}`, LoggerLevel.TRACE);

    scriptFilePath = path.normalize(scriptFilePath);

    rimraf.sync("script_exec_outputs");
    FileUtils.mkDirByPathSync("script_exec_outputs");

    if (process.platform != "win32") {
      cmd = `bash ${scriptFilePath}  ${scratchOrg.username}  ${hubOrgUserName} `;
    } else {
      cmd = `cmd.exe /c ${scriptFilePath}  ${scratchOrg.username}  ${hubOrgUserName}`;
    }
    SFPowerkit.log(`Executing command: ${cmd}`, LoggerLevel.INFO);

    SFPowerkit.log(
      `Executing script for ${scratchOrg.alias} with username: ${scratchOrg.username}`,
      LoggerLevel.INFO
    );

    SFPowerkit.log(
      `Script Execution result written to script_exec_outputs/${scratchOrg.alias} `,
      LoggerLevel.INFO
    );

    return new Promise((resolve, reject) => {
      let ls = exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          SFPowerkit.log(
            `failed to execute script for ${scratchOrg.username}`,
            LoggerLevel.WARN
          );
          scratchOrg.isScriptExecuted = false;

          resolve({
            isSuccess: false,
            message: error.message,
            scratchOrgUsername: scratchOrg.username,
            status: "failure"
          });
          return;
        }

        if (stderr) {
          SFPowerkit.log(stderr, LoggerLevel.DEBUG);
          fs.appendFileSync(`script_exec_outputs/${scratchOrg.alias}`, stderr);
        }

        scratchOrg.isScriptExecuted = true;

        if (
          this.poolConfig.pool.relax_ip_ranges &&
          !this.ipRangeExecResultsAsObject[scratchOrg.username]["success"]
        )
          scratchOrg.isScriptExecuted = false;

        if (scratchOrg.isScriptExecuted) {
          ScratchOrgUtils.setScratchOrgInfo(
            {
              Id: scratchOrg.recordId,
              Pooltag__c: this.poolConfig.pool.tag,
              Password__c: scratchOrg.password
            },
            this.hubOrg
          ).then(
            (result: boolean) => {
              scratchOrg.isScriptExecuted = true;
              resolve({
                isSuccess: true,
                message: "Successfuly set the scratch org record in Pool",
                scratchOrgUsername: scratchOrg.username,
                status: "success"
              });
            },
            (reason: any) => {
              scratchOrg.isScriptExecuted = false;
              resolve({
                isSuccess: false,
                message: "Unable to set the scratch org record in Pool",
                scratchOrgUsername: scratchOrg.username,
                status: "failure"
              });
            }
          );
        }
      });

      ls.stdout.on("data", function(data) {
        fs.appendFileSync(`script_exec_outputs/${scratchOrg.alias}`, data);
        //Print only processing if there is more than 5 logs, Restrict Verbose scripts like sfpowerkit package dependencies install
        if (logRestricter % 10 == 0) {
          SFPowerkit.log(
            `Processing for ${scratchOrg.alias} with ${scratchOrg.username}: IN_PROGRESS....`,
            LoggerLevel.INFO
          );
        }
        logRestricter++;
      });
    });
  }

  private arrayToObject = (array, keyfield) =>
    array.reduce((obj, item) => {
      obj[item[keyfield]] = item;
      return obj;
    }, {});
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
  relax_ip_ranges: IpRanges[];
  max_allocation: number;
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
