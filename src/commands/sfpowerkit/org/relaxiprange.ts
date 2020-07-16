import { AnyJson } from "@salesforce/ts-types";
import { core, flags, SfdxCommand } from "@salesforce/command";
import { SfdxError } from "@salesforce/core";
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
    `sfdx sfpowerkit:org:relaxiprange -u sandbox -r "122.0.0.0-122.255.255.255,49.0.0.0-49.255.255.255"`,
    `sfdx sfpowerkit:org:relaxiprange -u sandbox --all`,
    `sfdx sfpowerkit:org:relaxiprange -u sandbox --none`
  ];

  protected static flagsConfig = {
    range: flags.array({
      required: false,
      char: "r",
      description: messages.getMessage("rangeFlagDescription")
    }),
    all: flags.boolean({
      description: messages.getMessage("allDescription"),
      required: false
    }),
    none: flags.boolean({
      description: messages.getMessage("noneDescription"),
      required: false
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

    //validate only one param is passed
    if (!this.flags.range && !this.flags.all && !this.flags.none) {
      throw new SfdxError(
        `Required input is missing. you must pass anyone of the flag -r (or) --all (or) --none`
      );
    } else if (
      (this.flags.range && this.flags.all) ||
      (this.flags.range && this.flags.none) ||
      (this.flags.none && this.flags.all)
    ) {
      throw new SfdxError(
        `Too many inputs found, you must pass only one param -r (or) --all (or) --none`
      );
    }

    let ipRangeToSet = [];
    if (this.flags.range) {
      ipRangeToSet = this.flags.range.map(function(element: string) {
        let range = element.split("-");
        return { start: range[0], end: range[1] };
      });
    }

    return await RelaxIPRangeImpl.setIp(
      this.org.getConnection(),
      this.org.getUsername(),
      ipRangeToSet,
      this.flags.all,
      this.flags.none
    );
  }
}
