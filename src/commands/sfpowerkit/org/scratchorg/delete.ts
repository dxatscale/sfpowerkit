import {  flags } from "@salesforce/command";
import { Connection, Messages, SfdxError } from "@salesforce/core";
import { AnyJson } from "@salesforce/ts-types";
import ScratchOrgUtils from "../../../../utils/scratchOrgUtils";
import SFPowerkitCommand from "../../../../sfpowerkitCommand"
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("sfpowerkit", "scratchorg_delete");

export default class Delete extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:scratchorg:delete  -e xyz@kyz.com -v devhub`,
    `$ sfdx sfpowerkit:org:scratchorg:delete  -u xyz@kyz.com -v devhub`,
    `$ sfdx sfpowerkit:org:scratchorg:delete  -e xyz@kyz.com -v devhub --ignorepool`
  ];

  // Comment this out if your command does not require a hub org username
  protected static requiresDevhubUsername = true;

  protected static flagsConfig = {
    email: flags.string({
      required: false,
      char: "e",
      exclusive: ["username"],
      description: messages.getMessage("emailFlagDescription"),
    }),
    username: flags.string({
      required: false,
      char: "u",
      exclusive: ["email"],
      description: messages.getMessage("usernameFlagDescription"),
    }),
    ignorepool: flags.boolean({
      required: false,
      dependsOn: ["email"],
      description: messages.getMessage("ignorePoolFlagDescription")
    }),
    dryrun: flags.boolean({
      required: false,
      description: messages.getMessage("dryRunFlagDescription")
    })
  };

  public async execute(): Promise<AnyJson> {
    if (!this.flags.username && !this.flags.email) {
      throw new SfdxError(
        "Required flags are missing, Please provide either username or email."
      );
    }

    await this.hubOrg.refreshAuth();
    const conn = this.hubOrg.getConnection();
    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    let info = await this.getActiveScratchOrgsForUser(
      conn,
      this.flags.email,
      this.flags.username
    );

    if (info.totalSize > 0) {
      this.ux.log(
        `Found ${info.totalSize} Scratch Org(s) for the given ${
          this.flags.username
            ? "Username: " + this.flags.username
            : "Email: " + this.flags.email
        } in devhub ${this.hubOrg.getUsername()}.\n`
      );
      this.ux.table(info.records, [
        "Id",
        "ScratchOrg",
        "SignupUsername",
        "SignupEmail",
        "ExpirationDate",
      ]);

      if (!this.flags.dryrun) {
        let scratchOrgIds: string[] = info.records.map((elem) => elem.Id);
        await ScratchOrgUtils.deleteScratchOrg(this.hubOrg, scratchOrgIds);
        this.ux.log("Scratch Org(s) deleted successfully.");
      }
    } else {
      this.ux.log(
        `No Scratch Org(s) found for the given ${
          this.flags.username
            ? "Username: " + this.flags.username
            : "Email: " + this.flags.email
        } in devhub ${this.hubOrg.getUsername()}.`
      );
    }

    return 1;
  }

  private async getActiveScratchOrgsForUser(
    conn: Connection,
    email: string,
    username: string
  ): Promise<any> {
    let query = `SELECT Id, ScratchOrg, SignupUsername, SignupEmail, ExpirationDate FROM ActiveScratchOrg`;

    if (username) {
      query = `${query} WHERE SignupUsername = '${username}'`;
    } else {
      query = `${query} WHERE SignupEmail = '${email}'`;
    }

    if (this.flags.ignorepool && !username) {
      const orgIds = await this.getOrgIdOfPooledScratchOrgs();
      const collection = orgIds.map((id) => `'${id}'`).toString();
      query += ` AND ScratchOrg NOT IN (${collection})`;
    }

    const scratch_orgs = (await conn.query(query)) as any;

    return scratch_orgs;
  }

  private async getOrgIdOfPooledScratchOrgs(): Promise<string[]> {
    const results = await ScratchOrgUtils.getScratchOrgsByTag(null, this.hubOrg, false, false);
    return results.records.map((record) => record.ScratchOrg)
  }
}
