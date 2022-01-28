/* eslint-disable @typescript-eslint/no-unused-vars */
import { Connection } from "jsforce/connection";

const retry = require("async-retry");

export default class QueryExecutor {
  constructor(private conn: Connection) {}

  public async executeQuery(query: string, tooling: boolean) {
    let results;

    if (tooling) {
      results = await retry(
        async (bail) => {
            return (await this.conn.tooling.query(query)) as any;
        },
        { retries: 3, minTimeout: 2000 }
      );
    } else {
      results = await retry(
        async (bail) => {
            return (await this.conn.query(query)) as any;
        },
        { retries: 3, minTimeout: 2000 }
      );
    }

    if (!results.done) {
      let tempRecords = results.records;
      while (!results.done) {
        results = await this.queryMore(results.nextRecordsUrl, tooling);
        tempRecords = tempRecords.concat(results.records);
      }
      results.records = tempRecords;
    }

    return results.records;
  }
  public async queryMore(url: string, tooling: boolean) {
    let result;
    if (tooling) {
      result = await retry(
        async (bail) => {
            return (await this.conn.tooling.queryMore(url)) as any;
        },
        { retries: 3, minTimeout: 2000 }
      );
    } else {
      result = await retry(
        async (bail) => {
            return (await this.conn.tooling.query(url)) as any;
        },
        { retries: 3, minTimeout: 2000 }
      );
    }
    return result;
  }
}
