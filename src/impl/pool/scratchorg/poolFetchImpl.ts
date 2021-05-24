import { Connection, fs, LoggerLevel, Org, SfdxError } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";
import ScratchOrgUtils, { ScratchOrg } from "../../../utils/scratchOrgUtils";
import { getUserEmail } from "../../../utils/getUserDetails";
import child_process = require("child_process");
export default class PoolFetchImpl {
  private hubOrg: Org;
  private tag: string;
  private mypool: boolean;
  private sendToUser: string;
  private alias: string;
  private isScratchOrgNotTobeOpened: boolean;

  public constructor(
    hubOrg: Org,
    tag: string,
    mypool: boolean,
    sendToUser: string,
    alias: string,
    isScratchOrgNotTobeOpened: boolean
  ) {
    this.hubOrg = hubOrg;
    this.tag = tag;
    this.mypool = mypool;
    this.sendToUser = sendToUser;
    this.alias = alias;
    this.isScratchOrgNotTobeOpened = isScratchOrgNotTobeOpened;
  }

  public async execute(): Promise<ScratchOrg> {
    let isNewVersionCompatible = await ScratchOrgUtils.checkForNewVersionCompatible(
      this.hubOrg
    );
    const results = (await ScratchOrgUtils.getScratchOrgsByTag(
      this.tag,
      this.hubOrg,
      this.mypool,
      true
    )) as any;

    let availableSo = [];
    if (results.records.length > 0) {
      availableSo = !isNewVersionCompatible
        ? results.records
        : results.records.filter(
            (soInfo) => soInfo.Allocation_status__c === "Available"
          );
    }

    let emaiId;

    if (this.sendToUser) {
      try {
        emaiId = await getUserEmail(this.sendToUser, this.hubOrg);
      } catch (error) {
        SFPowerkit.log(
          "Unable to fetch details of the specified user, Check whether the user exists in the org ",
          LoggerLevel.ERROR
        );
        throw new SfdxError("Failed to fetch user details");
      }
    }

    let soDetail: ScratchOrg;

    if (availableSo.length > 0) {
      SFPowerkit.log(
        `${this.tag} pool has ${availableSo.length} Scratch orgs available`,
        LoggerLevel.TRACE
      );

      for (let element of availableSo) {
        let allocateSO = await ScratchOrgUtils.setScratchOrgInfo(
          { Id: element.Id, Allocation_status__c: "Allocate" },
          this.hubOrg
        );
        if (allocateSO === true) {
          SFPowerkit.log(
            `Scratch org ${element.SignupUsername} is allocated from the pool. Expiry date is ${element.ExpirationDate}`,
            LoggerLevel.TRACE
          );
          soDetail = {};
          soDetail["Id"] = element.Id;
          soDetail.orgId = element.ScratchOrg;
          soDetail.loginURL = element.LoginUrl;
          soDetail.username = element.SignupUsername;
          soDetail.password = element.Password__c;
          soDetail.expityDate = element.ExpirationDate;
          soDetail.sfdxAuthUrl = element.SfdxAuthUrl__c;
          soDetail.status = "Assigned";

          break;
        } else {
          SFPowerkit.log(
            `Scratch org ${element.SignupUsername} allocation failed. trying to get another Scratch org from ${this.tag} pool`,
            LoggerLevel.TRACE
          );
        }
      }
    }

    if (availableSo.length == 0 || !soDetail) {
      throw new SfdxError(
        `No scratch org available at the moment for ${this.tag}, try again in sometime.`
      );
    }

    if (this.sendToUser) {
      //Fetch the email for user id
      try {
        //Send an email for username
        await ScratchOrgUtils.shareScratchOrgThroughEmail(
          emaiId,
          soDetail,
          this.hubOrg
        );
      } catch (error) {
        SFPowerkit.log(
          "Unable to send the scratchorg details to specified user. Check whether the user exists in the org",
          LoggerLevel.ERROR
        );
      }
    }

    return soDetail;
  }

  public loginToScratchOrgIfSfdxAuthURLExits(soDetail: ScratchOrg) {
    if (soDetail.sfdxAuthUrl) {
      let soLogin: any = {};
      soLogin.sfdxAuthUrl = soDetail.sfdxAuthUrl;
      fs.writeFileSync("soAuth.json", JSON.stringify(soLogin));

      SFPowerkit.log(
        `Initiating Auto Login for Scratch Org with ${soDetail.username}`,
        LoggerLevel.INFO
      );

      if (this.alias)
        child_process.execSync(
          `sfdx auth:sfdxurl:store -f soAuth.json -a ${this.alias}`,
          { encoding: "utf8", stdio: "inherit" }
        );
      else
        child_process.execSync(`sfdx auth:sfdxurl:store -f soAuth.json`, {
          encoding: "utf8",
          stdio: "inherit",
        });

      fs.unlinkSync("soAuth.json");

      if (!this.isScratchOrgNotTobeOpened) {
        SFPowerkit.log(
          `Opening Scratch org ${soDetail.username}`,
          LoggerLevel.INFO
        );
        child_process.execSync(`sfdx force:org:open -u ${soDetail.username}`, {
          encoding: "utf8",
          stdio: "inherit",
        });
      }
    }
  }
}
