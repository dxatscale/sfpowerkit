import { Org, LoggerLevel } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";
import cli from "cli-ux";

const BULK_THRESHOLD = 2000;

export default abstract class BaseMetadataRetriever<T> {
  private query: string;
  private countQuery: string;

  protected cacheLoaded: boolean;
  protected data: any;
  protected dataLoaded: boolean = false;
  protected cacheFileName = "";
  protected objectName = "";

  protected constructor(public org: Org, private tooling: boolean = false) {}

  protected setQuery(query: string) {
    this.query = query;
    this.countQuery = this.generateCountQuery();
  }

  private generateCountQuery() {
    let queryParts = this.query.toUpperCase().split("FROM");
    let objectParts = queryParts[1].trim().split(" ");
    let objectName = objectParts[0].trim();
    this.objectName = objectName;

    let countQuery = `SELECT COUNT() FROM ${objectName}`;

    return countQuery;
  }

  protected async getObjects(): Promise<T[]> {
    //let records: T[] = [];
    const conn = this.org.getConnection();

    if (this.tooling) {
      return executeToolingQueryAsync(this.query, conn, this.objectName);
    } else {
      let recordsCount = await this.getCount();
      if (recordsCount > BULK_THRESHOLD) {
        return executeBulkQueryAsync(
          this.query,
          conn,
          this.objectName,
          recordsCount
        );
      } else {
        return executeQueryAsync(this.query, conn, this.objectName);
      }
    }
  }

  private async getCount() {
    SFPowerkit.log(`Count Query: ${this.countQuery}`, LoggerLevel.TRACE);
    let result = await this.org.getConnection().query(this.countQuery);
    SFPowerkit.log(`Retrieved count ${result.totalSize}`, LoggerLevel.TRACE);
    return result.totalSize;
  }
}

export async function executeToolingQueryAsync(
  query,
  conn,
  object
): Promise<any[]> {
  let promiseQuery = new Promise<any[]>((resolve, reject) => {
    let records = [];
    let hasInitProgress = false;
    let progressBar = undefined;
    if (
      SFPowerkit.logLevel === LoggerLevel.DEBUG ||
      SFPowerkit.logLevel === LoggerLevel.TRACE
    ) {
      progressBar = cli.progress({
        format: `Querying data from ${object} - PROGRESS  | {bar} | {value}/{total} Records fetched`,
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        linewrap: true
      });
    }
    let queryRun = conn.tooling
      .query(query)
      .on("record", function(record) {
        if (!hasInitProgress) {
          hasInitProgress = true;
          if (
            SFPowerkit.logLevel === LoggerLevel.DEBUG ||
            SFPowerkit.logLevel === LoggerLevel.TRACE
          ) {
            progressBar.start(queryRun.totalSize);
          }
        }
        records.push(record);
        if (
          SFPowerkit.logLevel === LoggerLevel.DEBUG ||
          SFPowerkit.logLevel === LoggerLevel.TRACE
        ) {
          progressBar.increment();
        }
      })
      .on("end", function() {
        if (
          SFPowerkit.logLevel === LoggerLevel.DEBUG ||
          SFPowerkit.logLevel === LoggerLevel.TRACE
        ) {
          progressBar.stop();
        }
        resolve(records);
      })
      .on("error", function(error) {
        if (
          SFPowerkit.logLevel === LoggerLevel.DEBUG ||
          SFPowerkit.logLevel === LoggerLevel.TRACE
        ) {
          progressBar.stop();
        }
        reject(error);
      })
      .run({
        autoFetch: true,
        maxFetch: 1000000
      });
  });
  return promiseQuery;
}

export async function executeBulkQueryAsync(
  query,
  conn,
  object,
  recordCount
): Promise<any[]> {
  let promiseQuery = new Promise<any[]>((resolve, reject) => {
    let records = [];
    let hasInitProgress = false;
    let progressBar = undefined;
    SFPowerkit.log(`Using Bulk API`, LoggerLevel.DEBUG);
    if (
      SFPowerkit.logLevel === LoggerLevel.DEBUG ||
      SFPowerkit.logLevel === LoggerLevel.TRACE
    ) {
      progressBar = cli.progress({
        format: `Querying data from ${object} - PROGRESS  | {bar} | {value}/{total} Records fetched`,
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        linewrap: true
      });
    }
    conn.bulk
      .query(query)
      .on("record", function(record) {
        if (!hasInitProgress) {
          hasInitProgress = true;
          if (
            SFPowerkit.logLevel === LoggerLevel.DEBUG ||
            SFPowerkit.logLevel === LoggerLevel.TRACE
          ) {
            progressBar.start(recordCount);
          }
        }
        records.push(record);
        if (
          SFPowerkit.logLevel === LoggerLevel.DEBUG ||
          SFPowerkit.logLevel === LoggerLevel.TRACE
        ) {
          progressBar.increment();
        }
      })
      .on("end", function() {
        if (
          SFPowerkit.logLevel === LoggerLevel.DEBUG ||
          SFPowerkit.logLevel === LoggerLevel.TRACE
        ) {
          progressBar.stop();
        }
        resolve(records);
      })
      .on("error", function(error) {
        if (
          SFPowerkit.logLevel === LoggerLevel.DEBUG ||
          SFPowerkit.logLevel === LoggerLevel.TRACE
        ) {
          progressBar.stop();
        }
        reject(error);
      });
  });
  return promiseQuery;
}
export async function executeQueryAsync(query, conn, object): Promise<any[]> {
  let promiseQuery = new Promise<any[]>((resolve, reject) => {
    let records = [];
    let hasInitProgress = false;
    let progressBar = undefined;
    if (
      SFPowerkit.logLevel === LoggerLevel.DEBUG ||
      SFPowerkit.logLevel === LoggerLevel.TRACE
    ) {
      progressBar = cli.progress({
        format: `Querying data from ${object} - PROGRESS  | {bar} | {value}/{total} Records fetched`,
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        linewrap: true
      });
    }
    let queryRun = conn
      .query(query)
      .on("record", function(record) {
        if (!hasInitProgress) {
          hasInitProgress = true;
          if (
            SFPowerkit.logLevel === LoggerLevel.DEBUG ||
            SFPowerkit.logLevel === LoggerLevel.TRACE
          ) {
            progressBar.start(queryRun.totalSize);
          }
        }
        records.push(record);
        if (
          SFPowerkit.logLevel === LoggerLevel.DEBUG ||
          SFPowerkit.logLevel === LoggerLevel.TRACE
        ) {
          progressBar.increment();
        }
      })
      .on("end", function() {
        if (
          SFPowerkit.logLevel === LoggerLevel.DEBUG ||
          SFPowerkit.logLevel === LoggerLevel.TRACE
        ) {
          progressBar.stop();
        }
        resolve(records);
      })
      .on("error", function(error) {
        if (
          SFPowerkit.logLevel === LoggerLevel.DEBUG ||
          SFPowerkit.logLevel === LoggerLevel.TRACE
        ) {
          progressBar.stop();
        }
        reject(error);
      })
      .run({
        autoFetch: true,
        maxFetch: 1000000
      });
  });
  return promiseQuery;
}
