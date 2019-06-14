
import { AnyJson, getString } from '@salesforce/ts-types';
import fs from 'fs-extra';
import { core, flags, SfdxCommand } from '@salesforce/command';
import rimraf = require('rimraf');
import { RetrieveResultLocator, AsyncResult, Callback, AsyncResultLocator, Connection, RetrieveResult } from 'jsforce';
import { AsyncResource } from 'async_hooks';
import { SfdxError, AuthInfo, Aliases } from '@salesforce/core';
import xml2js = require('xml2js');
import util = require('util');
// tslint:disable-next-line:ordered-imports
var jsforce = require('jsforce');







// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'auth_login');


export default class Login extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx  sfpowerkit:auth:login -u azlam@sfdc.com -p Xasdax2w2  -a prod
      Authorized to azlam@sfdc.com
  `
  ];


  protected static flagsConfig = {
    username: flags.string({ required: true, char: 'u', description: messages.getMessage('usernameFlagDescription') }),
    password: flags.string({ required: true, char: 'p', description: messages.getMessage('passwordFlagDescription') }),
    securitytoken: flags.string({ required: false, char: 's', description: messages.getMessage('securityTokenFlagDescription') }),
    url: flags.url({ required: false, char: 'r', description: messages.getMessage('urlFlagDescription') }),
    alias: flags.string({ required: false, char: 'a', description: messages.getMessage('aliasFlagDescription') }),
  };

  loginUrl: string;
  password: string;

 
  public async run(): Promise<AnyJson> {

    rimraf.sync('temp_sfpowerkit');

    if (this.flags.url)
      this.loginUrl = this.flags.url;
    else
      this.loginUrl = 'https://test.salesforce.com'

    if (this.flags.securitytoken)
      this.password = this.flags.password.concat(this.flags.securitytoken);
    else
      this.password = this.flags.password;


    let conn = new Connection({
      loginUrl: this.loginUrl

    });



    await conn.login(this.flags.username, this.password, function (err, userInfo) {
      if (err) { throw new SfdxError("Unable to connect to the target org") }
    });


    const accessTokenOptions = {
      accessToken: conn.accessToken,
      instanceUrl: conn.instanceUrl,
      loginUrl: this.loginUrl,
      orgId: getString(conn, 'userInfo.organizationId'),
    }

   


    const auth = await AuthInfo.create({username:this.flags.username, accessTokenOptions});
     await auth.save();
   

     if(this.flags.alias)
     {
     const aliases = await Aliases.create({});
     aliases.set(this.flags.alias, this.flags.username);
     await aliases.write();
     }


  

    this.ux.log(`Authorized to ${this.flags.username}`);

    return { username:this.flags.username,accessTokenOptions };

  

  }


}



