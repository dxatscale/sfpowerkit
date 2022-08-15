import { SfdxCommand } from '@salesforce/command';
import { Sfpowerkit } from './sfpowerkit';
import SFPLogger, { COLOR_HEADER} from '@dxatscale/sfp-logger';

/**
 * A base class that provides common funtionality for sfpowerscripts commands
 *
 * @extends SfdxCommand
 */
export default abstract class SfpowerkitCommand extends SfdxCommand {
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
        Sfpowerkit.setLogLevel(this.flags.loglevel, this.flags.json);
        Sfpowerkit.resetCache();

        // Always enable color by default
        if (process.env.SFPOWERKIT_NOCOLOR) Sfpowerkit.disableColor();
        else Sfpowerkit.enableColor();

        for (const plugin of this.config.plugins) {
            if (plugin.name === 'sfpowerkit') {
                this.sfpowerkitConfig = plugin;
            }
        }

        if (!this.flags.json) {
            this.sfpowerkitHeader();
            SFPLogger.disableLogs();
        }

        return this.execute();
    }

    private sfpowerkitHeader() {
        if (!process.env.SFPOWERKIT_NOHEADER) {
            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );
            SFPLogger.log(
                COLOR_HEADER(
                    `sfpowerkit  -- The DX@Scale Developer Toolkit - Version:${this.sfpowerkitConfig.version} - Release:${this.sfpowerkitConfig.pjson.release}`
                )
            );

            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );
        }
    }
}
