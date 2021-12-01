import { FlagsConfig, flags } from "@salesforce/command";
import { Messages } from "@salesforce/core";
import SFPowerkitCommand from "../../../../sfpowerkitCommand"

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "sfpowerkit",
  "orgwideemail_verify"
);

export default class OrgWideEmail extends SFPowerkitCommand {
  public static description = messages.getMessage(
    "orgWideEmailVerifyCommandDescription"
  );

  public static examples = [
    `$ sfdx sfpowerkit:org:orgwideemail:verify --username scratchOrg --emailid orgwideemailid
  `
  ];

  protected static flagsConfig: FlagsConfig = {
    emailid: flags.string({
      char: "i",
      description: messages.getMessage("orgWideEmailIdDescription"),
      required: true
    })
  };

  protected static requiresUsername = true;

  public async execute(): Promise<any> {
    this.ux.log(
      "This command is deprecated, It is no longer guaranteed to work, Please update your workflow with alternate solution"
    );

    const apiversion = await this.org.getConnection().retrieveMaxApiVersion();
    const id: string = this.flags.emailid;

    var orgWideAddressObj = {};

    this.ux.log("Verify email " + id);

    let response = await this.org.getConnection().request({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      url:
        "/services/data/v" + apiversion + "/sobjects/OrgWideEmailAddress/" + id,
      body: JSON.stringify(orgWideAddressObj)
    });
    if (response === undefined) {
      this.ux.log(`Org wide email address verified `);
    }
  }
}
