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
  "project_mainfest_diff"
);

export default class Diff extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:project:mainfest:diff -f source/package.xml -t target/package.xml -d output`
  ];

  protected static flagsConfig = {
    sourcepath: flags.string({
      required: true,
      char: "s",
      description: messages.getMessage("sourcepathFlagDescription")
    }),
    targetpath: flags.string({
      required: true,
      char: "t",
      description: messages.getMessage("targetpathFlagDescription")
    }),
    output: flags.string({
      required: true,
      char: "d",
      description: messages.getMessage("outputFlagDescription")
    }),
    apiversion: flags.builtin({
      description: messages.getMessage("apiversion")
    }),
    format: flags.enum({
      required: false,
      char: "f",
      description: messages.getMessage("formatFlagDescription"),
      options: ["json", "csv", "xml"]
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
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    this.flags.apiversion = this.flags.apiversion || "48.0";

    if (!this.flags.format || this.flags.json) {
      this.flags.format = "json";
    }

    let sourceXml = await this.processMainfest(this.flags.sourcepath);
    let targetXml = await this.processMainfest(this.flags.targetpath);

    let metadataTypes = [];
    if (sourceXml && targetXml) {
      for (let key of targetXml.keys()) {
        if (sourceXml.has(key)) {
          const diffout = this.getdiffList(
            sourceXml.get(key),
            targetXml.get(key)
          );
          if (diffout) {
            metadataTypes.push({ name: key, members: diffout });
          }
        } else {
          metadataTypes.push({ name: key, members: targetXml.get(key) });
        }
      }
    }
    let output = [];
    if (metadataTypes) {
      metadataTypes.forEach(metadataType => {
        for (let item of metadataType.members) {
          output.push({
            status: "Added at Target",
            type: metadataType.name,
            member: item
          });
        }
      });

      if (this.flags.format === "xml") {
        this.createpackagexml(metadataTypes);
      } else if (this.flags.format === "csv") {
        this.generateCSVOutput(output);
      } else {
        fs.writeFileSync(
          `${this.flags.output}/package.json`,
          JSON.stringify(output)
        );
      }
    }

    return output;
  }

  public async xmlToJSON(directory: string) {
    const parser = new xml2js.Parser({ explicitArray: false });
    const parseString = util.promisify(parser.parseString);
    let obj = await parseString(fs.readFileSync(path.resolve(directory)));
    return obj;
  }
  public jSONToXML(obj: AnyJson) {
    const builder = new xml2js.Builder();
    let xml = builder.buildObject(obj);
    return xml;
  }
  public async processMainfest(pathToManifest: string) {
    let output = new Map<string, string[]>();
    if (
      fs.existsSync(path.resolve(pathToManifest)) &&
      path.extname(pathToManifest) == ".xml"
    ) {
      let package_xml = await this.xmlToJSON(pathToManifest);
      let metadataTypes = package_xml.Package.types;
      if (metadataTypes.constructor === Array) {
        metadataTypes.forEach(type => {
          if (type.members !== "*") {
            output.set(
              type.name,
              type.members.constructor === Array ? type.members : [type.members]
            );
          }
        });
      } else {
        if (metadataTypes.members !== "*") {
          output.set(
            metadataTypes.name,
            metadataTypes.members.constructor === Array
              ? metadataTypes.members
              : [metadataTypes.members]
          );
        }
      }
    } else {
      throw new Error(`Error : ${pathToManifest} is not valid package.xml`);
    }
    return output;
  }
  getdiffList(from: string[], to: string[]) {
    let output = [];
    to.forEach(item => {
      if (!from.includes(item)) {
        output.push(item);
      }
    });

    return output;
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
      `${this.flags.output}/package.xml`,
      this.jSONToXML(package_xml)
    );
  }
  generateCSVOutput(output: any[]) {
    let newLine = "\r\n";
    let result = "status,type,member" + newLine;
    output.forEach(element => {
      result = `${result}${element.status},${element.type},${element.member}${newLine}`;
    });
    fs.writeFileSync(`${this.flags.output}/package.csv`, result);
  }
}
