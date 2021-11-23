import { SfdxCommand } from "@salesforce/command";
import SFPKLogger, {COLOR_HEADER, LoggerLevel} from "./SFPKLogger";
import { OutputFlags } from "@oclif/paser";
import { SFPowerkit } from "./sfpowerkit";

/**
 * A base class that provides common funtionality for sfpowerscripts commands
 *
 * @extends SfdxCommand
 */
export default abstract class SFPowerkitCommand extends SfdxCommand {
    /**
   * List of recognised CLI inputs that are substituted with their
   * corresponding environment variable at runtime
   */
     private readonly sfpowerkit_variable_dictionary: string[] = [
      "sfpowerkit_incremented_project_version",
      "sfpowerkit_artifact_directory",
      "sfpowerkit_artifact_metadata_directory",
      "sfpowerkit_package_version_id",
      "sfpowerkit_package_version_number",
      "sfpowerkit_pmd_output_path",
      "sfpowerkit_scratchorg_username",
      "sfpowerkit_installsourcepackage_deployment_id",
    ];

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
    if (process.env.SFPOWERKIT_NOCOLOR) SFPowerkit.disableColor();
    else SFPowerkit.enableColor();

    this.setLogLevel();

    for (const plugin of this.config.plugins) {
      if (plugin.name === "sfpowerkit") {
        this.sfpowerkitConfig = plugin;
        }
      }

    this.loadSfpowerkitVariables(this.flags);

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

    /**
   * Substitutes CLI inputs, that match the variable dictionary, with
   * the corresponding environment variable
   *
   * @param flags
   */
  private loadSfpowerkitVariables(flags: OutputFlags<any>): void {
    require("dotenv").config();

    for (let flag in flags) {
      for (let sfpowerkit_variable of this
        .sfpowerkit_variable_dictionary) {
        if (
          typeof flags[flag] === "string" &&
          flags[flag].includes(sfpowerkit_variable)
        ) {
          console.log(
            `Substituting ${flags[flag]} with ${process.env[flags[flag]]}`
          );
          flags[flag] = process.env[flags[flag]];
          break;
        }
      }
    }
  }
}