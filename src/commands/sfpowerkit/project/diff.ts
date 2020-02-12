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
import { fs } from "@salesforce/core";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "project_diff");

export default class Diff extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:project:diff --diffFile DiffFileName --encoding EncodingOfFile --output OutputFolder`,
    `$ sfdx sfpowerkit:project:diff --revisionfrom revisionfrom --revisionto revisionto --output OutputFolder
   `
  ];

  protected static flagsConfig: FlagsConfig = {
    revisionfrom: flags.string({
      char: "r",
      description: messages.getMessage("revisionFromDescription"),
      required: true
    }),
    revisionto: flags.string({
      char: "t",
      description: messages.getMessage("revisionToDescription"),
      required: false
    }),
    output: flags.string({
      char: "d",
      description: messages.getMessage("outputFolderDescription"),
      required: true
    }),
    generatedestructive: flags.boolean({
      char: "x",
      description: messages.getMessage(
        "generativeDestructiveManifestDescription"
      ),
      required: false
    }),
    bypass: flags.array({
      required: false,
      char: "b",
      description: messages.getMessage("itemsToBypass")
    }),
    packagedirectories: flags.array({
      required: false,
      char: "p",
      description: messages.getMessage("packagedirectories")
    }),
    apiversion: flags.builtin({
      description: messages.getMessage("apiversion")
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
        { key: "action", label: "Action (Deploy/Delete)" },
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

  protected static requiresUsername = false;
  protected static requiresProject = true;

  public async run(): Promise<any> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    const outputFolder: string = this.flags.output;
    const revisionfrom: string = this.flags.revisionfrom;
    const revisionto: string = this.flags.revisionto;

    let diffUtils = new DiffImpl(
      revisionfrom,
      revisionto,
      this.flags.generatedestructive,
      this.flags.bypass
    );

    let diffOutput = await diffUtils.build(
      outputFolder,
      this.flags.packagedirectories,
      this.flags.apiversion
    );
    fs.writeJson(path.join(outputFolder, "diff.json"), diffOutput);
    return diffOutput;
  }
}
