import { AnyJson } from "@salesforce/ts-types";
import fs from "fs-extra";
import { core, flags, SfdxCommand } from "@salesforce/command";
import { SFPowerkit, LoggerLevel } from "../../../../sfpowerkit";
import FileUtils from "../../../../utils/fileutils";
import { ApexLexer, CaseInsensitiveInputStream, ApexParser } from "apex-parser";
import { CommonTokenStream } from "antlr4ts";

var path = require("path");
const glob = require("glob");

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "source_apextest_list"
);

export default class List extends SfdxCommand {
  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:apextest:list -p force-app`,
  ];

  protected static flagsConfig = {
    path: flags.string({
      required: true,
      char: "p",
      description: messages.getMessage("pathFlagDescription"),
    }),
    loglevel: flags.enum({
      description: messages.getMessage("loglevel"),
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
  };

  public async run(): Promise<AnyJson> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    //set objects directory
    let apexDirPaths = glob.sync(this.flags.path + "/**/classes", {
      absolute: false,
    });

    let apexClasses = [];
    if (apexDirPaths.length > 0) {
      for (let apexDirPath of apexDirPaths) {
        let classesInPath = FileUtils.getAllFilesSync(apexDirPath, ".cls");
        apexClasses = apexClasses.concat(classesInPath);
      }
    }

    let testClasses = [];
    if (apexClasses.length > 0) {
      SFPowerkit.log(
        `Found ${apexClasses.length} apex classes in ${this.flags.path}`,
        LoggerLevel.INFO
      );
      for (let cls of apexClasses) {
        let fileData = fs.readFileSync(path.resolve(cls)).toString();
        // temp check for @isTest string
        if (fileData.includes("@isTest") || fileData.includes("@istest")) {
          let name = FileUtils.getFileNameWithoutExtension(cls, ".cls");
          testClasses.push({ name, path: cls });

          // apex parser part here
          let lexer = new ApexLexer(
            new CaseInsensitiveInputStream(fileData, "@isTest")
          );
          console.log("lexer## : ", lexer);
          let tokens = new CommonTokenStream(lexer);
          console.log("tokens ## : ", tokens);
          let parser = new ApexParser(tokens);
          console.log("parser ## : ", parser);
          let context = parser.compilationUnit();
          console.log("context ## :", context);

          break;
        }
      }
    }

    if (testClasses.length > 0) {
      SFPowerkit.log(
        `Found ${testClasses.length} apex test classes in ${this.flags.path}`,
        LoggerLevel.INFO
      );
      this.ux.table(testClasses, ["name", "path"]);
    } else {
      SFPowerkit.log(
        `No apex test classes found in ${this.flags.path}`,
        LoggerLevel.INFO
      );
    }

    return testClasses.map((cls) => cls.name);
  }
}
