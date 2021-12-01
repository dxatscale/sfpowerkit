import { FlagsConfig, flags } from "@salesforce/command";
import { Messages } from "@salesforce/core";
import SFPowerkitCommand from "../../../../sfpowerkitCommand";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "sfpowerkit",
  "orgwideemail_create"
);

export default class OrgWideEmail extends SFPowerkitCommand {
  public static description = messages.getMessage(
    "orgWideEmailCreateCommandDescription"
  );

  public static examples = [
    `sfdx sfpowerkit:org:orgwideemail:create -e testuser@test.com  -u scratch1 -n "Test Address" -p
     Creating email azlam.abdulsalam@accenture.com
     Org wide email created with Id 0D2210000004DidCAE
     Run the folowing command to verify it
    sfdx sfpowerkit:org:orgwideemail:verify -i 0D2210000004DidCAE -u test-jkomdylblorj@example.com  `
  ];

  protected static flagsConfig: FlagsConfig = {
    address: flags.email({
      char: "e",
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

  public async execute(): Promise<any> {
    this.ux.log(
      "This command is deprecated, It is no longer guaranteed to work, Please update your workflow with alternate solution"
    );

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

    let response = await this.org.getConnection().request({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      url: "/services/data/v" + apiversion + "/sobjects/OrgWideEmailAddress",
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
