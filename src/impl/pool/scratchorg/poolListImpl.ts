import { Connection, LoggerLevel, Org, SfdxError } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";
import ScratchOrgUtils, { ScratchOrg } from "../../../utils/scratchOrgUtils";

export default class PoolListImpl {
  private hubOrg: Org;
  private apiversion: string;
  private tag: string;
  private mypool: boolean;
  private allScratchOrgs: boolean;

  public constructor(
    hubOrg: Org,
    apiversion: string,
    tag: string,
    mypool: boolean,
    allScratchOrgs: boolean
  ) {
    this.hubOrg = hubOrg;
    this.apiversion = apiversion;
    this.tag = tag;
    this.mypool = mypool;
    this.allScratchOrgs = allScratchOrgs;
  }

  public async execute(): Promise<ScratchOrg[]> {
    const results = (await ScratchOrgUtils.getScratchOrgsByTag(
      this.tag,
      this.hubOrg,
      this.mypool,
      !this.allScratchOrgs
    )) as any;

    let scratchOrgToDelete: ScratchOrg[] = new Array<ScratchOrg>();
    if (results.records.length > 0) {
      SFPowerkit.log(
        `${this.tag} pool has ${results.records.length} Scratch orgs available`,
        LoggerLevel.TRACE
      );

      for (let element of results.records) {
        let soDetail: ScratchOrg = {};
        soDetail.tag = element.Pooltag__c;
        soDetail.orgId = element.ScratchOrg;
        soDetail.loginURL = element.LoginUrl;
        soDetail.username = element.SignupUsername;
        soDetail.password = element.Password__c;
        soDetail.expityDate = element.ExpirationDate;
        soDetail.status = element.Allocation_status__c
          ? "In use"
          : "Not in use";

        scratchOrgToDelete.push(soDetail);
      }
    }

    return scratchOrgToDelete;
  }
}
