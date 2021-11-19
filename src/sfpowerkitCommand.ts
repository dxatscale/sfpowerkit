import { SfdxCommand } from "@salesforce/command";
import {COLOR_HEADER, LoggerLevel, SFPowerkit} from "./sfpowerkit";

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
  abstract excute(): Promise<any>;

  /**
   * Entry point for the commands
   */
  async run(): Promise<any> {
    // Always enable color by default
    if (process.env.SFPOWERKIT_NOCOLOR) SFPowerkit.disableColor();
    else SFPowerkit.enableColor();

    for (const plugin of this.config.plugins) {
      if (plugin.name === "sfpowerkit") {
        this.sfpowerkitConfig = plugin;
        }
      }

      SFPowerkit.log(
      COLOR_HEADER(
        `-------------------------------------------------------------------------------------------`
      ), LoggerLevel.INFO
    );
    SFPowerkit.log(
      COLOR_HEADER(
        `sfpowerkit  -- The DX@Scale Developer Toolkit -Version:${this.sfpowerkitConfig.version} -Release:${this.sfpowerkitConfig.pjson.release}`
      ), LoggerLevel.INFO
    );

    SFPowerkit.log(
      COLOR_HEADER(
        `-------------------------------------------------------------------------------------------`
      ), LoggerLevel.INFO
    );

    await this.excute();
  }
}
