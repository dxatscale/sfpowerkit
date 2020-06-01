import { Org, LoggerLevel } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";
import { ProgressBar } from "../../.../../../ui/progressBar";

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

    let progressBar: ProgressBar = new ProgressBar().create(
      `Querying data from ${object}`,
      `Records fetched`,
      LoggerLevel.DEBUG
    );

    let queryRun = conn.tooling
      .query(query)
      .on("record", function(record) {
        if (!hasInitProgress) {
          hasInitProgress = true;

          progressBar.start(queryRun.totalSize);
        }
        records.push(record);

        progressBar.increment(1);
      })
      .on("end", function() {
        progressBar.stop();

        resolve(records);
      })
      .on("error", function(error) {
        progressBar.stop();

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
    let progressBar: ProgressBar = new ProgressBar().create(
      `Querying data from ${object}`,
      "Records fetched",
      LoggerLevel.DEBUG
    );

    SFPowerkit.log(`Using Bulk API`, LoggerLevel.DEBUG);

    conn.bulk
      .query(query)
      .on("record", function(record) {
        if (!hasInitProgress) {
          hasInitProgress = true;
          progressBar.start(recordCount);
        }
        records.push(record);
        progressBar.increment(1);
      })
      .on("end", function() {
        progressBar.stop();

        resolve(records);
      })
      .on("error", function(error) {
        progressBar.stop();
        SFPowerkit.log(`Error when using bulk api `, LoggerLevel.ERROR);
        SFPowerkit.log(error, LoggerLevel.ERROR);
        reject(error);
      });
  });
  return promiseQuery;
}
export async function executeQueryAsync(query, conn, object): Promise<any[]> {
  let promiseQuery = new Promise<any[]>((resolve, reject) => {
    let records = [];
    let hasInitProgress = false;
    let progressBar: ProgressBar = new ProgressBar().create(
      `Querying data from ${object}`,
      "Records fetched",
      LoggerLevel.DEBUG
    );

    let queryRun = conn
      .query(query)
      .on("record", function(record) {
        if (!hasInitProgress) {
          hasInitProgress = true;

          progressBar.start(queryRun.totalSize);
        }
        records.push(record);

        progressBar.increment(1);
      })
      .on("end", function() {
        progressBar.stop();

        resolve(records);
      })
      .on("error", function(error) {
        progressBar.stop();

        reject(error);
      })
      .run({
        autoFetch: true,
        maxFetch: 1000000
      });
  });
  return promiseQuery;
}
