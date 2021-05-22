import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import PoolFetchImpl from "../../../impl/pool/scratchorg/poolFetchImpl";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "scratchorg_poolFetch"
);

export default class Fetch extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  protected static requiresDevhubUsername = true;

  public static examples = [
    `$ sfdx sfpowerkit:pool:fetch -t core `,
    `$ sfdx sfpowerkit:pool:fetch -t core -v devhub`,
    `$ sfdx sfpowerkit:pool:fetch -t core -v devhub -m`,
    `$ sfdx sfpowerkit:pool:fetch -t core -v devhub -s testuser@test.com`,
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
    alias: flags.string({
      char: "a",
      description: messages.getMessage("aliasDescription"),
      required: false,
    }),
    sendtouser: flags.string({
      char: "s",
      description: messages.getMessage("sendToUserDescription"),
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

  public async run(): Promise<AnyJson> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    await this.hubOrg.refreshAuth();
    const hubConn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

    let fetchImpl = new PoolFetchImpl(
      this.hubOrg,
      this.flags.tag,
      this.flags.mypool,
      this.flags.sendtouser,
      this.flags.alias
    );

    let result = await fetchImpl.execute();

    if (!this.flags.json && !this.flags.sendtouser) {
      this.ux.log(`======== Scratch org details ========`);
      let list = [];
      for (let [key, value] of Object.entries(result)) {
        if (value) {
          list.push({ key: key, value: value });
        }
      }
      this.ux.table(list, ["key", "value"]);

      fetchImpl.loginToScratchOrgIfSfdxAuthURLExits(result);
    }

    if (!this.flags.sendtouser) return result as AnyJson;
    else return true;
  }
}
