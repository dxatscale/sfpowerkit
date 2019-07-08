import { core, SfdxCommand, FlagsConfig, flags } from "@salesforce/command";
import DiffUtil from "../../../shared/diffutils";
import * as path from 'path'

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "project_diff"
);

export default class Diff extends SfdxCommand {
  public static description = messages.getMessage(
    "commandDescription"
  );

  public static examples = [
    `$ sfdx sfpowerkit:project:diff --diffFile DiffFileName --encoding EncodingOfFile --output OutputFolder
  `,
  `$ sfdx sfpowerkit:project:diff --revisionfrom revisionfrom --revisionto revisionto --output OutputFolder
  `
  ];

  protected static flagsConfig: FlagsConfig = {
    difffile : flags.string({char: 'f', description:messages.getMessage('diffFileDescription'), required:false }),
    encoding : flags.string({char:'e', description:messages.getMessage('encodingDescription'), required: false }),
    revisionfrom : flags.string({char:'r', description:messages.getMessage('revisionFromDescription'), required: false }),
    revisionto : flags.string({char:'t', description:messages.getMessage('revisionToDescription'), required: false }),
    output : flags.string({char:'d', description:messages.getMessage('outputFolderDescription'), required: true })
  };
  protected static requiresUsername = false;
  protected static requiresProject = true;

  public async run(): Promise<any> {
    const diffFile:string = this.flags.difffile;
    let encoding:string = this.flags.encoding;
    const outputFolder:string = this.flags.output;
    const revisionfrom:string = this.flags.revisionfrom;
    const revisionto:string = this.flags.revisionto;
    if(!encoding || encoding===""){
      encoding="utf8";
    }

    if((diffFile === undefined || diffFile === '') && (revisionfrom === undefined || revisionfrom === '')){
      this.error('Provide either diffFile or revisionFrom parameters')
    }
 
    let diffUtils= new DiffUtil(revisionfrom, revisionto);

    /* PATH TO DIFF FILE */
    let diffFilePath = ''
    if(diffFile){
      diffFilePath = path.join(process.cwd(), diffFile);
    }
    
    let diffOutput = await diffUtils.build(diffFilePath, encoding, outputFolder);

    return diffOutput;
  }
}
