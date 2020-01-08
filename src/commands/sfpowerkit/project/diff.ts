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
import SFPowerkitCommandBase from "../sfpowerkitCommandBase";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "project_diff");

export default class Diff extends SFPowerkitCommandBase {
  getCommandNameForTracking(): string {
    return "project-diff";
  }
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:project:diff --diffFile DiffFileName --encoding EncodingOfFile --output OutputFolder`,
    `$ sfdx sfpowerkit:project:diff --revisionfrom revisionfrom --revisionto revisionto --output OutputFolder
   `
  ];

  protected static flagsConfig: FlagsConfig = {
    difffile: flags.string({
      char: "f",
      description: messages.getMessage("diffFileDescription"),
      required: false
    }),
    encoding: flags.string({
      char: "e",
      description: messages.getMessage("encodingDescription"),
      required: false
    }),
    revisionfrom: flags.string({
      char: "r",
      description: messages.getMessage("revisionFromDescription"),
      required: false
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

  public async executeCommand(): Promise<any> {
    const diffFile: string = this.flags.difffile;
    let encoding: string = this.flags.encoding;
    const outputFolder: string = this.flags.output;
    const revisionfrom: string = this.flags.revisionfrom;
    const revisionto: string = this.flags.revisionto;
    if (!encoding || encoding === "") {
      encoding = "utf8";
    }

    if (
      (diffFile === undefined || diffFile === "") &&
      (revisionfrom === undefined || revisionfrom === "")
    ) {
      this.error("Provide either diffFile or revisionFrom parameters");
    }

    let diffUtils = new DiffImpl(
      revisionfrom,
      revisionto,
      this.flags.generatedestructive
    );

    /* PATH TO DIFF FILE */
    let diffFilePath = "";
    if (diffFile) {
      diffFilePath = path.join(process.cwd(), diffFile);
    }

    let diffOutput = await diffUtils.build(
      diffFilePath,
      encoding,
      outputFolder
    );
    //if (!this.flags.json) this.ux.logJson(diffOutput);
    return diffOutput;
  }
}
