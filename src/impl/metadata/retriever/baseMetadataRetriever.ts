import { QueryResult } from "jsforce";
import { Org } from "@salesforce/core";
import { SFPowerkit } from "../../../sfpowerkit";

export default abstract class BaseMetadataRetriever<T> {
  private query: string;
  private countQuery: string;

  private limit: number;
  private isLimitBasedQueryRetrieval: boolean = false;
  private totalSize: number;
  private queryWithOffsetsAndLimit: string;

  protected cacheLoaded: boolean;
  protected data: any;
  protected dataLoaded: boolean = false;
  protected cacheFileName = "";

  protected constructor(public org: Org, private tooling: boolean = false) {}

  protected setCountQuery(countQuery: string, limit: number) {
    this.isLimitBasedQueryRetrieval = true;
    this.countQuery = countQuery;
    this.limit = limit;
  }

  protected setQuery(query: string) {
    this.query = query;
    if (this.isLimitBasedQueryRetrieval)
      this.queryWithOffsetsAndLimit = this.query.concat(
        ` LIMIT ${this.limit} OFFSET 0`
      );
  }

  protected async getObjects(): Promise<T[]> {
    let records: T[] = [];
    const conn = this.org.getConnection();

    // Not Limit and Offset, based so old method
    if (!this.isLimitBasedQueryRetrieval) {
      SFPowerkit.ux.log(
        `Method: isTooling :  ${this.tooling}, QUERY:  ${this.query}`
      );

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
    } else {
      SFPowerkit.ux.log(
        `Method: isToolingandLimitBasedQueryRetrieval : true, QUERY:  ${this.query}`
      );

      let retrievedRecordSize = 0;
      let offset = 0;
      this.totalSize = await this.getCount();

      while (retrievedRecordSize < this.totalSize) {
        SFPowerkit.ux.log(
          `To Retrieve Total Size:  ${this.totalSize},Retrieved Size:   ${retrievedRecordSize} , Current Offset: ${offset}`
        );

        let result: QueryResult<T>;
        SFPowerkit.ux.log(this.queryWithOffsetsAndLimit);
        result = await conn.tooling.query<T>(this.queryWithOffsetsAndLimit);
        retrievedRecordSize += result.totalSize;

        records.push(...result.records);

        offset = offset + this.limit;
        this.queryWithOffsetsAndLimit = this.query.concat(
          ` LIMIT ${this.limit} OFFSET ${offset}`
        );
      }
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

  private async getCount() {
    SFPowerkit.ux.log(`Count Query: ${this.countQuery}`);
    let result = await this.org.getConnection().tooling.query(this.countQuery);
    SFPowerkit.ux.log(`Retrieved count ${result.totalSize}`);
    return result.totalSize;
  }
}
