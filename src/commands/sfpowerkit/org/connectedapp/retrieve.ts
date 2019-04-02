
import { AnyJson } from '@salesforce/ts-types';

import { core, flags, SfdxCommand } from '@salesforce/command';
import rimraf = require('rimraf');
import { RetrieveResultLocator, AsyncResult, Callback, AsyncResultLocator, Connection, RetrieveResult } from 'jsforce';
import { AsyncResource } from 'async_hooks';
import { SfdxError } from '@salesforce/core';
// tslint:disable-next-line:ordered-imports
var jsforce = require('jsforce');



// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'connectedapp_retrieve');


export default class Retrieve extends SfdxCommand {





  public connectedapp_consumerKey: string;






  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx  sfpowerkit:org:connectedapp:retrieve -u azlam@sfdc.com -p Xasdax2w2 -n AzurePipelines
  Retrived AzurePipelines Consumer Key : XSD21Sd23123w21321
  `
  ];


  protected static flagsConfig = {
    name: flags.string({ required: true, char: 'n', description: messages.getMessage('nameFlagDescription') }),
    username: flags.string({ required: true, char: 'u', description: messages.getMessage('usernameFlagDescription') }),
    password: flags.string({ required: true, char: 'p', description: messages.getMessage('passwordFlagDescription') }),
    //securitytoken: flags.string({ required: false, char: 's', description: messages.getMessage('securityTokenFlagDescription')}),
    //url: flags.url({ required: false, char: 'r', description: messages.getMessage('securityTokenFlagDescription')}),
  };
  loginUrl: string;

  // Comment this out if your command does not require an org username
  //protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = true;


  public async run(): Promise<AnyJson> {

    rimraf.sync('temp_sfpowerkit');

    this.loginUrl = `https://test.salesforce.com`




    let conn = new Connection({
      // you can change loginUrl to connect to sandbox or prerelease env.
      loginUrl: 'https://test.salesforce.com'

    });



    await conn.login(this.flags.username, this.flags.password, function (err, userInfo) {
      if (err) { return console.error(err); }
      // Now you can get the access token and instance URL information.
      // Save them to establish connection next time.
      console.log(conn.accessToken);
      console.log(conn.instanceUrl);
      // logged in user property
      console.log("User ID: " + userInfo.id);
      console.log("Org ID: " + userInfo.organizationId);
      // ...
    });




    let retrieveRequest = {
      apiVersion: 45.0
    };

    retrieveRequest['singlePackage'] = true;
    retrieveRequest['unpackaged'] = { types: { name: 'ConnectedApp', members: this.flags.name } };

    this.ux.logJson(retrieveRequest);


    conn.metadata.pollTimeout = 60;

    let retrievedId;
    let retrievedState;

    await conn.metadata.retrieve(retrieveRequest, function (error, result: AsyncResult) {

      if (error) { return console.error(error); }

      retrievedId = result.id;
      retrievedState = result.state;
      console.log(result.id);
      console.log(result.state);
    });


    let metadata_result;

    while (true) {

      await conn.metadata.checkRetrieveStatus(retrievedId, function (error, result: RetrieveResult) {
        if (error) { return console.error(error); }
        metadata_result = result
      });


      if (metadata_result.status == 'Pending') {
        console.log("Polling Metadata");
        this.ux.logJson(metadata_result);
        await (this.delay(2000));
      }
      else {
        this.ux.logJson(metadata_result);
        break;
      }
    }


   //Unzip Zipfile
   //Convert XML To JSON
   //JSON Output to Screen







    return { 'connectedapp.consumerkey': this.connectedapp_consumerKey };
  }



  public async  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}


