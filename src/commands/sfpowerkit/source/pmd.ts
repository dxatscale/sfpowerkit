import { core, SfdxCommand, FlagsConfig, flags } from "@salesforce/command";
import findJavaHome from "find-java-home";
import { spawn } from "child_process";
import FileUtils from "../../../utils/fileutils";
import { SFPowerkit } from "../../../sfpowerkit";
import { extract } from "../../../utils/extract";
import { isNullOrUndefined } from "util";
import xml2js = require("xml2js");

const request = require("request");
const fs = require("fs");
const path = require("path");

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "source_pmd");

export default class Pmd extends SfdxCommand {
  protected static flagsConfig: FlagsConfig = {
    package: flags.string({
      required: false,
      char: "p",
      description: messages.getMessage("packageFlagDescription")
    }),

    ruleset: flags.string({
      required: false,
      char: "r",
      description: messages.getMessage("packageFlagDescription")
    }),

    javahome: flags.string({
      required: false,
      description:
        "path to java home directory, if not set the command will attempt to search for java home path"
    }),
    format: flags.string({
      required: false,
      char: "f",
      default: "text",
      description: "Format of the pmd report"
    }),
    report: flags.string({
      required: false,
      char: "o",
      default: "pmd-output",
      description: "path to report"
    }),
    supressoutput: flags.boolean({
      required: false,
      default: false,
      description: "Supress the output to be displayed on the console"
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  public async run(): Promise<any> {
    SFPowerkit.ux = this.ux;

    const javahome = await this.findJavaHomeAsync();
    this.ux.log(`Found Java Home at ${javahome}`);

    //Download PMD
    let cache_directory = FileUtils.getGlobalCacheDir();
    let pmd_cache_directory = path.join(cache_directory, "pmd");

    let version = "6.18.0";

    if (!fs.existsSync(path.join(pmd_cache_directory, `pmd-bin-${version}`))) {
      this.ux.log("Initiating Download of  PMD");
      fs.mkdirSync(pmd_cache_directory);
      await this.downloadPMD(version, pmd_cache_directory);
      this.ux.log(`Downloaded PMD ${version}`);
      await extract(
        path.join(pmd_cache_directory, "pmd.zip"),
        pmd_cache_directory
      );
      this.ux.log(`Extracted PMD ${version}`);
    }

    const pmdClassPath = path.join(
      pmd_cache_directory,
      `pmd-bin-${version}`,
      "lib",
      "*"
    );

    //Directory to be scanned
    let packageDirectory = isNullOrUndefined(this.flags.package)
      ? await SFPowerkit.getDefaultFolder()
      : this.flags.package;

    //Default Ruleset
    let ruleset = isNullOrUndefined(this.flags.ruleset)
      ? path.join(
          __dirname,
          "..",
          "..",
          "..",
          "..",
          "resources",
          "pmd-ruleset.xml"
        )
      : this.flags.ruleset;

    console.log(`Now analyzing ${packageDirectory}`);

    const pmdCmd = spawn(path.join(javahome, "bin", "java"), [
      "-cp",
      pmdClassPath,
      "net.sourceforge.pmd.PMD",
      "-l",
      "apex",
      "-d",
      packageDirectory,
      "-R",
      ruleset,
      "-f",
      "xml",
      "-r",
      "sf-pmd-output.xml"
    ]);

    const pmdCmdForConsoleLogging = spawn(path.join(javahome, "bin", "java"), [
      "-cp",
      pmdClassPath,
      "net.sourceforge.pmd.PMD",
      "-l",
      "apex",
      "-d",
      packageDirectory,
      "-R",
      ruleset,
      "-f",
      this.flags.format,
      "-r",
      this.flags.report
    ]);

    //capture pmd errors
    let pmd_error;
    let pmd_output;
    pmdCmd.stderr.on("data", data => {
      pmd_error = data;
    });
    pmdCmd.stdout.on("data", data => {
      pmd_output = data;
    });

    pmdCmd.on("close", code => {
      if (code == 4 || code == 0) {
        this.parseXmlReport("sf-pmd-output.xml", packageDirectory);

        if (!this.flags.supressoutput) {
          let violations = fs.readFileSync(this.flags.report).toString();
          this.ux.log(violations);
        }
      } else if (code == 1) {
        this.ux.log("PMD Exited with some exceptions ");
        this.ux.log(pmd_error.toString());
      }
    });
  }

  private async findJavaHomeAsync(): Promise<string> {
    return new Promise<string>((resolve, reject): void => {
      findJavaHome({ allowJre: true }, (err, res) => {
        if (err) {
          return reject(err);
        }
        return resolve(res);
      });
    });
  }

  private async downloadPMD(
    npm_package_pmd_version: string,
    pmd_chache_directory: any
  ) {
    let file = fs.createWriteStream(path.join(pmd_chache_directory, "pmd.zip"));

    await new Promise((resolve, reject) => {
      let stream = request({
        /* Here you should specify the exact link to the file you are trying to download */
        uri: `https://github.com/pmd/pmd/releases/download/pmd_releases%2F${npm_package_pmd_version}/pmd-bin-${npm_package_pmd_version}.zip`
      })
        .pipe(file)
        .on("finish", () => {
          resolve();
        })
        .on("error", error => {
          reject(error);
        });
    }).catch(error => {
      console.log(`Unable to download: ${error}`);
    });
  }

  protected parseXmlReport(
    xmlReport: string,
    moduleName: string
  ): [number, number] {
    let fileCount = 0;
    let violationCount = 0;

    let reportContent: string = fs.readFileSync(xmlReport, "utf-8");
    xml2js.parseString(reportContent, (err, data) => {
      // If the file is not XML, or is not from PMD, return immediately
      if (!data || !data.pmd) {
        console.debug(`Empty or unrecognized PMD xml report ${xmlReport}`);
        return null;
      }

      if (!data.pmd.file || data.pmd.file.length === 0) {
        // No files with violations, return now that it has been marked for upload
        console.debug(
          `A PMD report was found for module '${moduleName}' but it contains no violations`
        );
        return null;
      }

      data.pmd.file.forEach((file: any) => {
        if (file.violation) {
          fileCount++;
          violationCount += file.violation.length;
        }
      });

      console.debug(
        `A PMD report was found for for module '${moduleName}' containing ${violationCount} issues -  See the report at ${xmlReport}`
      );
    });

    return [violationCount, fileCount];
  }
}
