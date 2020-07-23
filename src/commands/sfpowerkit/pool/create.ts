import { core, flags, SfdxCommand, FlagsConfig } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as rimraf from "rimraf";
import { SFPowerkit } from "../../../sfpowerkit";
import ScratchOrgImpl from "../../../impl/pool/scratchorg/poolCreateImpl";
import { SfdxError } from "@salesforce/core";
import { loadSFDX } from "../../../sfdxnode/GetNodeWrapper";
import { sfdx } from "../../../sfdxnode/parallel";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "scratchorg_pool_create"
);

export default class Create extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");
  protected static requiresDevhubUsername = true;

  public static examples = [
    `$ sfdx sfpowerkit:pool:create -f config\\core_poolconfig.json`,
    `$ sfdx sfpowerkit:pool:create -f config\\core_poolconfig.json -v devhub`
  ];

  protected static flagsConfig: FlagsConfig = {
    configfilepath: flags.filepath({
      char: "f",
      description: messages.getMessage("configFilePathDescription"),
      required: true
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

  public async run(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");
    SFPowerkit.setLogLevel(this.flags.loglevel, false);

    await this.hubOrg.refreshAuth();
    const hubConn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

    loadSFDX();

    let scratchOrgPoolImpl = new ScratchOrgImpl(
      this.flags.configfilepath,
      this.hubOrg,
      this.flags.apiversion,
      sfdx
    );

    try {
      return !(await scratchOrgPoolImpl.poolScratchOrgs());
    } catch (err) {
      throw new SfdxError("Unable to execute command .. " + err);
    }
  }
}
