import { flags, SfdxCommand } from "@salesforce/command";
import { Messages } from "@salesforce/core";
import { AnyJson } from "@salesforce/ts-types";
import {
  BuildConfig,
  Packagexml
} from "../../../../impl/metadata/packageBuilder";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("sfpowerkit", "package_build");

export default class Build extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:manifest:build --targetusername myOrg@example.com -o package.xml
    <?xml version="1.0" encoding="UTF-8"?>
    <Package xmlns="http://soap.sforce.com/2006/04/metadata">...</Package>
    `,
    `$ sfdx sfpowerkit:org:manifest:build --targetusername myOrg@example.com -o package.xml -q 'ApexClass, CustomObject, Report' 
    <?xml version="1.0" encoding="UTF-8"?>
    <Package xmlns="http://soap.sforce.com/2006/04/metadata">...</Package>
    `
  ];

  public static args = [{ name: "file" }];

  protected static flagsConfig = {
    quickfilter: flags.string({
      char: "q",
      description: messages.getMessage("quickfilterFlagDescription")
    }),
    excludemanaged: flags.boolean({
      char: "x",
      description: messages.getMessage("excludeManagedFlagDescription")
    }),
    outputfile: flags.filepath({
      char: "o",
      description: messages.getMessage("outputFileFlagDescription")
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;
  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;
  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {
    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    const apiversion = await this.org.getConnection().retrieveMaxApiVersion();
    const conn = this.org.getConnection();
    const configs: BuildConfig = new BuildConfig(this.flags, apiversion);
    const packageXML: Packagexml = new Packagexml(conn, configs);
    const result = await packageXML.build();

    //console.log(result);
    if (!this.flags.json) {
      this.ux.log(result.toString());
    }

    return { result: packageXML.result };
  }
}
