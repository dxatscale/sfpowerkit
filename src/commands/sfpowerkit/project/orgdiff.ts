import {
  core,
  SfdxCommand,
  FlagsConfig,
  flags,
  SfdxResult,
} from "@salesforce/command";
import { SFPowerkit } from "../../../sfpowerkit";
import OrgDiffImpl from "../../../impl/project/orgdiff/orgDiffImpl";
import { fs } from "@salesforce/core";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "project_orgdiff");

export default class OrgDiff extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:project:orgdiff --filesorfolders directory --noconflictmarkers --targetusername sandbox`,
    `$ sfdx sfpowerkit:project:orgdiff -f fileName --targetusername sandbox`,
  ];

  protected static flagsConfig: FlagsConfig = {
    filesorfolders: flags.array({
      char: "f",
      description: messages.getMessage("filesOrFoldersFlagDescription"),
      required: true,
      map: (f: string) => f.trim(),
    }),
    noconflictmarkers: flags.boolean({
      char: "c",
      description: messages.getMessage("noConflictMarkersDescription"),
      required: false,
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
        "FATAL",
      ],
    }),
    outputformat: flags.enum({
      required: false,
      char: "o",
      description: messages.getMessage("outputFormatFlagDescription"),
      options: ["json", "csv"],
    }),
  };

  public static result: SfdxResult = {
    tableColumnData: {
      columns: [
        { key: "status", label: "Status" },
        { key: "metadataType", label: "Type" },
        { key: "componentName", label: "Component Name" },
        { key: "path", label: "Path" },
      ],
    },
    display() {
      if (Array.isArray(this.data) && this.data.length) {
        this.ux.table(this.data, this.tableColumnData);
      }
    },
  };

  protected static requiresUsername = true;
  protected static requiresProject = true;

  public async run(): Promise<any> {
    SFPowerkit.setUx(this.ux);
    this.ux.startSpinner("Running...");
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    let filesOrFolders = this.flags.filesorfolders;

    let orgDiff = new OrgDiffImpl(
      filesOrFolders,
      this.org,
      !this.flags.noconflictmarkers
    );

    let output = await orgDiff.orgDiff();
    this.ux.stopSpinner("Completed");
    if (!this.flags.outputformat || this.flags.outputformat == "json") {
      fs.writeJson("orgdiff.json", output);
    } else if (this.flags.outputformat == "csv") {
      await this.generateCSVOutput(output);
    }
    return output;
  }
  public async generateCSVOutput(result: any[]) {
    let newLine = "\r\n";
    let output = "status,metadataType,componentName,path" + newLine;
    result.forEach((element) => {
      output = `${output}${element.status},${element.metadataType},${element.componentName},${element.path}${newLine}`;
    });
    fs.writeFile("orgdiff.csv", output);
  }
}
