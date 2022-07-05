import { LoggerLevel, Org } from '@salesforce/core';
import { Sfpowerkit } from '../../../sfpowerkit';
import ScratchOrgUtils, { ScratchOrg } from '../../../utils/scratchOrgUtils';
export default class PoolDeleteImpl {
    private hubOrg: Org;
    private apiversion: string;
    private tag: string;
    private mypool: boolean;
    private allScratchOrgs: boolean;
    private inprogressonly: boolean;

    public constructor(
        hubOrg: Org,
        apiversion: string,
        tag: string,
        mypool: boolean,
        allScratchOrgs: boolean,
        inprogressonly: boolean
    ) {
        this.hubOrg = hubOrg;
        this.apiversion = apiversion;
        this.tag = tag;
        this.mypool = mypool;
        this.allScratchOrgs = allScratchOrgs;
        this.inprogressonly = inprogressonly;
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
            Sfpowerkit.log(`${this.tag} pool has ${results.records.length} Scratch orgs.`, LoggerLevel.TRACE);

            let scrathOrgIds: string[] = [];

            for (let element of results.records) {
                if (!this.inprogressonly || element.Allocation_status__c === 'In Progress') {
                    let soDetail: ScratchOrg = {};
                    soDetail.orgId = element.ScratchOrg;
                    soDetail.loginURL = element.LoginUrl;
                    soDetail.username = element.SignupUsername;
                    soDetail.expiryDate = element.ExpirationDate;
                    soDetail.status = 'Deleted';

                    scratchOrgToDelete.push(soDetail);
                    scrathOrgIds.push(`'${element.Id}'`);
                }
            }

            if (scrathOrgIds.length > 0) {
                let activeScrathOrgs = await ScratchOrgUtils.getActiveScratchOrgsByInfoId(
                    this.hubOrg,
                    scrathOrgIds.join(',')
                );

                if (activeScrathOrgs.records.length > 0) {
                    let scratchOrgIds: string[] = activeScrathOrgs.records.map((elem) => elem.Id);
                    await ScratchOrgUtils.deleteScratchOrg(this.hubOrg, scratchOrgIds);
                    Sfpowerkit.log('Scratch Org(s) deleted successfully.', LoggerLevel.TRACE);
                }
            }
        }

        return scratchOrgToDelete;
    }
}
