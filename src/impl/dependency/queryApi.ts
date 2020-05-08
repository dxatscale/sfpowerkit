import { core } from "@salesforce/command";
import { Connection } from "@salesforce/core";
export default class QueryApi {
  private conn: Connection;
  constructor(conn: core.Connection) {
    this.conn = conn;
  }
  public async getQuery(query: string, tooling: boolean) {
    let results;

    if (tooling) {
      results = (await this.conn.tooling.query(query)) as any;
    } else {
      results = (await this.conn.query(query)) as any;
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
      result = await this.conn.tooling.queryMore(url);
    } else {
      result = await this.conn.queryMore(url);
    }
    return result;
  }
}
