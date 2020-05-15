import ScratchOrgUtils, { ScratchOrg } from "./scratchOrgUtils";
import { Connection, LoggerLevel, Org, AuthInfo } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";
import * as fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import Bottleneck from "bottleneck";
import { isNullOrUndefined } from "util";
import RelaxIPRangeImpl from "../../org/relaxIPRangeImpl";

const limiter = new Bottleneck({
  maxConcurrent: 10
});

export default class PoolCreateImpl {
  private poolconfigFilePath: string;
  private hubOrg: Org;
  private hubConn: Connection;
  private apiversion: string;
  private poolConfig: PoolConfig;
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

  public async poolScratchOrgs() {
    let scriptExecResults: Array<Promise<ScriptExecutionResult>> = new Array();
    let ipRangeExecResults: Array<Promise<boolean>> = new Array();

    this.hubConn = this.hubOrg.getConnection();
    await this.hubOrg.refreshAuth();

    //Read pool config file
    this.poolConfig = JSON.parse(fs.readFileSync(this.poolconfigFilePath));

    //Set Tag Only mode activated for the default use case
    if (isNullOrUndefined(this.poolConfig.pool.user_mode)) {
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

    SFPowerkit.log("Pool Config:" + this.poolConfig, LoggerLevel.TRACE);

    if (isNullOrUndefined(this.poolConfig.pool.relax_ip_ranges)) {
      SFPowerkit.log(
        "IP Ranges are not relaxed, The created scratch org's will have the pool creators email as Admin Email and has to be verifed before use",
        LoggerLevel.WARN
      );
    }

    //fetch current status limits
    let limits: any;
    try {
      limits = await ScratchOrgUtils.getScratchOrgLimits(
        this.hubOrg,
        this.apiversion
      );
    } catch (error) {
      SFPowerkit.log("Unable to connect to DevHub", LoggerLevel.ERROR);
      return;
    }

    SFPowerkit.log(
      `Active Scratch Orgs Remaining: ${limits.ActiveScratchOrgs.Remaining} out of ${limits.ActiveScratchOrgs.Max}`,
      LoggerLevel.INFO
    );

    //Compute current pool requirement
    if (this.poolConfig.pool.user_mode) {
      //Retrieve Number of active SOs in the org
      let scratchOrgsRecordAsMapByUser = await ScratchOrgUtils.getScratchOrgRecordsAsMapByUser(
        this.hubOrg
      );
      this.allocateScratchOrgsPerUser(
        limits.ActiveScratchOrgs.Remaining,
        scratchOrgsRecordAsMapByUser,
        this.poolConfig.poolUsers
      );
    } else {
      let activeCount = await ScratchOrgUtils.getCountOfActiveScratchOrgsByTag(
        this.poolConfig.pool.tag,
        this.hubOrg
      );
      this.allocateScratchOrgsPerTag(
        limits.ActiveScratchOrgs.Remaining,
        activeCount,
        this.poolConfig.pool.tag,
        this.poolConfig.poolUsers[0]
      );

      SFPowerkit.log(JSON.stringify(this.poolConfig), LoggerLevel.TRACE);
      //No need to allocate return;
      if (this.poolConfig.poolUsers[0].to_allocate == 0) {
        SFPowerkit.log(
          `The tag provided ${this.poolConfig.pool.tag} is currently at the maximum capacity, No scratch orgs will be allocated`,
          LoggerLevel.INFO
        );
        return;
      }
    }

    //Generate Scratch Orgs
    for (let poolUser of this.poolConfig.poolUsers) {
      let count = 1;
      poolUser.scratchOrgs = new Array<ScratchOrg>();
      for (let i = 0; i < poolUser.to_allocate; i++) {
        SFPowerkit.log(
          `Creating Scratch  Org for ${
            poolUser.username ? poolUser.username : this.poolConfig.pool.tag
          }: ${count} of ${poolUser.to_allocate}`,
          LoggerLevel.DEBUG
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
        } catch (error) {
          SFPowerkit.log(
            "Unable to provision scratch org " + error,
            LoggerLevel.TRACE
          );
          break;
        }
        count++;
      }
    }

    SFPowerkit.log(
      "Pool:" + JSON.stringify(this.poolConfig.poolUsers),
      LoggerLevel.TRACE
    );

    let ts = Math.floor(Date.now() / 1000);

    for (let poolUser of this.poolConfig.poolUsers) {
      poolUser.scratchOrgs.forEach(scratchOrg => {
        SFPowerkit.log(JSON.stringify(scratchOrg), LoggerLevel.DEBUG);

        let resultForIPRelaxation = this.ipRangeRelaxerWrappedForBottleneck(
          scratchOrg
        );
        ipRangeExecResults.push(resultForIPRelaxation);

        let result = this.scriptExecutorWrappedForBottleneck(
          this.poolConfig.pool.script_file_path,
          scratchOrg,
          this.hubOrg.getUsername()
        );
        scriptExecResults.push(result);
      });
    }

    await Promise.all(ipRangeExecResults);
    let execResults = await Promise.all(scriptExecResults);

    SFPowerkit.log(JSON.stringify(execResults), LoggerLevel.TRACE);
    ts = Math.floor(Date.now() / 1000) - ts;
    SFPowerkit.log(
      `Script Execution completed in ${ts} Seconds`,
      LoggerLevel.INFO
    );
    this.resultAnalyzer(execResults);

    //Store Username Passwords
    for (let poolUser of this.poolConfig.poolUsers) {
      await ScratchOrgUtils.getScratchOrgRecordId(
        poolUser.scratchOrgs,
        this.hubOrg
      );

      for (let scratchOrg of poolUser.scratchOrgs) {
        if (scratchOrg.isScriptExecuted) {
          await ScratchOrgUtils.setScratchOrgInfo(
            {
              Id: scratchOrg.recordId,
              pooltag__c: this.poolConfig.pool.tag,
              Password__c: scratchOrg.password
            },
            this.hubOrg
          );
        } else {
          //Delete failed scratch org
          await ScratchOrgUtils.deleteScratchOrg(
            this.hubOrg,
            this.apiversion,
            scratchOrg.recordId
          );
        }
      }
    }
  }

  private allocateScratchOrgsPerTag(
    remainingScratchOrgs: number,
    countOfActiveScratchOrgs: number,
    tag: string,
    poolUser: PoolUser
  ) {
    poolUser.current_allocation = countOfActiveScratchOrgs;
    poolUser.to_allocate = 0;
    poolUser.to_satisfy_max =
      poolUser.max_allocation - poolUser.current_allocation > 0
        ? poolUser.max_allocation - poolUser.current_allocation
        : 0;

    if (
      poolUser.to_satisfy_max > 0 &&
      poolUser.to_satisfy_max < remainingScratchOrgs
    ) {
      poolUser.to_allocate = poolUser.to_satisfy_max;
    } else if (
      poolUser.to_satisfy_max > 0 &&
      poolUser.to_satisfy_max > remainingScratchOrgs
    ) {
      poolUser.to_allocate = remainingScratchOrgs;
    }
  }

  private allocateScratchOrgsPerUser(
    remainingScratchOrgs: number,
    scratchOrgsRecordAsMapByUser: any,
    poolUsers: PoolUser[]
  ) {
    //sort pooleconfig.poolusers based on priority
    poolUsers = poolUsers.sort((a, b) => a.priority - b.priority);
    let totalMaxOrgRequired: number = 0,
      totalMinOrgRequired: number = 0;

    poolUsers.forEach(pooluser => {
      SFPowerkit.log(pooluser, LoggerLevel.TRACE);
      pooluser.to_allocate = 0;

      if (scratchOrgsRecordAsMapByUser[pooluser.username]) {
        pooluser.current_allocation =
          scratchOrgsRecordAsMapByUser[pooluser.username].In_Use;
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
      });
    } else if (totalMinOrgRequired <= remainingScratchOrgs) {
      // Satisfy min
      //First allocate minimum to everyone

      poolUsers.forEach(pooluser => {
        pooluser.to_allocate = pooluser.to_satisfy_min;
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

            leftOver--;
          }
        });
      }
    }
  }

  private async ipRangeRelaxer(scratchOrg: ScratchOrg): Promise<any> {
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
    scriptFilePath = path.normalize(scriptFilePath);
    if (process.platform != "win32") {
      cmd = `bash ${scriptFilePath} SCRATCH_ORG="${scratchOrg.username}" DEVHUB="${hubOrgUserName}"`;
    } else {
      cmd = `cmd.exe /c ${scriptFilePath}  "SCRATCH_ORG=${scratchOrg.username}" "DEVHUB=${hubOrgUserName}"`;
    }
    SFPowerkit.log(`Executing command: ${cmd}`, LoggerLevel.INFO);
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
        }

        if (stderr) SFPowerkit.log(stderr, LoggerLevel.DEBUG);

        SFPowerkit.log(
          `Executing script for ${scratchOrg.username}`,
          LoggerLevel.INFO
        );
        SFPowerkit.log(stdout, LoggerLevel.DEBUG);
        scratchOrg.isScriptExecuted = true;
        resolve({
          isSuccess: true,
          message: stdout,
          scratchOrgUsername: scratchOrg.username,
          status: "success"
        });
      });

      ls.stdout.on("data", function(data) {
        SFPowerkit.log(
          `Processing for ${scratchOrg.username}: IN_PROGRESS....`,
          LoggerLevel.INFO
        );
      });
    });
  }

  private resultAnalyzer(execResults: ScriptExecutionResult[]) {
    let failed = 0;
    let success = 0;
    let total = execResults.length;
    for (const element of execResults) {
      if (!element.isSuccess) {
        failed++;
        SFPowerkit.log(
          `Failed to execute scripts for ${element.scratchOrgUsername}`,
          LoggerLevel.WARN
        );
        continue;
      }
      success++;
    }

    SFPowerkit.log(
      `Executed ${total} scripts.. of which ${success} passed with ${failed} failures`,
      LoggerLevel.INFO
    );
  }
}

export interface PoolConfig {
  pool: Pool;
  poolUsers: PoolUser[];
}

export interface Pool {
  expiry: number;
  config_file_path: string;
  script_file_path?: string[];
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
