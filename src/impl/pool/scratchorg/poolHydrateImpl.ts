import { Connection, LoggerLevel, Org, SfdxError } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";
import ScratchOrgUtils, { ScratchOrg } from "./scratchOrgUtils";
export default class PoolFetchImpl {
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

      let scrathOrgIds: string[] = [];

      for (let element of results.records) {
        let soDetail: ScratchOrg = {};
        soDetail.orgId = element.ScratchOrg;
        soDetail.loginURL = element.LoginUrl;
        soDetail.username = element.SignupUsername;
        soDetail.expityDate = element.ExpirationDate;
        soDetail.status = "Deleted";

        scratchOrgToDelete.push(soDetail);
        scrathOrgIds.push(`'${element.Id}'`);
      }

      let activeScrathOrgs = await ScratchOrgUtils.getActiveScratchOrgsByInfoId(
        this.hubOrg,
        scrathOrgIds.join(",")
      );

      if (activeScrathOrgs.records.length > 0) {
        for (let ScratchOrg of activeScrathOrgs.records) {
          await ScratchOrgUtils.deleteScratchOrg(
            this.hubOrg,
            this.apiversion,
            ScratchOrg.Id
          );
          SFPowerkit.log(
            `Scratch org with username ${ScratchOrg.SignupUsername} is deleted successfully`,
            LoggerLevel.TRACE
          );
        }
      }
    }

    return scratchOrgToDelete;
  }
}
