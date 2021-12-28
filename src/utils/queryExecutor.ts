/* eslint-disable @typescript-eslint/no-unused-vars */
import { Connection } from "jsforce/connection";
import { LoggerLevel, SFPowerkit } from "../sfpowerkit";

const retry = require("async-retry");

export default class QueryExecutor {
  constructor(private conn: Connection) {}

  public async executeQuery(query: string, tooling: boolean) {
    let results;

    if (tooling) {
      results = await retry(
        async () => {
          try {
            return (await this.conn.tooling.query(query)) as any;
          } catch (error) {
            throw new Error(`Unable to fetch ${query}`)
          }
        },
        { retries: 5, minTimeout: 2000, onRetry:(error)=>{SFPowerkit.log(`Retrying Network call due to ${error.message}`,LoggerLevel.INFO)}}
      );
    } else {
      results = await retry(
        async () => {
          try {
            return (await this.conn.query(query)) as any;
          } catch (error) {
            throw new Error(`Unable to fetch ${query}`)
          }
        },
        { retries: 5, minTimeout: 2000,onRetry:(error)=>{SFPowerkit.log(`Retrying Network call due to ${error.message}`,LoggerLevel.INFO)}}
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
        async () => {
          try {
            return (await this.conn.tooling.queryMore(url)) as any;
          } catch (error) {
            throw new Error(`Unable to fetch ${url}`)
          }
        },
        { retries: 5, minTimeout: 2000,onRetry:(error)=>{SFPowerkit.log(`Retrying Network call due to ${error.message}`,LoggerLevel.INFO) }}
      );
    } else {
      result = await retry(
        async () => {
          try {
            return (await this.conn.tooling.query(url)) as any;
          } catch (error) {
            throw new Error(`Unable to fetch ${url}`)
          }
        },
        { retries: 5, minTimeout: 2000,onRetry:(error)=>{SFPowerkit.log(`Retrying Network call due to ${error.message}`,LoggerLevel.INFO)  }}
      );
    }
    return result;
  }
}
