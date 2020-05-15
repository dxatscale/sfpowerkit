import { Connection, LoggerLevel, Org, SfdxError } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";
import { ScratchOrg } from "./scratchOrgUtils";
import ScratchOrgUtils from "./ScratchOrgUtils";
export default class PoolFetchImpl {
  private hubOrg: Org;
  private apiversion: string;
  private tag: string;
  private mypool: boolean;

  public constructor(
    hubOrg: Org,
    apiversion: string,
    tag: string,
    mypool: boolean
  ) {
    this.hubOrg = hubOrg;
    this.apiversion = apiversion;
    this.tag = tag;
    this.mypool = mypool;
  }

  public async execute(): Promise<ScratchOrg> {
    const results = (await ScratchOrgUtils.getScratchOrgsByTag(
      this.tag,
      this.hubOrg,
      this.mypool,
      true
    )) as any;

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
          soDetail.orgId = element.ScratchOrg;
          soDetail.loginURL = element.LoginUrl;
          soDetail.username = element.SignupUsername;
          soDetail.password = element.password__c;
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

    return soDetail;
  }
}
