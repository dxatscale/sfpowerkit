import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import request from "request-promise-native";
import ScratchOrgUtils from "../../../../utils/scratchOrgUtils";
// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "scratchorg_delete");

export default class Delete extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:scratchorg:delete  -e xyz@kyz.com -v devhub
    Found Scratch Org Ids for user xyz@kyz.com
    2AS6F000000XbxVWAS
    Deleting Scratch Orgs
    Deleted Scratch Org 2AS6F000000XbxVWAS
  `
  ];

  // Comment this out if your command does not require a hub org username
  protected static requiresDevhubUsername = true;

  protected static flagsConfig = {
    email: flags.string({
      required: true,
      char: "e",
      description: messages.getMessage("emailFlagDescription")
    })
  };

  public async run(): Promise<AnyJson> {
    await this.hubOrg.refreshAuth();
    const conn = this.hubOrg.getConnection();
    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    let info = await this.getActiveScratchOrgsForUser(conn, this.flags.email);

    if (info.totalSize > 0) {
      this.ux.log(`Found Scratch Org Ids for user ${this.flags.email}`);

      info.records.forEach(element => {
        this.ux.log(element.Id);
      });

      this.ux.log(`Deleting Scratch Orgs`);

      for (let element of info.records) {
        await ScratchOrgUtils.deleteScratchOrg(
          this.hubOrg,
          this.flags.apiversion,
          element.Id
        );
        this.ux.log(`Deleted Scratch Org ${element.Id}`);
      }
    } else {
      this.ux.log(`No Scratch Orgs to delete`);
    }

    return 1;
  }

  private async getActiveScratchOrgsForUser(
    conn: core.Connection,
    email: string
  ): Promise<any> {
    var query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/query?q=SELECT+Id+FROM+ActiveScratchOrg+WHERE+SignupEmail+=+'${email}'`;

    //this.ux.log(`Query URI ${query_uri}`);

    const scratch_orgs = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    return scratch_orgs;
  }
}
