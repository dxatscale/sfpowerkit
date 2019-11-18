import { core, SfdxCommand, FlagsConfig, flags } from "@salesforce/command";
import findJavaHome from "find-java-home";
import { spawn } from "child_process";
import FileUtils from "../../../utils/fileutils";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import { extract } from "../../../utils/extract";
import { isNullOrUndefined } from "util";
import xml2js = require("xml2js");
import rimraf = require("rimraf");

const request = require("request");
const fs = require("fs");
const path = require("path");

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "org_destruct");

export default class Destruct extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:destruct -m destructiveChanges.xml -u prod@prod3.com`
  ];

  protected static flagsConfig: FlagsConfig = {
    directory: flags.string({
      required: false,
      char: "m",
      description: messages.getMessage("destructiveManifestFlagDescription")
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  // protected static requiresProject = true;

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async run(): Promise<any> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    await this.org.refreshAuth();

    //Connect to the org
    const conn = this.org.getConnection();
    const apiversion = await conn.retrieveMaxApiVersion();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    //Setup working directory
    let cache_directory = FileUtils.getGlobalCacheDir();
    let destruct_cache_directory = path.join(cache_directory, "destruct");

    //Clean existing directory
    rimraf.sync("destruct_cache_directory");
    fs.mkdirSync(destruct_cache_directory);
  }

  private async generateDestructiveManifest() {}

  private async generateEmptyPackageXml() {}

  private async deployDestructiveManifest() {}
}
