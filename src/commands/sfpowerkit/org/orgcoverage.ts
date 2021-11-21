import {
  core,
  flags,
  FlagsConfig
} from "@salesforce/command";
import { SfdxError } from "@salesforce/core";
import { AnyJson } from "@salesforce/ts-types";
import * as fs from "fs-extra";
import * as path from "path";
import FileUtils from "../../../utils/fileutils";
import SFPowerkitCommand from "../../../sfpowerkitCommand";
let request = require("request-promise-native");
import * as rimraf from "rimraf";
const querystring = require("querystring");

import MetadataSummaryInfoFetcher, {
  MetadataSummary,
} from "../../../impl/metadata/retriever/metadataSummaryInfoFetcher";
import DependencyImpl from "../../../impl/dependency/dependencyImpl";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "org_coverage");

export default class OrgCoverage extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$  sfdx sfpowerkit:org:orgcoverage  -u myOrg@example.com
  sfdx sfpowerkit:org:orgcoverage  -u myOrg@example.com -d testResult -f csv
  sfdx sfpowerkit:org:orgcoverage  -u myOrg@example.com -d testResult -f json


  Successfully Retrieved the Apex Test Coverage of the org XXXX
  coverage:85
  ID                 PACKAGE       NAME                  TYPE          PERCENTAGE    COMMENTS                              UNCOVERED LINES
  ───────            ────────      ──────────────────    ────────      ──────────    ───────────────────────────────────   ──────────────────
  01pxxxx            core          sampleController      ApexClass     100%
  01pxxxx            core          sampletriggerHandler  ApexClass     80%           Looks fine but target more than 85%   62;76;77;
  01pxxxx            consumer      sampleHelper          ApexClass     72%           Action required                       62;76;77;78;98;130;131
  01qxxxx            consumer      sampleTrigger         ApexTrigger   100%
  Output testResult/output.csv is generated successfully
  `,
  ];

  protected static flagsConfig: FlagsConfig = {
    output: flags.string({
      char: "d",
      description: messages.getMessage("outputFolderDescription"),
      required: false,
    }),
    format: flags.enum({
      required: false,
      char: "f",
      description: messages.getMessage("formatFlagDescription"),
      options: ["json", "csv"],
    }),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async execute(): Promise<AnyJson> {
    if (this.flags.output && !this.flags.format) {
      throw new SfdxError("format is required to generate the output");
    } else if (this.flags.format && !this.flags.output) {
      throw new SfdxError("output path is required to generate the output");
    }

    await this.org.refreshAuth();

    const conn = this.org.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    var apexcoverage = new ApexCoverage();
    apexcoverage.coverage = await this.getApexCoverage(conn);

    this.ux.log(
      `Successfully Retrieved the Apex Test Coverage of the org ${this.org.getOrgId()} `
    );
    this.ux.log(`coverage:${apexcoverage.coverage}`);

    const classCoverage = await this.getApexCoverageByDetails(
      conn,
      this.flags.output
    );

    return { coverage: apexcoverage.coverage, classCoverage: classCoverage };
  }

  private async getApexCoverage(conn: core.Connection) {
    var encoded_querystring = querystring.escape(
      `SELECT PercentCovered FROM ApexOrgWideCoverage`
    );

    var query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=${encoded_querystring}`;

    const coverage_score_query_result = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
      },
      json: true,
    });

    // this.ux.logJson(health_score_query_result);
    return coverage_score_query_result.records[0].PercentCovered;
  }
  private async getApexCoverageByDetails(
    conn: core.Connection,
    outputDir: string
  ) {
    let metadataVsPackageMap = await this.getmetadataVsPackageMap(conn);
    let query =
      "SELECT ApexClassOrTriggerId, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered, coverage FROM ApexCodeCoverageAggregate WHERE ApexClassOrTriggerId != null AND ApexClassOrTrigger.Name != null ORDER BY ApexClassOrTrigger.Name";

    const results = (await conn.tooling.query(query)) as any;
    const output = [];
    if (results.size > 0) {
      results.records.forEach((element) => {
        let percentage;
        let comments = "";
        if (element.NumLinesCovered === 0 && element.NumLinesUncovered === 0) {
          percentage = "NA";
        } else {
          percentage = this.percentCalculate(
            element.NumLinesCovered,
            element.NumLinesUncovered
          );
          comments = this.getComments(percentage);
          percentage = `${percentage}%`;
        }
        output.push({
          id: element.ApexClassOrTriggerId,
          package: metadataVsPackageMap.has(element.ApexClassOrTrigger.Name)
            ? metadataVsPackageMap.get(element.ApexClassOrTrigger.Name)
            : "",
          name: element.ApexClassOrTrigger.Name,
          type: element.ApexClassOrTrigger.attributes.url.split("/")[6],
          percentage: percentage,
          comments: comments,
          uncoveredLines: element.Coverage.uncoveredLines.join(";"),
        });
      });

      this.ux.table(output, [
        "id",
        "package",
        "name",
        "type",
        "percentage",
        "comments",
        "uncoveredLines",
      ]);

      if (outputDir && this.flags.format === "json") {
        rimraf.sync(outputDir);
        await this.generateJsonOutput(output, outputDir);
      } else if (outputDir && this.flags.format === "csv") {
        rimraf.sync(outputDir);
        await this.generateCSVOutput(output, outputDir);
      }
    }
    return output;
  }
  private percentCalculate(covered: number, uncovered: number) {
    return covered === 0
      ? 0
      : Math.round((covered / (covered + uncovered)) * 100);
  }
  private getComments(percentage: number) {
    return percentage < 75
      ? "Action required"
      : percentage >= 75 && percentage < 85
      ? "Looks fine but target more than 85%"
      : "";
  }
  private async generateJsonOutput(testResult: AnyJson, outputDir: string) {
    let outputJsonPath = `${outputDir}/output.json`;
    let dir = path.parse(outputJsonPath).dir;
    if (!fs.existsSync(dir)) {
      FileUtils.mkDirByPathSync(dir);
    }
    fs.writeFileSync(outputJsonPath, JSON.stringify(testResult));
    this.ux.log(`Output ${outputDir}/output.json is generated successfully`);
  }
  private async generateCSVOutput(testResult: any[], outputDir: string) {
    let outputcsvPath = `${outputDir}/output.csv`;
    let dir = path.parse(outputcsvPath).dir;
    if (!fs.existsSync(dir)) {
      FileUtils.mkDirByPathSync(dir);
    }
    let newLine = "\r\n";
    let output =
      "ID,PACKAGE,NAME,TYPE,PERCENTAGE,COMMENTS,UNCOVERED LINES" + newLine;
    testResult.forEach((element) => {
      output = `${output}${element.id},${element.package},${element.name},${element.type},${element.percentage},${element.comments},${element.uncoveredLines}${newLine}`;
    });
    fs.writeFileSync(outputcsvPath, output);
    this.ux.log(`Output ${outputDir}/output.csv is generated successfully`);
  }

  private async getmetadataVsPackageMap(conn: core.Connection) {
    let metadataMap: Map<string, MetadataSummary> = new Map<
      string,
      MetadataSummary
    >();
    metadataMap = await MetadataSummaryInfoFetcher.fetchMetadataSummaryByTypesFromAnOrg(
      conn,
      [
        { type: "ApexClass", folder: null },
        { type: "ApexTrigger", folder: null },
      ],
      metadataMap
    );

    let subjectKeyPrefixList: String[] = ["01p", "01q"];

    let packageMember: Map<
      string,
      string
    > = await DependencyImpl.getMemberVsPackageNameMapByKeyPrefix(
      conn,
      subjectKeyPrefixList
    );

    let metadataVsPackageMap: Map<string, string> = new Map<string, string>();
    for (let subjectId of metadataMap.keys()) {
      if (packageMember.has(subjectId)) {
        metadataVsPackageMap.set(
          metadataMap.get(subjectId).fullName,
          packageMember.get(subjectId)
        );
      }
    }
    return metadataVsPackageMap;
  }
}

export class ApexCoverage {
  public coverage: number;
}
