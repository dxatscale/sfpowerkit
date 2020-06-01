import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import request from "request-promise-native";
import { spawn } from "child_process";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "scratchorg_usage");

export default class Usage extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:scratchorg:usage -v devhub
    Active Scratch Orgs Remaining: 42 out of 100
    Daily Scratch Orgs Remaining: 171 out of 200

    SCRATCH_ORGS_USED  NAME
    ─────────────────  ─────────────────
    2                  XYZ@KYZ.COM
    2                  JFK@KYZ.COM
    Total number of records retrieved: 4.
  `
  ];

  // Comment this out if your command does not require a hub org username
  protected static requiresDevhubUsername = true;

  public async run(): Promise<AnyJson> {
    await this.hubOrg.refreshAuth();
    const conn = this.hubOrg.getConnection();
    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    let limits = await this.getScratchOrgLimits(conn);

    this.ux.log(
      `Active Scratch Orgs Remaining: ${limits.ActiveScratchOrgs.Remaining} out of ${limits.ActiveScratchOrgs.Max}`
    );
    this.ux.log(
      `Daily Scratch Orgs Remaining: ${limits.DailyScratchOrgs.Remaining} out of ${limits.DailyScratchOrgs.Max}`
    );

    this.ux.log("");

    if (limits.ActiveScratchOrgs.Remaining !== limits.ActiveScratchOrgs.Max) {
      let scratchOrgs = await this.getScratchOrgInfo(conn);
      //this.ux.log(scratchOrgs);
      const output = [];
      scratchOrgs.records.forEach(element => {
        output.push({
          In_Use: element.In_Use,
          SignupEmail: element.SignupEmail
        });
      });
      this.ux.table(output, ["In_Use", "SignupEmail"]);
    } else {
      this.ux.log(`No Scratch org used currently.`);
    }

    return 1;
  }

  private async getScratchOrgLimits(conn: core.Connection) {
    var query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/limits`;

    //this.ux.log(`Query URI ${query_uri}`);

    const limits = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    return limits;
  }
  private async getScratchOrgInfo(conn: core.Connection) {
    let query =
      "SELECT count(id) In_Use, SignupEmail FROM ActiveScratchOrg GROUP BY SignupEmail ORDER BY count(id) DESC";

    const results = (await conn.query(query)) as any;

    return results;
  }
}
