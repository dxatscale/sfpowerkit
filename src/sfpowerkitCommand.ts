import { SfdxCommand } from "@salesforce/command";
import SFPKLogger, {COLOR_HEADER, LoggerLevel} from "./SFPKLogger";
import { SFPowerkit } from "./sfpowerkit";

/**
 * A base class that provides common funtionality for sfpowerscripts commands
 *
 * @extends SfdxCommand
 */
export default abstract class SFPowerkitCommand extends SfdxCommand {
  public static isJsonFormatEnabled: boolean;
  public static logLevel;
  private sfpowerkitConfig;

  /**
   * Command run code goes here
   */
  abstract execute(): Promise<any>;

  /**
   * Entry point for the commands
   */
  async run(): Promise<any> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    // Always enable color by default
    if (process.env.SFPOWERKIT_NOCOLOR) SFPKLogger.disableColor();
    else SFPKLogger.enableColor();

    this.setLogLevel();

    for (const plugin of this.config.plugins) {
      if (plugin.name === "sfpowerkit") {
        this.sfpowerkitConfig = plugin;
        }
      }


    SFPKLogger.log(
      COLOR_HEADER(
        `-------------------------------------------------------------------------------------------`
      )
    );
    SFPKLogger.log(
      COLOR_HEADER(
        `sfpowerkit  -- The DX@Scale Developer Toolkit -Version:${this.sfpowerkitConfig.version} -Release:${this.sfpowerkitConfig.pjson.release}`
      )
    );

    SFPKLogger.log(
      COLOR_HEADER(
        `-------------------------------------------------------------------------------------------`
      )
    );

    await this.execute();
  }

  private setLogLevel() {
    if (this.flags.loglevel === "trace" || this.flags.loglevel === "TRACE")
      SFPKLogger.logLevel = LoggerLevel.TRACE;
    else if (this.flags.loglevel === "debug" || this.flags.loglevel === "DEBUG")
      SFPKLogger.logLevel = LoggerLevel.DEBUG;
    else if (this.flags.loglevel === "info" || this.flags.loglevel === "INFO")
      SFPKLogger.logLevel = LoggerLevel.INFO;
    else if (this.flags.loglevel === "warn" || this.flags.loglevel === "WARN")
      SFPKLogger.logLevel = LoggerLevel.WARN;
    else if (this.flags.loglevel === "error" || this.flags.loglevel === "ERROR")
      SFPKLogger.logLevel = LoggerLevel.ERROR;
    else if (this.flags.loglevel === "fatal" || this.flags.loglevel === "FATAL")
      SFPKLogger.logLevel = LoggerLevel.FATAL;
    else SFPKLogger.logLevel = LoggerLevel.INFO;
}
}