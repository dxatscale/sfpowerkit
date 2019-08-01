import { QueryResult } from "jsforce";
import { Org } from "@salesforce/core";

export default abstract class BaseUtils<T> {
  private query: string;
  protected cacheLoaded: boolean;
  protected data: any;
  protected dataLoaded: boolean = false;
  protected cacheFileName=""
  protected constructor(
    public org:Org,
    private tooling: boolean = false
  ) {
  }

  setQuery(query: string) {
    this.query = query;
  }

  public async getObjects(): Promise<T[]> {
    let records: T[] = [];

    const conn = this.org.getConnection();

    let result: QueryResult<T>;

    // Query the org
    if (this.tooling) {
      result = await conn.tooling.query<T>(this.query);
    } else {
      result = await conn.query<T>(this.query);
    }

    records.push(...result.records);
    while (!result.done) {
      result = await this.queryMore(result.nextRecordsUrl);
      records.push(...result.records);
    }
    return records;
  }

  private async queryMore(url: string): Promise<QueryResult<T>> {
    const conn = this.org.getConnection();
    let result: QueryResult<T>;
    if (this.tooling) {
      result = await conn.tooling.queryMore<T>(url);
    } else {
      result = await conn.queryMore<T>(url);
    }
    return result;
  }
}
