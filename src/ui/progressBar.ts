import cli from "cli-ux";
import { isNullOrUndefined } from "util";

export class ProgressBar {
  private progressBarImpl;

  public create(
    title: string,
    unit: string,
    currentLogLevel: number,
    displayTillLogLevel: number,
    isJSONOutputEnabled: boolean
  ): ProgressBar {
    if (currentLogLevel <= displayTillLogLevel && !isJSONOutputEnabled) {
      this.progressBarImpl = cli.progress({
        format: `${title} - PROGRESS  | {bar} | {value}/{total} ${unit}`,
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        linewrap: true
      });
    }
    return this;
  }

  public start(totalSize: number) {
    if (!isNullOrUndefined(this.progressBarImpl))
      this.progressBarImpl.start(totalSize);
  }

  public stop() {
    if (!isNullOrUndefined(this.progressBarImpl)) this.progressBarImpl.stop();
  }

  public increment() {
    if (!isNullOrUndefined(this.progressBarImpl))
      this.progressBarImpl.increment();
  }
}
