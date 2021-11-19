import {
  core,
  FlagsConfig,
  flags,
  SfdxResult
} from "@salesforce/command";
import { SFPowerkit } from "../../../../sfpowerkit";
import SFPowerkitCommand from "../../../../sfpowerkitCommand";
import ProfileDiffImpl from "../../../../impl/source/profiles/profileDiff";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

const messages = core.Messages.loadMessages("sfpowerkit", "org_profile_diff");

export default class Diff extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:profile:diff --profilelist profilenames --targetusername username (Compare liste profiles path against target org)`,
    `$ sfdx sfpowerkit:org:profile:diff --targetusername username (compare all profile in the project against the target org)`,
    `$ sfdx sfpowerkit:org:profile:diff --sourceusername sourcealias --targetusername username (compare all profile in the source org against the target org)`
  ];

  protected static flagsConfig: FlagsConfig = {
    profilelist: flags.array({
      char: "p",
      description: messages.getMessage("profileListFlagDescription"),
      required: false,
      map: (n: string) => n.trim()
    }),
    sourceusername: flags.string({
      char: "s",
      description: messages.getMessage("sourceUsernameDescription"),
      required: false
    }),
    output: flags.string({
      char: "d",
      description: messages.getMessage("outputFolderDescription"),
      required: false
    }),
    apiversion: flags.builtin(),
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

  public static result: SfdxResult = {
    tableColumnData: {
      columns: [
        { key: "status", label: "Status" },
        { key: "metadataType", label: "Type" },
        { key: "componentName", label: "Component Name" },
        { key: "path", label: "Path" }
      ]
    },
    display() {
      if (Array.isArray(this.data) && this.data.length) {
        this.ux.table(this.data, this.tableColumnData);
      }
    }
  };

  protected static requiresUsername = true;

  public async execute(): Promise<any> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    const outputFolder: string = this.flags.output;
    const sourceusername: string = this.flags.sourceusername;
    let profileList: string[] = this.flags.profilelist;
    if (!profileList || profileList.length === 0) {
      if (sourceusername && !outputFolder) {
        throw new Error("Output folder is required");
      }
    }
    let profileDiff = new ProfileDiffImpl(
      profileList,
      sourceusername,
      this.org,
      outputFolder
    );
    let output = profileDiff.diff().then(() => {
      return profileDiff.output;
    });

    let outputData = await output;
    return outputData;
  }
}
