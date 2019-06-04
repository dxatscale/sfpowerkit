import { core, flags, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';


const spawn = require('child-process-promise').spawn;




// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'sandbox_refresh');

export default class Usage extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerkit:org:scratchorg:usage -v devhub
    SCRATCH_ORGS_USED  NAME
    ─────────────────  ─────────────────
    2                  XYZ
    2                  JFK
    Total number of records retrieved: 4.
  `
  ];




  
  // Comment this out if your command does not require a hub org username
  protected static requiresDevhubUsername = true;




  public async run(): Promise<AnyJson> {

  
    const devhub_username = this.flags.targetdevhubusername;
    
     // Split arguments to use spawn
     const args = [];
     args.push('force:data:soql:query');

     //query
      args.push('-q');
      args.push(`SELECT count(id) In_Use, createdby.name FROM ActiveScratchOrg group by createdby.name`);
      
      args.push('-u');
      args.push(devhub_username);

  
      await spawn('sfdx', args, { stdio: 'inherit' });

      return 1;

  }
}
