import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import xml2js = require("xml2js");
import util = require("util");
import fs = require("fs-extra");
import path from "path";
import { SFPowerkit, LoggerLevel } from "../../../../sfpowerkit";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "project_mainfest_merge"
);

export default class Merge extends SfdxCommand {
  public output: Map<string, string[]>;

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:project:mainfest:merge -p project1/path/to/package.xml -d result/package.xml\n` +
      `$ sfdx sfpowerkit:project:mainfest:merge -p project1/path/to/package.xml,project2/path/to/package.xml -d result/package.xml`
  ];

  protected static flagsConfig = {
    path: flags.array({
      required: true,
      char: "p",
      description: messages.getMessage("pathFlagDescription")
    }),
    manifest: flags.string({
      required: true,
      char: "d",
      description: messages.getMessage("manifestFlagDescription")
    }),
    apiversion: flags.builtin({
      description: messages.getMessage("apiversion")
    }),
    loglevel: flags.enum({
      description: messages.getMessage("loglevel"),
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
        "FATAL"
      ]
    })
  };

  public async run(): Promise<AnyJson> {
    this.output = new Map<string, string[]>();

    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    this.flags.apiversion = this.flags.apiversion || "48.0";

    let paths = [];
    paths =
      this.flags.path.constructor === Array
        ? this.flags.path
        : paths.push(this.flags.path);
    for (const dir of paths) {
      if (fs.existsSync(path.resolve(dir)) && path.extname(dir) == ".xml") {
        await this.processMainfest(dir);
      } else {
        throw new Error(`Error : ${dir} is not valid package.xml`);
      }
    }
    let metadataTypes = [];
    for (let [key, value] of this.output) {
      metadataTypes.push({ name: key, members: value });
    }
    if (metadataTypes) {
      this.createpackagexml(metadataTypes);
    }
    if (!this.flags.json) {
      let tableout = [];
      metadataTypes.forEach(metadataType => {
        for (let item of metadataType.members) {
          tableout.push({ type: metadataType.name, member: item });
        }
      });
      this.ux.table(tableout, ["type", "member"]);
    }

    return metadataTypes;
  }

  private async xmlToJSON(directory: string) {
    const parser = new xml2js.Parser({ explicitArray: false });
    const parseString = util.promisify(parser.parseString);
    let obj = await parseString(fs.readFileSync(path.resolve(directory)));
    return obj;
  }
  private jSONToXML(obj: AnyJson) {
    const builder = new xml2js.Builder();
    let xml = builder.buildObject(obj);
    return xml;
  }
  public async processMainfest(dir: string) {
    let package_xml = await this.xmlToJSON(dir);
    let metadataTypes = package_xml.Package.types;
    if (metadataTypes.constructor === Array) {
      for (const item of metadataTypes) {
        if (item.members.constructor === Array) {
          this.setOutput(item.name, item.members);
        } else {
          this.setOutput(item.name, [item.members]);
        }
      }
    } else {
      if (metadataTypes.members.constructor === Array) {
        this.setOutput(metadataTypes.name, metadataTypes.members);
      } else {
        this.setOutput(metadataTypes.name, [metadataTypes.members]);
      }
    }
  }
  public setOutput(key: string, values: string[]) {
    let currentItems = this.output.get(key) || [];
    values.forEach(item => {
      if (!currentItems.includes(item)) {
        currentItems.push(item);
      }
    });
    this.output.set(key, currentItems);
  }
  createpackagexml(manifest: any[]) {
    let package_xml = {
      Package: {
        $: { xmlns: "http://soap.sforce.com/2006/04/metadata" },
        types: manifest,
        version: this.flags.apiversion
      }
    };
    fs.outputFileSync(
      `${this.flags.manifest}/package.xml`,
      this.jSONToXML(package_xml)
    );
  }
}
