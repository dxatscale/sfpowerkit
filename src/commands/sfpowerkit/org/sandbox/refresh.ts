import { core, flags, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import fs = require('fs-extra');
import request = require('request-promise-native');
import rimraf = require('rimraf');
import { Connection, SfdxError } from '@salesforce/core';



// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'sandbox_refresh');

export default class Refresh extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerkit:org:sandbox:refresh -n test2  -f sitSandbox -v myOrg@example.com
  Successfully Enqueued Refresh of Sandbox
  `
  ];


  protected static flagsConfig = {
    name: flags.string({ required: true, char: 'n', description: messages.getMessage('nameFlagDescription') }),
    clonefrom: flags.string({ required: false, char: 'f', default: '', description: messages.getMessage('cloneFromFlagDescripton') }),
    licensetype: flags.string({ required: false, char: 'l',  options: ['DEVELOPER', 'DEVELOPER_PRO','PARTIAL','FULL'], description: messages.getMessage('licenseFlagDescription') }),
  };



    // Comment this out if your command does not require a hub org username
    protected static requiresDevhubUsername = true;




  public async run(): Promise<AnyJson> {

    rimraf.sync('temp_sfpowerkit');

    await this.hubOrg.refreshAuth();

    const conn = this.hubOrg.getConnection();

    this.flags.apiversion = this.flags.apiversion || await conn.retrieveMaxApiVersion();

    var result;


    const sandboxId = await this.getSandboxId(conn, this.flags.name);
    const uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/sobjects/SandboxInfo/${sandboxId}/`;

    if (this.flags.clonefrom) {

      const sourceSandboxId = await this.getSandboxId(conn, this.flags.clonefrom);

      result = await request({
        method: 'patch',
        url: uri,
        headers: {
          Authorization: `Bearer ${conn.accessToken}`
        },
        body: {
          AutoActivate: 'true',
          SourceId: `${sourceSandboxId}`
        },
        json: true
      });
    }
    else {
      result = await request({
        method: 'patch',
        url: uri,
        headers: {
          Authorization: `Bearer ${conn.accessToken}`
        },
        body: {
          AutoActivate: 'true',
          LicenseType: `${this.flags.licensetype}`,
        },
        json: true
      });
    }



    if (this.flags.outputfile) {
      await fs.outputJSON(this.flags.outputfile, result);
    }

    this.ux.log(`Successfully Enqueued Refresh of Sandbox`);


    rimraf.sync('temp_sfpowerkit');

    return result;
  }

  public async getSandboxId(conn: core.Connection, name: string) {


    const query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=SELECT+Id,SandboxName+FROM+SandboxInfo+WHERE+SandboxName+in+('${name}')`;

    //this.ux.log(`Query URI ${query_uri}`);

    const sandbox_query_result = await request({
      method: 'get',
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      json: true
    });

    //this.ux.logJson(sandbox_query_result);

    if(sandbox_query_result.records[0]==undefined)
    throw new  SfdxError(`Unable to continue, Please check your sandbox name: ${name}`);

    this.ux.log(`Fetched Sandbox Id for sandbox  ${name}  is ${sandbox_query_result.records[0].Id}`);
 

    return sandbox_query_result.records[0].Id;

  }
}
