import {
  core,
  SfdxCommand,
  FlagsConfig,
  flags,
  SfdxResult
} from "@salesforce/command";
import * as path from "path";
import { SFPowerkit } from "../../../sfpowerkit";
// import { fs } from "@salesforce/core";
import * as fs from "fs-extra";
import simpleGit, { SimpleGit } from "simple-git";
const xml2js = require("xml2js");
import { diff } from "nested-object-diff";
const util = require("util");

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "source_diff");

export default class Diff extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:diff --revisionfrom revisionfrom --revisionto revisionto`
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
      description: messages.getMessage("packageDirectories")
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
        this.ux.table(
          this.data.filter(element => {
            return element["action"] !== "ERROR";
          }),
          this.tableColumnData
        );
      }
    }
  };

  protected static requiresUsername = false;
  protected static requiresProject = true;

  public async run(): Promise<any> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    const revisionFrom: string = this.flags.revisionfrom;
    const revisionTo: string = this.flags.revisionto;
    let packageDirectories: string = this.flags.packagedirectories;

    let git: SimpleGit = simpleGit();

    let gitDiffResult: string = await git.diff([
      revisionFrom,
      revisionTo,
      "--name-only",
      "--",
      "*field-meta.xml"
    ]);

    let filesChanged: string[] = gitDiffResult.split("\n");
    filesChanged.pop();
    console.log(filesChanged);

    filesChanged.forEach(async file => {
      let fileRevFrom: string | void = await git
        .show([`${revisionFrom}:${file}`])
        .catch(err => {});

      let fileRevTo: string | void = await git
        .show([`${revisionTo}:${file}`])
        .catch(err => {});

      let fileObjRevFrom;
      let fileObjRevTo;
      let parser = new xml2js.Parser({ explicitArray: false });
      let parseString = util.promisify(parser.parseString);
      if (fileRevFrom) fileObjRevFrom = await parseString(fileRevFrom);
      if (fileRevTo) fileObjRevTo = await parseString(fileRevTo);

      let data_matrix = [
        [
          "Full Name",
          "Metadata Type",
          "Coordinates",
          "Commit ID (from)",
          "Commit ID (to)",
          "Filepath"
        ]
      ];

      let metadataType = Object.keys(fileObjRevTo)[0];
      let fullName = fileObjRevTo[metadataType]["fullName"];
      if (!fileObjRevFrom && fileObjRevTo) {
        // Create
        let row: string[] = [
          fullName,
          metadataType,
          "N/A",
          "N/A",
          "Created new metadata",
          file
        ];
        data_matrix.push(row);
      } else if (fileObjRevFrom && !fileObjRevTo) {
        // Delete
        let row: string[] = [
          fullName,
          metadataType,
          "N/A",
          "N/A",
          "Deleted metadata",
          file
        ];
        data_matrix.push(row);
      } else {
        // Update
        let changes = diff(fileObjRevFrom, fileObjRevTo);
        changes.forEach(change => {
          let row: string[] = [
            fullName,
            metadataType,
            change.path,
            change.lhs,
            change.rhs,
            file
          ];
          data_matrix.push(row);
        });
      }

      data_matrix.forEach(row => {
        fs.writeFileSync(
          `${process.cwd()}/changelog.csv`,
          `${row.toString()}\n`,
          { flag: "a" }
        );
      });

      // console.log(changes);
      // console.log(fileObjRevFrom);
      // console.log(fileObjRevTo);
    });
  }
}
