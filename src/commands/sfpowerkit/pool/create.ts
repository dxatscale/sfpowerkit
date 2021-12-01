import { flags, FlagsConfig } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as rimraf from "rimraf";
import SFPowerkitCommand from "../../../sfpowerkitCommand";
import ScratchOrgImpl from "../../../impl/pool/scratchorg/poolCreateImpl";
import { Messages, SfdxError } from "@salesforce/core";
import { loadSFDX } from "../../../sfdxnode/GetNodeWrapper";
import { sfdx } from "../../../sfdxnode/parallel";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "sfpowerkit",
  "scratchorg_pool_create"
);

export default class Create extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");
  protected static requiresDevhubUsername = true;

  public static examples = [
    `$ sfdx sfpowerkit:pool:create -f config\\core_poolconfig.json`,
    `$ sfdx sfpowerkit:pool:create -f config\\core_poolconfig.json -v devhub`,
  ];

  protected static flagsConfig: FlagsConfig = {
    configfilepath: flags.filepath({
      char: "f",
      description: messages.getMessage("configFilePathDescription"),
      required: true,
    }),
    batchsize: flags.number({
      char: "b",
      default: 10,
      description: messages.getMessage("batchSizeDescription"),
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
  };

  public async execute(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");

    await this.hubOrg.refreshAuth();
    const hubConn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

    loadSFDX();

    let scratchOrgPoolImpl = new ScratchOrgImpl(
      this.flags.configfilepath,
      this.hubOrg,
      this.flags.apiversion,
      sfdx,
      this.flags.batchsize
    );

    try {
      return !(await scratchOrgPoolImpl.poolScratchOrgs());
    } catch (err) {
      throw new SfdxError("Unable to execute command .. " + err);
    }
  }
}
