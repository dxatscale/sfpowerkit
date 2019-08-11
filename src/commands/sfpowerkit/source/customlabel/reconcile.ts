import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import xml2js = require("xml2js");
import util = require("util");
import fs = require("fs-extra");
import rimraf = require("rimraf");
import path from "path";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "source_customlabel_clean"
);

export default class Reconcile extends SfdxCommand {
  private customlabel_path: string;

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:customlabel:reconcile -d path/to/customlabelfile.xml -p core
    Cleaned The Custom Labels
`
  ];

  protected static flagsConfig = {
    path: flags.string({
      required: true,
      char: "d",
      description: messages.getMessage("pathFlagDescription")
    }),
    project: flags.string({
      required: true,
      char: "p",
      description: messages.getMessage("packageFlagDescription")
    })
  };

  // Comment this out if your command does not require an org username
  //protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");

    // Gives first value in url after https protocol
    const packageName = this.flags.project;

    this.customlabel_path = this.flags.path;

    if (
      fs.existsSync(path.resolve(this.customlabel_path)) &&
      path.extname(this.customlabel_path) == ".xml"
    ) {
      const parser = new xml2js.Parser({ explicitArray: false });
      const parseString = util.promisify(parser.parseString);

      let retrieved_customlabels = await parseString(
        fs.readFileSync(path.resolve(this.customlabel_path))
      );

      if (!Object.keys(retrieved_customlabels).includes("CustomLabels")) {
        this.ux.log(`Metadata Mismatch: Not A CustomLabels Metadata File`);

        rimraf.sync("temp_sfpowerkit");

        return 1;
      }

      console.log(`Package ::: ${packageName}`);

      if (this.isIterable(retrieved_customlabels.CustomLabels.labels)) {
        retrieved_customlabels.CustomLabels.labels = retrieved_customlabels.CustomLabels.labels.filter(
          item => item.fullName.startsWith(`${packageName}_`)
        );
      } else {
        if (
          !retrieved_customlabels.CustomLabels.labels.fullName.startsWith(
            "${packageName}_`"
          )
        )
          delete retrieved_customlabels.CustomLabels.labels;
      }

      let builder = new xml2js.Builder();
      let xml = builder.buildObject(retrieved_customlabels);

      await fs.writeFileSync(path.resolve(this.customlabel_path), xml);

      this.ux.log(
        `Reconciled The Custom Labels  only to have ${packageName} labels (labels with full name beginning with ${packageName}_)`
      );
    } else {
      this.ux.log(`File is either not found, or not an xml file.`);
    }

    rimraf.sync("temp_sfpowerkit");

    return 0;
  }

  isIterable(obj) {
    if (obj == null) {
      return false;
    }
    return typeof obj[Symbol.iterator] === "function";
  }
}
