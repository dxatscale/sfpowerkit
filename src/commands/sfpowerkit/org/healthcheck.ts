import { Connection, Messages } from "@salesforce/core";
import { AnyJson } from "@salesforce/ts-types";
import * as fs from "fs-extra";
let request = require("request-promise-native");
import * as rimraf from "rimraf";
const querystring = require("querystring")
import SFPowerkitCommand from "../../../sfpowerkitCommand"

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("sfpowerkit", "org_healthcheck");

export default class HealthCheck extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:healthcheck  -u myOrg@example.com
  Successfully Retrived the healthstatus of the org
  `
  ];

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async execute(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");

    await this.org.refreshAuth();

    const conn = this.org.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    let healthResult = new HealthResult();

    healthResult.score = await this.getOrgHealthScore(conn);
    let riskItems = await this.getOrgHealthHighRisks(conn);

    riskItems.forEach(element => {
      healthResult.highriskitems.push(element.Setting);
    });

    riskItems = await this.getOrgHealthMediumRisks(conn);

    riskItems.forEach(element => {
      healthResult.mediumriskitems.push(element.Setting);
    });

    riskItems = await this.getOrgHealthLowRisks(conn);

    riskItems.forEach(element => {
      healthResult.lowriskitems.push(element.Setting);
    });

    riskItems = await this.getInformationalRisks(conn);

    riskItems.forEach(element => {
      healthResult.informationalriskitems.push(element.Setting);
    });

    if (this.flags.outputfile) {
      await fs.outputJSON(this.flags.outputfile, healthResult);
    }

    this.ux.log(`Successfully Retrived Health Check Details`);
    this.ux.logJson(healthResult);

    return true;
  }

  public async getOrgHealthScore(conn: Connection) {
    let encoded_querystring = querystring.escape(
      `SELECT Score FROM SecurityHealthCheck`
    );

    let query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=${encoded_querystring}`;

    //this.ux.log(`Query URI ${query_uri}`);

    const health_score_query_result = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    // this.ux.logJson(health_score_query_result);
    return health_score_query_result.records[0].Score;
  }

  public async getOrgHealthHighRisks(conn: Connection) {
    let encoded_querystring = querystring.escape(
      `SELECT RiskType, Setting, SettingGroup, OrgValue, StandardValue FROM SecurityHealthCheckRisks where RiskType='HIGH_RISK'`
    );

    let query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=${encoded_querystring}`;

    // this.ux.log(`Query URI ${query_uri}`);

    const health_score_query_result = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    // this.ux.logJson(health_score_query_result);
    return health_score_query_result.records;
  }

  public async getOrgHealthMediumRisks(conn: Connection) {
    let encoded_querystring = querystring.escape(
      `SELECT RiskType, Setting, SettingGroup, OrgValue, StandardValue FROM SecurityHealthCheckRisks where RiskType='MEDIUM_RISK'`
    );

    let query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=${encoded_querystring}`;

    // this.ux.log(`Query URI ${query_uri}`);

    const health_score_query_result = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    // this.ux.logJson(health_score_query_result);
    return health_score_query_result.records;
  }

  public async getOrgHealthLowRisks(conn: Connection) {
    let encoded_querystring = querystring.escape(
      `SELECT RiskType, Setting, SettingGroup, OrgValue, StandardValue FROM SecurityHealthCheckRisks where RiskType='LOW_RISK'`
    );

    let query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=${encoded_querystring}`;

    // this.ux.log(`Query URI ${query_uri}`);

    const health_score_query_result = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    // this.ux.logJson(health_score_query_result);
    return health_score_query_result.records;
  }

  public async getInformationalRisks(conn: Connection) {
    let encoded_querystring = querystring.escape(
      `SELECT RiskType, Setting, SettingGroup, OrgValue, StandardValue FROM SecurityHealthCheckRisks where RiskType='INFORMATIONAL'`
    );

    let query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=${encoded_querystring}`;

    // this.ux.log(`Query URI ${query_uri}`);

    const health_score_query_result = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    // this.ux.logJson(health_score_query_result);
    return health_score_query_result.records;
  }
}

export class HealthResult {
  public score: number;
  public highriskitems: string[];
  public mediumriskitems: string[];
  public lowriskitems: string[];
  public informationalriskitems: string[];
  constructor() {
    this.highriskitems = [];
    this.mediumriskitems = [];
    this.lowriskitems = [];
    this.informationalriskitems = [];
  }
}
