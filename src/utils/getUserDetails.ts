import { Org } from "@salesforce/core";
import { isNullOrUndefined } from "util";
import { SFPowerkit, LoggerLevel } from "../sfpowerkit";
let retry = require("async-retry");

export async function getUserEmail(username: string, hubOrg: Org) {
  let hubConn = hubOrg.getConnection();

  return await retry(
    async bail => {
      if (isNullOrUndefined(username)) {
        bail(new Error("username cannot be null. provide a valid username"));
        return;
      }
      let query = `SELECT email FROM user WHERE username='${username}'`;

      SFPowerkit.log("QUERY:" + query, LoggerLevel.TRACE);
      const results = (await hubConn.query(query)) as any;

      if (results.records.size < 1) {
        bail(new Error(`No user found with username ${username} in devhub.`));
        return;
      }
      return results.records[0].Email;
    },
    { retries: 3, minTimeout: 3000 }
  );
}
