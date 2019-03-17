import { core, flags, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import fs = require('fs-extra');
import request = require('request-promise-native');
import rimraf = require('rimraf');
import { SfdxError } from '@salesforce/core';








// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'sandbox_create');

export default class Create extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerkit:org:sandbox:create -d Testsandbox -l DEVELOPER -n test2 -u myOrg@example.com
  Successfully Enqueued Creation of Sandbox
  `
  ];


  protected static flagsConfig = {
    name: flags.string({ required: true, char: 'n', description: messages.getMessage('nameFlagDescription') }),
    description: flags.string({ required: true, char: 'd', description: messages.getMessage('descriptionFlagDescription') }),
    licensetype: flags.string({ required: true, char: 'l',  options: ['DEVELOPER', 'DEVELOPER_PRO','PARTIAL','FULL'], description: messages.getMessage('licenseFlagDescription') }),
    apexclass: flags.string({ required: false, char: 'a', default:'', description: messages.getMessage('apexClassFlagDescription') }),
    clonefrom: flags.string({ required: false, char: 'f', default:'', description: messages.getMessage('cloneFromFlagDescripton') })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;



  public async run(): Promise<AnyJson> {

    rimraf.sync('temp_sfpowerkit');

    await this.org.refreshAuth();

    const conn = this.org.getConnection();

    this.flags.apiversion = this.flags.apiversion || await conn.retrieveMaxApiVersion();

    const uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/sobjects/SandboxInfo/`;

    this.ux.log(`${this.flags.apexclass}  ${this.flags.clonefrom} `)

    var sourceSandboxId:string='';
    var result;

    if(this.flags.clonefrom)
    {
     

    const sourceSandboxId = await this.getSandboxId(conn, this.flags.clonefrom);

     result = await request({
      method: 'post',
      uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      body: {
        AutoActivate: 'true',
        SandboxName: `${this.flags.name}`,
        Description: `${this.flags.description}`,
        ApexClassId: `${this.flags.apexclass}`,
        SourceId: sourceSandboxId
      },
      json: true
    });
  }
  else{

    result = await request({
      method: 'post',
      uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      body: {
        AutoActivate: 'true',
        SandboxName: `${this.flags.name}`,
        Description: `${this.flags.description}`,
        LicenseType: `${this.flags.licensetype}`,
        ApexClassId: `${this.flags.apexclass}`
      },
      json: true
    });
  }
   
    if(result.success)
    {
    this.ux.log(`Successfully Enqueued Creation of Sandbox`);
    this.ux.log(result);
    }
    else
    {
      throw new SfdxError("Unable to Create sandbox");
    }

    if (this.flags.outputfile) {
      await fs.outputJSON(this.flags.outputfile, result);
    }

    rimraf.sync('temp_sfpowerkit');

    return result;
  }

  public async getSandboxId(conn: core.Connection, name: string) {
    
    const query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=SELECT+Id,SandboxName+FROM+SandboxInfo+WHERE+SandboxName+in+('${name}')`;

   // this.ux.log(`Query URI ${query_uri}`);

    const sandbox_query_result = await request({
      method: 'get',
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

   // this.ux.logJson(sandbox_query_result);

    if(sandbox_query_result.records[0]==undefined)
    throw new  SfdxError(`Unable to continue, Please check your sandbox name: ${name}`);

    this.ux.log(`Fetched Sandbox Id for sandbox  ${name}  is ${sandbox_query_result.records[0].Id}`);
 

    return sandbox_query_result.records[0].Id;

  }
}
