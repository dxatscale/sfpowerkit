import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import fs = require("fs-extra");
import path from "path";
import { SFPowerkit } from "../../../../sfpowerkit";
import xmlUtil from "../../../../utils/xmlUtil";
// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "source_customlabel_buildmainfest"
);

export default class Buildmainfest extends SfdxCommand {
  public output: string[];
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:customlabel:buildmainfest -p project1/path/to/customlabelfile.xml -x mdapiout/package.xml\n` +
      `$ sfdx sfpowerkit:source:customlabel:buildmainfest -p project1/path/to/customlabelfile.xml,project2/path/to/customlabelfile.xml -x mdapiout/package.xml`
  ];

  protected static flagsConfig = {
    path: flags.array({
      required: true,
      char: "p",
      description: messages.getMessage("pathFlagDescription")
    }),
    manifest: flags.string({
      required: true,
      char: "x",
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
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);
    this.flags.apiversion = this.flags.apiversion || "48.0";

    let paths = [];
    paths =
      this.flags.path.constructor === Array
        ? this.flags.path
        : paths.push(this.flags.path);
    this.output = [];
    for (const element of paths) {
      if (
        fs.existsSync(path.resolve(element)) &&
        (element.endsWith("CustomLabels.labels") ||
          element.endsWith("CustomLabels.labels-meta.xml"))
      ) {
        await this.getlabels(element);
      } else {
        throw new Error(`Error : ${element} is not valid custom label file`);
      }
    }
    this.flags.manifest = await this.validatepackagexml(this.flags.manifest);
    await this.setlabels(this.flags.manifest);

    if (!this.flags.json) {
      let result = [];
      for (let i = 0; i < this.output.length; i++) {
        result.push({ sno: i + 1, label: this.output[i] });
      }
      this.ux.table(result, ["sno", "label"]);
    }
    return this.output;
  }
  setoutput(label: string) {
    if (!this.output.includes(label) && label !== "*") {
      this.output.push(label);
    }
  }

  public async getlabels(labelpath: string) {
    let retrieved_customlabels = await xmlUtil.xmlToJSON(labelpath);
    let labels = retrieved_customlabels.CustomLabels.labels;
    if (labels.constructor === Array) {
      labels.forEach(label => {
        this.setoutput(label.fullName);
      });
    } else {
      this.setoutput(labels.fullName);
    }
  }
  public async validatepackagexml(manifest: string) {
    let fileOrFolder = path.normalize(manifest);
    if (fs.existsSync(fileOrFolder)) {
      let stats = fs.statSync(fileOrFolder);
      if (stats.isFile()) {
        if (path.extname(fileOrFolder) != ".xml") {
          throw new Error(`Error : ${fileOrFolder} is not valid package.xml`);
        } else {
          await this.checklabelspackagexml(manifest);
        }
      } else if (stats.isDirectory()) {
        manifest = `${manifest}/package.xml`;
        this.createpackagexml(manifest);
      }
    } else {
      manifest = `${manifest}/package.xml`;
      this.createpackagexml(manifest);
    }
    return manifest;
  }
  createpackagexml(manifest: string) {
    var package_xml: string = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
      <members>*</members>
      <name>CustomLabel</name>
  </types>
  <version>${this.flags.apiversion}</version>
</Package>`;
    fs.outputFileSync(manifest, package_xml);
  }
  public async checklabelspackagexml(manifest: string) {
    let package_xml = await xmlUtil.xmlToJSON(manifest);
    let isLabelexist = false;
    if (package_xml.Package.types.constructor === Array) {
      for (const item of package_xml.Package.types) {
        if (item.name === "CustomLabel") {
          this.setlabelutil(item.members);
          item.members = "*";
          isLabelexist = true;
          break;
        }
      }
    } else if (package_xml.Package.types.name === "CustomLabel") {
      this.setlabelutil(package_xml.Package.types.members);
      package_xml.Package.types.members = "*";
      isLabelexist = true;
    }
    if (!isLabelexist) {
      let label = { name: "CustomLabel", members: "*" };
      package_xml.Package.types.push(label);
    }
    fs.outputFileSync(manifest, xmlUtil.jSONToXML(package_xml));
  }
  setlabelutil(members: any) {
    if (members.constructor === Array) {
      for (const label of members) {
        this.setoutput(label);
      }
    } else {
      this.setoutput(members);
    }
  }
  public async setlabels(manifest: string) {
    let package_xml = await xmlUtil.xmlToJSON(manifest);
    if (package_xml.Package.types.constructor === Array) {
      for (const item of package_xml.Package.types) {
        if (item.name === "CustomLabel") {
          item.members = this.output;
          break;
        }
      }
    } else if (package_xml.Package.types.name === "CustomLabel") {
      package_xml.Package.types.members = this.output;
    }
    fs.outputFileSync(manifest, xmlUtil.jSONToXML(package_xml));
  }
}
