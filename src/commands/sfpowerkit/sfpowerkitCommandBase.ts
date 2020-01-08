import {
  core,
  SfdxCommand,
  FlagsConfig,
  flags,
  SfdxResult
} from "@salesforce/command";
import { buildSfdxFlags } from "@salesforce/command/lib/sfdxFlags";
import { SFPowerkit } from "../../sfpowerkit";

export default abstract class SFPowerkitCommandBase extends SfdxCommand {
  private static basicFlagsConfig: FlagsConfig = {
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

  //Override Flag Builder, so that log level is added to all commands.
  static get flags(): flags.Output {
    let combinedFlagsConfig;
    if (this.flagsConfig) {
      combinedFlagsConfig = Object.assign(
        this.flagsConfig,
        SFPowerkitCommandBase.basicFlagsConfig
      );
    }

    return buildSfdxFlags(combinedFlagsConfig, {
      targetdevhubusername: !!(
        this.supportsDevhubUsername || this.requiresDevhubUsername
      ),
      targetusername: !!(this.supportsUsername || this.requiresUsername)
    });
  }

  abstract getCommandNameForTracking(): string;

  public async run(): Promise<any> {
    //Set Up log levels
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    //Set up analytics

    //Report Inital Tracking

    //Actual command Implementation
    return await this.executeCommand();
  }

  abstract async executeCommand(): Promise<any>;

  finally(err): Promise<void> {
    //Add exception tracking analytics here

    return super.finally(err);
  }
}
