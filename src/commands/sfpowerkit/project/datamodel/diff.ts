import {
  core,
  SfdxCommand,
  FlagsConfig,
  flags,
  SfdxResult
} from "@salesforce/command";
import { SFPowerkit } from "../../../../sfpowerkit";
import * as fs from "fs-extra";
import simpleGit, { SimpleGit } from "simple-git";
import { isNullOrUndefined } from "util";
import DataModelSourceDiffImpl from "../../../../impl/source/metadata/DataModelSourceDiffImpl";
// const { Parser } = require("json2csv");

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "source_datamodel_diff"
);

export default class Diff extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:diff --revisionfrom revisionfrom --revisionto revisionto --csv`
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
      required: false,
      default: "HEAD"
    }),
    packagedirectories: flags.string({
      required: false,
      char: "p",
      description: messages.getMessage("packageDirectoriesDescription")
    }),
    outputdir: flags.directory({
      required: false,
      char: "d",
      description: messages.getMessage("outputDirDescription")
    }),
    csv: flags.boolean({
      required: false,
      description: messages.getMessage("csvDescription"),
      default: false
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

  protected static requiresUsername = false;
  protected static requiresProject = true;

  public async run(): Promise<any> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);
    let isOutputCSV = this.flags.csv;
    let outputDirectory = this.flags.outputdir
      ? this.flags.outputdir
      : process.cwd();

    let git: SimpleGit = simpleGit();

    const revisionFrom: string = await git.revparse([
      "--short",
      this.flags.revisionfrom
    ]);
    const revisionTo: string = await git.revparse([
      "--short",
      this.flags.revisionto
    ]);

    let packageDirectories: string[];

    if (!isNullOrUndefined(this.flags.packagedirectories)) {
      packageDirectories = this.flags.packagedirectories.split(",");
      packageDirectories = packageDirectories.map(dir => {
        return dir.trim().toLocaleLowerCase();
      });

      let projectConfig = JSON.parse(
        fs.readFileSync("sfdx-project.json", "utf8")
      );
      packageDirectories.forEach(dir => {
        let isValidPackageDir: boolean;
        projectConfig["packageDirectories"].forEach(configPackageDir => {
          if (dir == configPackageDir["path"].toLocaleLowerCase())
            isValidPackageDir = true;
        });
        if (!isValidPackageDir)
          throw new Error("Invalid package directory supplied");
      });
    }

    let dataModelSourceDiffImpl = new DataModelSourceDiffImpl(
      git,
      revisionFrom,
      revisionTo,
      packageDirectories
    );

    let sourceDiffResult = await dataModelSourceDiffImpl.exec();

    fs.writeFileSync(
      `${outputDirectory}/datamodel-diff-output.json`,
      JSON.stringify(sourceDiffResult, null, 4)
    );

    if (isOutputCSV) {
      let data_matrix = [
        [
          "Object",
          "API_Name",
          "Type",
          "Operation",
          "Coordinates",
          `Commit ID (${revisionFrom})`,
          `Commit ID (${revisionTo})`,
          "Filepath"
        ]
      ];

      for (let file of sourceDiffResult) {
        for (let change of file["diff"]) {
          let row: string[] = [
            file["object"],
            file["api_name"],
            file["type"],
            change["operation"],
            change["coordinates"],
            change["before"],
            change["after"],
            file["filepath"]
          ];
          data_matrix.push(row);
        }
      }

      if (fs.existsSync(`${outputDirectory}/datamodel-diff-output.csv`))
        fs.unlinkSync(`${outputDirectory}/datamodel-diff-output.csv`);

      data_matrix.forEach(row => {
        fs.writeFileSync(
          `${outputDirectory}/datamodel-diff-output.csv`,
          `${row.toString()}\n`,
          { flag: "a" }
        );
      });
    }

    // console.log(data_matrix);
    // console.log(diffResult);
  }
}
