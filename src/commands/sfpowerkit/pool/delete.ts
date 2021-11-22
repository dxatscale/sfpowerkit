import { core, flags } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import poolHydrateImpl from "../../../impl/pool/scratchorg/PoolDeleteImpl";
import SFPowerkitCommand from "../../../sfpowerkitCommand";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "scratchorg_poolhydrate"
);

export default class Delete extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  protected static requiresDevhubUsername = true;

  public static examples = [
    `$ sfdx sfpowerkit:pool:delete -t core `,
    `$ sfdx sfpowerkit:pool:delete -t core -v devhub`,
    `$ sfdx sfpowerkit:pool:delete -t core -v devhub -m`,
    `$ sfdx sfpowerkit:pool:delete -t core -v devhub -m -a`,
  ];

  protected static flagsConfig = {
    tag: flags.string({
      char: "t",
      description: messages.getMessage("tagDescription"),
      required: true,
    }),
    mypool: flags.boolean({
      char: "m",
      description: messages.getMessage("mypoolDescription"),
      required: false,
    }),
    allscratchorgs: flags.boolean({
      char: "a",
      description: messages.getMessage("allscratchorgsDescription"),
      required: false,
    }),
    inprogressonly: flags.boolean({
      char: "i",
      description: messages.getMessage("inprogressonlyDescription"),
      required: false,
      exclusive: ["allscratchorgs"],
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

    await this.hubOrg.refreshAuth();
    const hubConn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

    let hydrateImpl = new poolHydrateImpl(
      this.hubOrg,
      this.flags.apiversion,
      this.flags.tag,
      this.flags.mypool,
      this.flags.allscratchorgs,
      this.flags.inprogressonly
    );

    let result = await hydrateImpl.execute();

    if (!this.flags.json) {
      if (result.length > 0) {
        this.ux.log(`======== Scratch org Deleted ========`);
        this.ux.table(result, ["orgId", "username"]);
      } else {
        SFPowerkit.log(
          `${this.flags.tag} pool has No Scratch orgs available to delete.`,
          LoggerLevel.INFO
        );
      }
    }

    return result as AnyJson;
  }
}
