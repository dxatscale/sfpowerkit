import { AnyJson } from "@salesforce/ts-types";
import { core, flags, SfdxCommand } from "@salesforce/command";
import { SFPowerkit } from "../../../../sfpowerkit";
import datamodelReportImpl from "../../../../impl/project/datamodel/reportimpl";
import simpleGit, { SimpleGit } from "simple-git";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);
// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "datamodel_report");

export default class Report extends SfdxCommand {
  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:project:datamodel:report`,
    `$ sfdx sfpowerkit:project:datamodel:report -p force-app/main/default/objects -d result`,
    `$ sfdx sfpowerkit:project:datamodel:report -p force-app/main/default/objects -t CustomField,RecordType`,
    `$ sfdx sfpowerkit:project:datamodel:report -p force-app/main/default/objects -t CustomField,RecordType -f csv`,
    `$ sfdx sfpowerkit:project:datamodel:report -f md -d docs -l`,
  ];

  protected static flagsConfig = {
    objectspath: flags.array({
      required: false,
      char: "p",
      description: messages.getMessage("objectspathDescription"),
    }),
    outputdir: flags.string({
      required: true,
      char: "d",
      description: messages.getMessage("outputdirDescription"),
      default: "datamodelreport",
    }),
    filtertype: flags.array({
      required: true,
      char: "t",
      description: messages.getMessage("filterDescription"),
      default: [
        "CustomField",
        "BusinessProcess",
        "RecordType",
        "ValidationRule",
        "CustomObject",
      ],
    }),
    format: flags.enum({
      required: false,
      char: "f",
      description: messages.getMessage("formatDescription"),
      options: ["json", "csv", "md"],
      default: "json",
    }),
    includechangelog: flags.boolean({
      char: "l",
      description: messages.getMessage("includechangelogDescription"),
      required: false,
    }),
    activechangelogpath: flags.string({
      required: false,
      char: "a",
      description: messages.getMessage("activechangelogpathDescription"),
    }),
    loglevel: flags.enum({
      description: messages.getMessage("loglevelDescription"),
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

  public async run(): Promise<AnyJson> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);
    let git: SimpleGit = simpleGit();

    let impl = new datamodelReportImpl(
      this.flags.filtertype,
      this.flags.objectspath,
      this.flags.format,
      this.flags.outputdir,
      this.flags.includechangelog,
      this.flags.activechangelogpath,
      git
    );

    let result = await impl.generateReport();

    return result;
  }
}
