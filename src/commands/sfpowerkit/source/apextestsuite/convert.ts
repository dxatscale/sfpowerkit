import { AnyJson, JsonArray, asJsonArray } from "@salesforce/ts-types";
import fs from "fs-extra";
import { core, flags, SfdxCommand } from "@salesforce/command";
import rimraf = require("rimraf");
import { SfdxError, SfdxProject } from "@salesforce/core";
import xml2js = require("xml2js");
import util = require("util");
import {
  getPackageInfo,
  getDefaultPackageInfo
} from "../../../../utils/getPackageInfo";
var path = require("path");

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "apextestsuite_convert"
);

export default class Convert extends SfdxCommand {
  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:apextestsuite:convert -n MyApexTestSuite 
    "ABC2,ABC1Test"    
  `
  ];

  protected static flagsConfig = {
    name: flags.string({
      required: true,
      char: "n",
      description: messages.getMessage("nameFlagDescription")
    }),
    package: flags.string({
      required: false,
      char: "p",
      description: messages.getMessage("packageFlagDescription")
    }),
    pathoverride: flags.string({
      required: false,
      char: "o",
      description: messages.getMessage("pathFlagDescription")
    })
  };

  public async run(): Promise<AnyJson> {
    rimraf.sync("temp_sfpowerkit");

    // Getting Project config
    const project = await SfdxProject.resolve();
    const projectJson = await project.retrieveSfdxProjectJson();

    //Retrieve the package
    let packageToBeUsed;
    if (this.flags.package)
      packageToBeUsed = getPackageInfo(projectJson, this.flags.package);
    else packageToBeUsed = getDefaultPackageInfo(projectJson);

    //Check for the apextestsuite in the path
    let apextestsuite_file_path =
      packageToBeUsed.path +
      `/main/default/testsuites/${this.flags.name}.testSuite-meta.xml`;
    if (this.flags.pathOverride)
      apextestsuite_file_path =
        packageToBeUsed.path +
        this.flags.pathOverride +
        `/testsuites/${this.flags.name}.testSuite-meta.xml`;

    if (fs.existsSync(path.resolve(apextestsuite_file_path))) {
      const parser = new xml2js.Parser({ explicitArray: false });
      const parseString = util.promisify(parser.parseString);

      let apex_test_suite = await parseString(
        fs.readFileSync(path.resolve(apextestsuite_file_path))
      );

      let apex_test_suite_as_string = JSON.stringify(
        apex_test_suite.ApexTestSuite.testClassName
      );

      apex_test_suite_as_string = apex_test_suite_as_string.replace(
        /("|')/g,
        ""
      );

      apex_test_suite_as_string = apex_test_suite_as_string.slice(1, -1);

      apex_test_suite_as_string = '"' + apex_test_suite_as_string.concat('"');

      this.ux.log(apex_test_suite_as_string);
    } else {
      throw new SfdxError("Apex Test Suite not found");
    }

    return 0;
  }
}
