import cli from 'cli-ux';
import SFPLogger from '../utils/sfpLogger';
import { isNullOrUndefined } from 'util';
import { Sfpowerkit } from '../sfpowerkit';

export class ProgressBar {
    private progressBarImpl;

    public create(title: string, unit: string, displayTillLogLevel: number): ProgressBar {
        if (SFPLogger.logLevel <= displayTillLogLevel && !Sfpowerkit.isJsonFormatEnabled) {
            this.progressBarImpl = cli.progress({
                format: `${title} - PROGRESS  | {bar} | {value}/{total} ${unit}`,
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                linewrap: true,
            });
        }
        return this;
    }

    public start(totalSize: number) {
        if (!isNullOrUndefined(this.progressBarImpl)) this.progressBarImpl.start(totalSize);
    }

    public stop() {
        if (!isNullOrUndefined(this.progressBarImpl)) this.progressBarImpl.stop();
    }

    public increment(count: number) {
        if (!isNullOrUndefined(this.progressBarImpl)) this.progressBarImpl.increment(count);
    }
}
