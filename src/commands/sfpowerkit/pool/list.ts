import { flags } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import SFPowerkitCommand from "../../../sfpowerkitCommand";
import poolListImpl from "../../../impl/pool/scratchorg/poolListImpl";
import { isNullOrUndefined } from "util";
import { ScratchOrg } from "../../../utils/scratchOrgUtils";
import { Messages } from "@salesforce/core";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "sfpowerkit",
  "scratchorg_poollist"
);

export default class List extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  protected static requiresDevhubUsername = true;

  public static examples = [
    `$ sfdx sfpowerkit:pool:list -t core `,
    `$ sfdx sfpowerkit:pool:list -t core -v devhub`,
    `$ sfdx sfpowerkit:pool:list -t core -v devhub -m`,
    `$ sfdx sfpowerkit:pool:list -t core -v devhub -m -a`,
  ];

  protected static flagsConfig = {
    tag: flags.string({
      char: "t",
      description: messages.getMessage("tagDescription"),
      required: false,
    }),
    mypool: flags.boolean({
      char: "m",
      description: messages.getMessage("mypoolDescription"),
      required: false,
    }),
    allscratchorgs: flags.boolean({
      char: "a",
      description: messages.getMessage("allscratchorgsDescription"),
      required: false,
    }),
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ],
    }),
  };

  public async execute(): Promise<AnyJson> {

    await this.hubOrg.refreshAuth();
    const hubConn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

    let listImpl = new poolListImpl(
      this.hubOrg,
      this.flags.apiversion,
      this.flags.tag,
      this.flags.mypool,
      this.flags.allscratchorgs
    );

    let result = await listImpl.execute();

    if (!this.flags.mypool && result.length > 0) {
      result.forEach((element) => {
        delete element.password;
      });
    }

    let scratchOrgInuse = result.filter(
      (element) => element.status === "In use"
    );
    let scratchOrgNotInuse = result.filter(
      (element) => element.status === "Available"
    );
    let scratchOrgInProvision = result.filter(
      (element) => element.status === "Provisioning in progress"
    );

    if (!this.flags.json) {
      if (result.length > 0) {
        this.ux.log(`======== Scratch org Details ========`);

        if (isNullOrUndefined(this.flags.tag)) {
          this.ux.log(`List of all the pools in the org`);

          this.logTagCount(result);
          this.ux.log("===================================");
        }

        if (this.flags.allscratchorgs) {
          this.ux.log(
            `Used Scratch Orgs in the pool: ${scratchOrgInuse.length}`
          );
        }
        this.ux.log(
          `Unused Scratch Orgs in the Pool : ${scratchOrgNotInuse.length} \n`
        );
        if (scratchOrgInProvision.length && scratchOrgInProvision.length > 0) {
          this.ux.log(
            `Scratch Orgs being provisioned in the Pool : ${scratchOrgInProvision.length} \n`
          );
        }

        if (this.flags.mypool) {
          this.ux.table(result, [
            "tag",
            "orgId",
            "username",
            "password",
            "expiryDate",
            "status",
            "loginURL",
          ]);
        } else {
          this.ux.table(result, [
            "tag",
            "orgId",
            "username",
            "expiryDate",
            "status",
            "loginURL",
          ]);
        }
      } else {
        SFPowerkit.log(
          `${this.flags.tag} pool has No Scratch orgs available, time to create your pool.`,
          LoggerLevel.INFO
        );
      }
    }

    let output: any = {
      total:
        scratchOrgInuse.length +
        scratchOrgNotInuse.length +
        scratchOrgInProvision.length,
      inuse: scratchOrgInuse.length,
      unused: scratchOrgNotInuse.length,
      inprovision: scratchOrgInProvision.length,
      scratchOrgDetails: result,
    };

    return output;
  }

  private logTagCount(result: ScratchOrg[]) {
    let tagCounts: any = result.reduce(function (obj, v) {
      obj[v.tag] = (obj[v.tag] || 0) + 1;
      return obj;
    }, {});

    let tagArray = new Array<any>();

    Object.keys(tagCounts).forEach(function (key) {
      tagArray.push({
        tag: key,
        count: tagCounts[key],
      });
    });

    this.ux.table(tagArray, ["tag", "count"]);
  }
}
