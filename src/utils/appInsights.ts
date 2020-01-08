import * as config from "../config.json";
import applicationinsights = require("applicationinsights");

export class AppInsights {
  public static applicationInsightsClient: applicationinsights.TelemetryClient;

  public static setupAppInsights(enabled: boolean) {
    applicationinsights
      .setup(config.key)
      .setAutoDependencyCorrelation(false)
      .setAutoCollectRequests(false)
      .setAutoCollectPerformance(false)
      .setAutoCollectExceptions(false)
      .setAutoCollectDependencies(false)
      .setAutoCollectConsole(false)
      .setUseDiskRetryCaching(false)
      .start();

    this.applicationInsightsClient = applicationinsights.defaultClient;
    this.applicationInsightsClient.config.disableAppInsights = !enabled;
  }

  public static trackCommand(commandName: string) {
    this.applicationInsightsClient.trackRequest({
      name: commandName,
      url: commandName,
      duration: 0,
      success: true,
      resultCode: "OK"
    });
    this.applicationInsightsClient.flush();
  }

  public static trackCommandEvent(commandName: string, event: string = "none") {
    this.applicationInsightsClient.trackEvent({
      name: "Command Execution",
      properties: {
        name: commandName,
        url: commandName,
        event: event
      }
    });
    this.applicationInsightsClient.flush();
  }

  public static trackException(taskName: string, err: any) {
    this.applicationInsightsClient.trackException({ exception: err });

    this.applicationInsightsClient.trackEvent({
      name: "Command Execution",
      properties: {
        failed: "true",
        task: taskName
      }
    });

    this.applicationInsightsClient.flush();
  }
}
