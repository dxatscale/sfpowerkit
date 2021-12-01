import { core, flags } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
let request = require("request-promise-native");
import { SfdxError } from "@salesforce/core";
import { SFPowerkit, LoggerLevel } from "../../../../sfpowerkit";
import SFPowerkitCommand from "../../../../sfpowerkitCommand";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "sandbox_create");

export default class Create extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:sandbox:create -d Testsandbox -f sitSandbox -n test2 -v myOrg@example.com`,
    `$ sfdx sfpowerkit:org:sandbox:create -d Testsandbox -l DEVELOPER -n test2 -v myOrg@example.com`
  ];

  protected static flagsConfig = {
    name: flags.string({
      required: true,
      char: "n",
      description: messages.getMessage("nameFlagDescription")
    }),
    description: flags.string({
      required: true,
      char: "d",
      description: messages.getMessage("descriptionFlagDescription")
    }),
    licensetype: flags.string({
      required: true,
      char: "l",
      options: ["DEVELOPER", "DEVELOPER_PRO", "PARTIAL", "FULL"],
      description: messages.getMessage("licenseFlagDescription")
    }),
    apexclass: flags.string({
      required: false,
      char: "a",
      default: "",
      description: messages.getMessage("apexClassFlagDescription")
    }),
    clonefrom: flags.string({
      required: false,
      char: "f",
      default: "",
      description: messages.getMessage("cloneFromFlagDescripton")
    })
  };

  // Comment this out if your command does not require a hub org username
  protected static requiresDevhubUsername = true;

  public async execute(): Promise<AnyJson> {
    SFPowerkit.setLogLevel("INFO", false);

    await this.hubOrg.refreshAuth();

    const conn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    const uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/sobjects/SandboxInfo/`;

    var result;

    if (this.flags.clonefrom) {
      const sourceSandboxId = await this.getSandboxId(
        conn,
        this.flags.clonefrom
      );

      result = await request({
        method: "post",
        uri,
        headers: {
          Authorization: `Bearer ${conn.accessToken}`
        },
        body: {
          AutoActivate: "true",
          SandboxName: `${this.flags.name}`,
          Description: `${this.flags.description}`,
          ApexClassId: `${this.flags.apexclass}`,
          SourceId: sourceSandboxId
        },
        json: true
      });
    } else {
      if (!this.flags.licensetype) {
        throw new SfdxError(
          "License type is required when clonefrom source org is not provided. you may need to provide -l | --licensetype"
        );
      }

      result = await request({
        method: "post",
        uri,
        headers: {
          Authorization: `Bearer ${conn.accessToken}`
        },
        body: {
          AutoActivate: "true",
          SandboxName: `${this.flags.name}`,
          Description: `${this.flags.description}`,
          LicenseType: `${this.flags.licensetype}`,
          ApexClassId: `${this.flags.apexclass}`
        },
        json: true
      });
    }

    if (result.success) {
      SFPowerkit.log(
        `Successfully Enqueued Creation of Sandbox`,
        LoggerLevel.INFO
      );

      if (!this.flags.json) this.ux.logJson(result);
    } else {
      throw new SfdxError("Unable to Create sandbox");
    }

    return result;
  }

  public async getSandboxId(conn: core.Connection, name: string) {
    const query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=SELECT+Id,SandboxName+FROM+SandboxInfo+WHERE+SandboxName+in+('${name}')`;

    const sandbox_query_result = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    if (sandbox_query_result.records[0] == undefined)
      throw new SfdxError(
        `Unable to continue, Please check your sandbox name: ${name}`
      );

    SFPowerkit.log(
      `Fetched Sandbox Id for sandbox  ${name}  is ${sandbox_query_result.records[0].Id}`,
      LoggerLevel.INFO
    );

    return sandbox_query_result.records[0].Id;
  }
}
