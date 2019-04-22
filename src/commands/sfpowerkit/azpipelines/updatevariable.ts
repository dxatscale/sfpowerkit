import { core, flags, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import request = require('request-promise-native');



// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'azpipelines_updatevariable');

export default class UpdateVariable extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerkit:azpipelines:updatevariable -u az@devops.com -p pax -k env.consumerkey -v sdassad -i 8
     Successfully updated the variable
  `
  ];


  protected static flagsConfig = {
    username: flags.string({ required: true, char: 'u', description: messages.getMessage('usernameFlagDescription')}),
    pat: flags.string({ required: true, char: 'p', description: messages.getMessage('patFlagDescription')}),
    key: flags.string({ required: true, char: 'k', description: messages.getMessage('keyFlagDescription')}),
    value: flags.string({ required: true, char: 'v', description: messages.getMessage('valueFlagDescription')}),
    id: flags.string({ required: true, char: 'i', description: messages.getMessage('variablegroupIdFlagDescription')}),
    orgname: flags.string({ required: true, char: 'o', description: messages.getMessage('orgFlagDescription')}),
    projectname: flags.string({ required: true, char: 'g', description: messages.getMessage('projectFlagDescription')})
  };

 

  public async run(): Promise<AnyJson> {

   
    var query_uri = `https://dev.azure.com/${this.flags.orgname}/${this.flags.projectname}/_apis/distributedtask/variablegroups/${this.flags.id}?api-version=5.0-preview.1`;

    //this.ux.log(`Query URI ${query_uri}`);

    let  variables = await request({
      method: 'get',
      url: query_uri,
      auth: {
        user: `${this.flags.username}`,
        password: `${this.flags.pat}`,
      },
      json: true
    });
   
    //this.ux.logJson(variables);
   
    //Replace the key

    variables.variables[this.flags.key].value=this.flags.value;

    //new json
   // this.ux.logJson(variables);


    let result = await request({
      method: 'put',
      url: query_uri,
      auth: {
        user: `${this.flags.username}`,
        password: `${this.flags.pat}`,
      },
      body: variables,
      json: true
    });

    this.ux.log("Succesfully updated the variable");
 
    //this.ux.logJson(result);

    return result;
  }

  
}
