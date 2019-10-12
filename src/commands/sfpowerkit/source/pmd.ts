import { core, SfdxCommand, FlagsConfig, flags } from "@salesforce/command";
import findJavaHome from "find-java-home";
import { spawn } from "child_process";
const request = require("request");

import FileUtils from "../../../utils/fileutils";

const fs = require("fs");
const path = require("path");

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "profile_retrieve");

export default class Pmd extends SfdxCommand {
  protected static flagsConfig: FlagsConfig = {
    javahome: flags.string({
      required: false,
      description:
        "path to java home directory, if not set the command will attempt to search for java home path"
    }),
    args: flags.string({
      required: false,
      description: "path to pmd args"
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  public async run(): Promise<any> {
    const javahome = await this.findJavaHomeAsync();
    this.ux.log(`Found Java Home at ${javahome}`);

    //Download PMD
    let cache_directory = FileUtils.getGlobalCacheDir();
    let pmd_chache_directory = path.join(cache_directory, "pmd-bin");
    if (!fs.existsSync(pmd_chache_directory)) {
      await this.downloadPMD("6.18.0", pmd_chache_directory);
    }

    // const pmdClassPath = path.join(cache_directory, "pmd", "lib", "*");
    // const pmdCmd = spawn(
    //   path.join(javahome, "bin", "java"),
    //   ["-cp", pmdClassPath, "net.sourceforge.pmd.PMD"].concat(
    //     this.flags.args || []
    //   )
    // );
    // pmdCmd.stderr.pipe(process.stderr);
    // pmdCmd.stdout.pipe(process.stdout);
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
          console.log(`Downloaded PMD`);
          resolve();
        })
        .on("error", error => {
          reject(error);
        });
    }).catch(error => {
      console.log(`Unable to download: ${error}`);
    });
  }
}
