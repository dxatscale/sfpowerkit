import { LoggerLevel, SfdxError } from "@salesforce/core";
import { core } from "@salesforce/command";
import { SFPowerkit } from "../../../sfpowerkit";
import ScratchOrgUtils, { ScratchOrg } from "../../../utils/scratchOrgUtils";
import { getUserEmail } from "../../../utils/getUserDetails";
export default class PoolFetchImpl {
  private hubOrg: core.Org;
  private tag: string;
  private mypool: boolean;
  private sendToUser: string;

  public constructor(
    hubOrg: core.Org,
    tag: string,
    mypool: boolean,
    sendToUser: string
  ) {
    this.hubOrg = hubOrg;
    this.tag = tag;
    this.mypool = mypool;
    this.sendToUser = sendToUser;
  }

  public async execute(): Promise<ScratchOrg> {
    const results = (await ScratchOrgUtils.getScratchOrgsByTag(
      this.tag,
      this.hubOrg,
      this.mypool,
      true
    )) as any;

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

    if (results.records.length > 0) {
      SFPowerkit.log(
        `${this.tag} pool has ${results.records.length} Scratch orgs available`,
        LoggerLevel.TRACE
      );

      for (let element of results.records) {
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

    if (results.records.length == 0 || !soDetail) {
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
}
