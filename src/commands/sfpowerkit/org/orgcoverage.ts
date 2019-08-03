import { core, flags, SfdxCommand, Result } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import fs = require("fs-extra");
import request = require("request-promise-native");
import rimraf = require("rimraf");
const querystring = require("querystring");

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "org_coverage");

export default class OrgCoverage extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:orgcoverage  -u myOrg@example.com
  Successfully Retrieved the Apex Test Coverage of the org XXXX
  coverage:85
  `
  ];

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");

    await this.org.refreshAuth();

    const conn = this.org.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    var apexcoverage = new ApexCoverage();
    apexcoverage.coverage = await this.getApexCoverage(conn);

    if (this.flags.outputfile) {
      await fs.outputJSON(this.flags.outputfile, apexcoverage);
    }

    this.ux.log(
      `Successfully Retrieved the Apex Test Coverage of the org ${this.org.getOrgId()} `
    );
    this.ux.log(`coverage:${apexcoverage.coverage}`);

    return { coverage: apexcoverage.coverage };
  }

  public async getApexCoverage(conn: core.Connection) {
    var encoded_querystring = querystring.escape(
      `SELECT PercentCovered FROM ApexOrgWideCoverage`
    );

    var query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=${encoded_querystring}`;

    //this.ux.log(`Query URI ${query_uri}`);

    const coverage_score_query_result = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    // this.ux.logJson(health_score_query_result);
    return coverage_score_query_result.records[0].PercentCovered;
  }
}

export class ApexCoverage {
  public coverage: number;
}
