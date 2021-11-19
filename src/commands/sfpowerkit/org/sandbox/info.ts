import { core, flags } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
let request = require("request-promise-native");
import { SfdxError } from "@salesforce/core";
import { SFPowerkit, LoggerLevel } from "../../../../sfpowerkit";
import SFPowerkitCommand from "../../../../sfpowerkitCommand";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "sandbox_info");

export default class Info extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:sandbox:info -n test2  -v produser@example.com 
  Successfully Enqueued Refresh of Sandbox
  `
  ];

  protected static flagsConfig = {
    name: flags.string({
      required: true,
      char: "n",
      description: messages.getMessage("nameFlagDescription")
    }),
    showonlylatest: flags.boolean({
      required: false,
      char: "s",
      default: false,
      description: messages.getMessage("showOnlyLatestFlagDescription")
    })
  };

  // Comment this out if your command does not require a hub org username
  protected static requiresDevhubUsername = true;

  public async execute(): Promise<AnyJson> {
    SFPowerkit.setLogLevel("INFO", false);
    await this.hubOrg.refreshAuth();

    const conn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    var result = await this.getSandboxInfo(conn, this.flags.name);

    SFPowerkit.log(`Successfully Retrieved Sandbox Details`, LoggerLevel.INFO);

    if (!this.flags.json) this.ux.logJson(result);

    return result;
  }

  private async getSandboxInfo(conn: core.Connection, name: string) {
    var query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=SELECT+Id,SandboxName+FROM+SandboxProcess+WHERE+SandboxName+in+('${name}')+ORDER+BY+EndDate+DESC`;

    const sandbox_query_result = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    if (sandbox_query_result.records[0] == undefined)
      throw new SfdxError(`Unable to find a sandbox with name: ${name}`);

    var result = await this.processSandboxInfo(
      sandbox_query_result.records,
      conn,
      this.flags.showonlylatest
    );

    return result;
  }

  private async processSandboxInfo(sandboxRecords, conn, isShowOnlyLatest) {
    var result = [];

    for (const item of sandboxRecords) {
      var output = await this.getDetailedSandboxInfo(item.attributes.url, conn);
      result.push(output);
      if (isShowOnlyLatest) break;
    }
    return result;
  }

  private async getDetailedSandboxInfo(
    sandboxInfoUl: string,
    conn: core.Connection
  ) {
    const query_uri = `${conn.instanceUrl}${sandboxInfoUl}`;

    const sandbox_query_result = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    return sandbox_query_result;
  }
}
