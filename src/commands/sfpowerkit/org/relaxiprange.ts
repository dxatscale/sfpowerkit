import { AnyJson } from "@salesforce/ts-types";
import { core, flags, SfdxCommand } from "@salesforce/command";
import RelaxIPRangeImpl from "../../../impl/org/relaxIPRangeImpl";

// tslint:disable-next-line:ordered-imports
var path = require("path");
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "org_relaxiprange");

export default class Relaxiprange extends SfdxCommand {
  public connectedapp_consumerKey: string;
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `sfdx sfpowerkit:org:relaxiprange -u sandbox -r "122.0.0.0-122.255.255.255,49.0.0.0-49.255.255.255"`
  ];

  protected static flagsConfig = {
    range: flags.array({
      required: true,
      char: "r",
      description: messages.getMessage("rangeFlagDescription")
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

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    let ipRangeToSet = this.flags.range.map(function(element: string) {
      let range = element.split("-");
      return { start: range[0], end: range[1] };
    });

    return await RelaxIPRangeImpl.setIp(this.org.getConnection(), ipRangeToSet);
  }
}
