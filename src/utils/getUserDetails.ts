import { Org } from "@salesforce/core";
import { isNullOrUndefined } from "util";
import { SFPowerkit, LoggerLevel } from "../sfpowerkit";
let retry = require("async-retry");

export async function getUserEmail(username: string, hubOrg: Org) {
  let hubConn = hubOrg.getConnection();

  return await retry(
    async bail => {
      let query;

      if (!isNullOrUndefined(username))
        query = `SELECT email FROM user WHERE username='${username}'`;

      SFPowerkit.log("QUERY:" + query, LoggerLevel.TRACE);
      const results = (await hubConn.query(query)) as any;
      return results.records[0].Email;
    },
    { retries: 3, minTimeout: 3000 }
  );
}
