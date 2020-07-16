import {
  core,
  SfdxCommand,
  FlagsConfig,
  flags,
  SfdxResult
} from "@salesforce/command";
import * as path from "path";
import { SFPowerkit } from "../../../sfpowerkit";
import { fs } from "@salesforce/core";
import * as fsextra from "fs-extra";
import simpleGit, { SimpleGit } from "simple-git/promise";
const parseString = require("xml2js").parseString;

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

    let gitDiffResult = await git.diff([
      revisionFrom,
      revisionTo,
      "--",
      "*field-meta.xml"
    ]);

    let gitDiff: string[] = gitDiffResult.split("\n");
    let diffObj = {};

    let fileStartingIndices: number[] = [];
    gitDiff.forEach((elem, index) => {
      // console.log(elem.match(/\+.*/));
      if (elem.startsWith("diff")) {
        fileStartingIndices.push(index);
      }
    });

    fileStartingIndices.forEach((elem, index, array) => {
      let fileDiff;
      if (index + 1 < array.length)
        fileDiff = gitDiff.slice(elem, array[index + 1]);
      else fileDiff = gitDiff.slice(elem);

      let filename;
      let hunks: number[] = [];
      let newHunkFlag = true;
      fileDiff.forEach((elem, index) => {
        if (
          (elem.startsWith("---") || elem.startsWith("+++")) &&
          !elem.includes("/dev/null")
        ) {
          filename = elem.substring(4);
        }

        if (filename) {
          let matchPosChange = elem.match(/^\+\s*<.*/);
          let matchNegChange = elem.match(/^\-\s*<.*/);
          if ((matchPosChange || matchNegChange) && newHunkFlag) {
            hunks.push(index);
            newHunkFlag = false;
          } else if (!(matchPosChange || matchNegChange) && !newHunkFlag) {
            hunks.push(index - 1);
            newHunkFlag = true;
          }
        }
      });

      for (let i = 0; i < hunks.length; i += 2) {
        let startHunk = hunks[i];
        let endHunk;
        let hunk;

        if (i + 1 < hunks.length) {
          endHunk = hunks[i + 1];
          hunk = fileDiff.slice(startHunk, endHunk + 1);
        } else {
          hunk = fileDiff.slice(startHunk); // Is this ever reached? [1, 1, 2, 2]
        }

        let posHunk = [];
        let negHunk = [];
        hunk.forEach(elem => {
          if (elem.match(/^\+\s*<.*/)) posHunk.push(elem);
          else if (elem.match(/^\-\s*<.*/)) negHunk.push(elem);
        });
        console.log(posHunk);
        console.log(negHunk);

        if (posHunk.length > 0 && negHunk.length == 0) {
          let newData = posHunk;
          let oldData = null;
        } else if (posHunk.length == 0 && negHunk.length > 0) {
          let newData = null;
          let oldData = negHunk;
        } else {
          // Mapping
        }
      }

      // console.log(hunks);
    });
    // console.log(gitDiff);
  }
}
