import {
  core,
  SfdxCommand,
  FlagsConfig,
  flags,
  SfdxResult
} from "@salesforce/command";
import DiffImpl from "../../../impl/project/diff/diffImpl";
import * as path from "path";
import { SFPowerkit } from "../../../sfpowerkit";
import OrgDiffImpl from "../../../impl/project/orgdiff/orgDiffImpl";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "project_orgdiff");

export default class OrgDiff extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:project:orgdiff --folder directory --noconflictmarkers --targetusername sandbox`,
    `$ sfdx sfpowerkit:project:orgdiff  --filename fileName --targetusername sandbox`
  ];

  protected static flagsConfig: FlagsConfig = {
    filesorfolders: flags.array({
      char: "f",
      description: messages.getMessage("filesOrFoldersFlagDescription"),
      required: true,
      map: (f: string) => f.trim()
    }),
    noconflictmarkers: flags.boolean({
      char: "c",
      description: messages.getMessage("noConflictMarkersDescription"),
      required: false
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
  protected static requiresProject = true;

  public async run(): Promise<any> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    let filesOrFolders = this.flags.filesorfolders;

    let orgDiff = new OrgDiffImpl(
      filesOrFolders,
      this.org,
      !this.flags.addconflictmarkers
    );

    let output = await orgDiff.orgDiff();

    return output;
  }
}
