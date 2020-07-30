import {
  core,
  SfdxCommand,
  flags,
  FlagsConfig,
  SfdxResult
} from "@salesforce/command";

import { SFPowerkit } from "../../../../sfpowerkit";
import ProfileCompare from "../../../../impl/source/profiles/profileCompare";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "profile_compare");

export default class Compare extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:profile:compare -u prod`,
    `$ sfdx sfpowerkit:source:profile:compare -n "My Profile1, My Profile2 " -u prod`,
    `$ sfdx sfpowerkit:source:profile:compare -n "My Profile1, My Profile2 " -u prod -t uat`
  ];

  //public static args = [{ name: 'file' }];

  protected static flagsConfig: FlagsConfig = {
    profilelist: flags.array({
      char: "n",
      description: messages.getMessage("profileListFlagDescription"),
      required: false,
      map: (p: string) => p.trim()
    }),
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL"
      ]
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public static result: SfdxResult = {
    tableColumnData: {
      columns: [
        { key: "state", label: "State" },
        { key: "fullName", label: "Full Name" },
        { key: "type", label: "Type" },
        { key: "path", label: "Path" }
      ]
    },
    display() {
      if (Array.isArray(this.data) && this.data.length) {
        this.ux.table(this.data, this.tableColumnData);
      }
    }
  };

  public async run(): Promise<any> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    let argProfileList: string[] = this.flags.profilelist;

    const profileUtils = new ProfileCompare(
      this.org,
      this.flags.loglevel == "debug"
    );

    await profileUtils.compare(argProfileList || []);

    return null;
  }
}
