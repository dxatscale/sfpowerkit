import * as fs from "fs-extra";
import * as rimraf from "rimraf";
import { AsyncResult, DeployResult } from "jsforce";
import { core } from "@salesforce/command";
import * as xml2js from "xml2js";
import * as util from "util";

// tslint:disable-next-line:ordered-imports
var path = require("path");
import { checkRetrievalStatus } from "../../utils/checkRetrievalStatus";
import { checkDeploymentStatus } from "../../utils/checkDeploymentStatus";
import { extract } from "../../utils/extract";
import { zipDirectory } from "../../utils/zipDirectory";
import { SFPowerkit, LoggerLevel } from "../../sfpowerkit";

export default class RelaxIPRangeImpl {
  public static async setIp(
    conn: core.Connection,
    username: string,
    ipRangeToSet: any[],
    addall: Boolean = false,
    removeall: Boolean = false
  ): Promise<{ username: string; success: boolean }> {
    const apiversion = await conn.retrieveMaxApiVersion();

    let retrieveRequest = {
      apiVersion: apiversion,
    };

    //Retrieve Duplicate Rule
    retrieveRequest["singlePackage"] = true;
    retrieveRequest["unpackaged"] = {
      types: { name: "Settings", members: "Security" },
    };
    conn.metadata.pollTimeout = 60;
    let retrievedId;
    await conn.metadata.retrieve(retrieveRequest, function (
      error,
      result: AsyncResult
    ) {
      if (error) {
        return console.error(error);
      }
      retrievedId = result.id;
    });
    SFPowerkit.log(
      `Fetching Ip range from ${conn.getUsername()}`,
      LoggerLevel.DEBUG
    );

    let metadata_retrieve_result = await checkRetrievalStatus(
      conn,
      retrievedId
    );
    if (!metadata_retrieve_result.zipFile)
      SFPowerkit.log("Unable to find the settings", LoggerLevel.ERROR);

    let retriveLocation = `temp_sfpowerkit_${retrievedId}`;
    //Extract Matching Rule
    var zipFileName = `${retriveLocation}/unpackaged.zip`;
    fs.mkdirSync(retriveLocation);
    fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, {
      encoding: "base64",
    });

    await extract(`./${retriveLocation}/unpackaged.zip`, retriveLocation);
    fs.unlinkSync(zipFileName);
    let resultFile = `${retriveLocation}/settings/Security.settings`;

    if (fs.existsSync(path.resolve(resultFile))) {
      const parser = new xml2js.Parser({ explicitArray: false });
      const parseString = util.promisify(parser.parseString);

      let retrieve_securitySetting = await parseString(
        fs.readFileSync(path.resolve(resultFile))
      );

      if (addall) {
        ipRangeToSet = this.getFullRange();
        SFPowerkit.log(
          `Ip range to set : 0.0.0.0-255.255.255.255`,
          LoggerLevel.INFO
        );
      } else if (ipRangeToSet.length > 0) {
        SFPowerkit.log(
          `Ip range to set :` + JSON.stringify(ipRangeToSet),
          LoggerLevel.INFO
        );
      }

      if (!retrieve_securitySetting.SecuritySettings.networkAccess) {
        if (removeall) {
          SFPowerkit.log(
            `Currently No Ip range set in ${conn.getUsername()} to remove.`,
            LoggerLevel.INFO
          );
          rimraf.sync(retriveLocation);
          return { username: username, success: true };
        } else {
          retrieve_securitySetting.SecuritySettings.networkAccess = {
            ipRanges: ipRangeToSet,
          };
          SFPowerkit.log(
            `Currently No Ip range set in ${conn.getUsername()}.`,
            LoggerLevel.DEBUG
          );
        }
      } else {
        let currentRange =
          retrieve_securitySetting.SecuritySettings.networkAccess.ipRanges;

        SFPowerkit.log(
          `Org ${conn.getUsername()} has current range : ` +
            JSON.stringify(currentRange),
          LoggerLevel.DEBUG
        );

        if (!addall && !removeall) {
          if (currentRange.constructor === Array) {
            ipRangeToSet.concat(currentRange);
          } else {
            ipRangeToSet.push(currentRange);
          }
        }
        retrieve_securitySetting.SecuritySettings.networkAccess.ipRanges = ipRangeToSet;
      }

      let builder = new xml2js.Builder();
      var xml = builder.buildObject(retrieve_securitySetting);
      fs.writeFileSync(resultFile, xml);

      var zipFile = `${retriveLocation}/package.zip`;
      await zipDirectory(retriveLocation, zipFile);

      //Deploy Trigger
      conn.metadata.pollTimeout = 300;
      let deployId: AsyncResult;

      var zipStream = fs.createReadStream(zipFile);
      await conn.metadata.deploy(
        zipStream,
        { rollbackOnError: true, singlePackage: true },
        function (error, result: AsyncResult) {
          if (error) {
            return console.error(error);
          }
          deployId = result;
        }
      );

      SFPowerkit.log(
        `${removeall ? "Removing all" : "Setting"} Ip range with ID  ${
          deployId.id
        } to ${conn.getUsername()}`,
        LoggerLevel.DEBUG
      );
      let metadata_deploy_result: DeployResult = await checkDeploymentStatus(
        conn,
        deployId.id
      );

      rimraf.sync(retriveLocation);

      if (!metadata_deploy_result.success) {
        SFPowerkit.log(
          `Unable to ${removeall ? "remove" : "set"} ip range : ${
            metadata_deploy_result.details["componentFailures"]["problem"]
          }`,
          LoggerLevel.ERROR
        );
        return { username: username, success: false };
      } else {
        SFPowerkit.log(
          `Ip range is successfully ${
            removeall ? "removed" : "set"
          } in ${conn.getUsername()}`,
          LoggerLevel.INFO
        );
        return { username: username, success: true };
      }
    }
  }
  public static getFullRange() {
    let ipRangeToSet = [];
    for (let i = 0; i < 255; i += 2) {
      ipRangeToSet.push({ start: `${i}.0.0.0`, end: `${i + 1}.255.255.255` });
    }
    return ipRangeToSet;
  }
}
