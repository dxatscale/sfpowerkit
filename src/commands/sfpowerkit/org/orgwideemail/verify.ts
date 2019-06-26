import { core, SfdxCommand, FlagsConfig, flags } from "@salesforce/command";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "orgwideemail_verify");

export default class OrgWideEmail extends SfdxCommand {
  public static description = messages.getMessage(
    "orgWideEmailVerifyCommandDescription"
  );

  public static examples = [
    `$ sfdx ancforce:testdate:orgwideemail --username scratchOrg --emailid orgwideemailid
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


  public async run(): Promise<any> {

    const id: string = this.flags.emailid;
    

    var orgWideAddressObj = {
    };

    this.ux.log("Verify email " + id);

    let response = await this.org.getConnection().request({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      url: "/services/data/v44.0/sobjects/OrgWideEmailAddress/"+id,
      body: JSON.stringify(orgWideAddressObj)
    });
    if(response===undefined){
      this.ux.log(`Org wide email address verified `)
    }

  }
}
