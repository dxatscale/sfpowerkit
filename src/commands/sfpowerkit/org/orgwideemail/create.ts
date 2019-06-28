import { core, SfdxCommand, FlagsConfig, flags } from "@salesforce/command";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "orgwideemail_create"
);

export default class OrgWideEmail extends SfdxCommand {
  public static description = messages.getMessage(
    "orgWideEmailCreateCommandDescription"
  );

  public static examples = [
    `$ sfdx sfpowerkit:org:orgwideemail:create --username scratchOrg --address email_addres --displayname "Test Address" --allprofile
  `
  ];

  protected static flagsConfig: FlagsConfig = {
    address: flags.string({
      char: "a",
      description: messages.getMessage("orgWideEmailAddressDescription"),
      required: true
    }),
    displayname: flags.string({
      char: "n",
      description: messages.getMessage("orgWideEmailDisplaynameDescription"),
      required: true
    }),
    allprofile: flags.boolean({
      char: "p",
      description: messages.getMessage("orgWideEmailAllprofileDescription"),
      required: false
    })
  };
  protected static requiresUsername = true;

  public async run(): Promise<any> {
    const apiversion = await this.org.getConnection().retrieveMaxApiVersion();
    const address: string = this.flags.address;
    const displayname: string = this.flags.displayname;
    var allprofile = this.flags.allprofile ? true : false;

    var orgWideAddressObj = {
      Address: address,
      DisplayName: displayname,
      IsAllowAllProfiles: allprofile
    };

    this.ux.log("Creating email " + orgWideAddressObj.Address);

    console.log("Rever version")
    let response = await this.org.getConnection().request({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      url: "/services/data/v"+apiversion+"/sobjects/OrgWideEmailAddress",
      body: JSON.stringify(orgWideAddressObj)
    });

    if (response["success"]) {
      let username = this.org.getUsername();
      this.ux.log(`Org wide email created with Id ${response["id"]} `);
      this.ux.log(`Run the folowing command to verify it `);
      this.ux.log(
        `sfdx sfpowerkit:org:orgwideemail:verify -i ${response["id"]} -u ${username}`
      );
    } else {
      this.ux.error("Errors occured during org wide email creation ");
      response["errors"].forEach(error => {
        this.ux.error(error);
      });
    }

    return response;
  }
}
