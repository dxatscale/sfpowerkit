import {
  core,
  SfdxCommand,
  FlagsConfig,
  flags,
  SfdxResult
} from "@salesforce/command";
import DiffUtil from "../../../impl/project/diff/diffutils";
import * as path from "path";
import { SfPowerKit } from "../../../sfpowerkit";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "project_diff");

export default class Diff extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:project:diff --diffFile DiffFileName --encoding EncodingOfFile --output OutputFolder
    {
      "status": 0,
      "result": {
        "deleted": [],
        "addedEdited": [
          "scripts\\Alias.sh",
          "sfdx-project.json",
        ]
       }
      }`,
    `$ sfdx sfpowerkit:project:diff --revisionfrom revisionfrom --revisionto revisionto --output OutputFolder
   {
    "status": 0,
    "result": {
      "deleted": [],
      "addedEdited": [
        "scripts\\Alias.sh",
        "sfdx-project.json",
      ]
     }
    }
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
    SfPowerKit.ux = this.ux;
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

    let diffUtils = new DiffUtil(revisionfrom, revisionto);

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
