import * as fs from "fs-extra";
import * as rimraf from "rimraf";
import { AsyncResult, DeployResult } from "jsforce";
import { Connection } from "@salesforce/core";
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
    conn: Connection,
    ipRangeToSet: any[]
  ): Promise<boolean> {
    const apiversion = await conn.retrieveMaxApiVersion();

    let retrieveRequest = {
      apiVersion: apiversion
    };

    //Retrieve Duplicate Rule
    retrieveRequest["singlePackage"] = true;
    retrieveRequest["unpackaged"] = {
      types: { name: "Settings", members: "Security" }
    };
    conn.metadata.pollTimeout = 60;
    let retrievedId;
    await conn.metadata.retrieve(retrieveRequest, function(
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
      encoding: "base64"
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

      SFPowerkit.log(
        `Ip range to set :` + JSON.stringify(ipRangeToSet),
        LoggerLevel.INFO
      );

      if (!retrieve_securitySetting.SecuritySettings.networkAccess) {
        retrieve_securitySetting.SecuritySettings.networkAccess = {
          ipRanges: ipRangeToSet
        };
        SFPowerkit.log(
          `Currently No Ip range set in ${conn.getUsername()}`,
          LoggerLevel.DEBUG
        );
      } else {
        let currentRange =
          retrieve_securitySetting.SecuritySettings.networkAccess.ipRanges;

        SFPowerkit.log(
          `Org ${conn.getUsername()} has current range : ` +
            JSON.stringify(currentRange),
          LoggerLevel.DEBUG
        );

        if (currentRange.constructor === Array) {
          ipRangeToSet.concat(currentRange);
        } else {
          ipRangeToSet.push(currentRange);
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
        function(error, result: AsyncResult) {
          if (error) {
            return console.error(error);
          }
          deployId = result;
        }
      );

      SFPowerkit.log(
        `Setting Ip range with ID  ${deployId.id} to ${conn.getUsername()}`,
        LoggerLevel.DEBUG
      );
      let metadata_deploy_result: DeployResult = await checkDeploymentStatus(
        conn,
        deployId.id
      );

      if (!metadata_deploy_result.success) {
        SFPowerkit.log(
          `Unable to set ip range : ${metadata_deploy_result.details["componentFailures"]["problem"]}`,
          LoggerLevel.ERROR
        );
      } else {
        SFPowerkit.log(
          `Ip range is successfully set in ${conn.getUsername()}`,
          LoggerLevel.INFO
        );
      }

      rimraf.sync(retriveLocation);
    }

    return true;
  }
}
