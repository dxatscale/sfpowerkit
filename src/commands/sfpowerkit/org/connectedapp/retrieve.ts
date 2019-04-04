
import { AnyJson } from '@salesforce/ts-types';
import fs from 'fs-extra';
import { core, flags, SfdxCommand } from '@salesforce/command';
import rimraf = require('rimraf');
import { RetrieveResultLocator, AsyncResult, Callback, AsyncResultLocator, Connection, RetrieveResult } from 'jsforce';
import { AsyncResource } from 'async_hooks';
import { SfdxError } from '@salesforce/core';
import xml2js = require('xml2js');
import util = require('util');
// tslint:disable-next-line:ordered-imports
var jsforce = require('jsforce');
var path = require('path')
var unzipper = require('unzipper')




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
    securitytoken: flags.string({ required: false, char: 's', description: messages.getMessage('securityTokenFlagDescription')}),
    url: flags.url({ required: false, char: 'r', description: messages.getMessage('securityTokenFlagDescription')}),
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

    if(this.flags.url)
      this.loginUrl = this.flags.url;
    else
      this.loginUrl ='https://test.salesforce.com'



    let conn = new Connection({
      // you can change loginUrl to connect to sandbox or prerelease env.
      loginUrl: this.loginUrl

    });



    await conn.login(this.flags.username, this.flags.password, function (err, userInfo) {
      if (err) { return console.error(err); }
    });




    let retrieveRequest = {
      apiVersion: 45.0
    };

    retrieveRequest['singlePackage'] = true;
    retrieveRequest['unpackaged'] = { types: { name: 'ConnectedApp', members: this.flags.name } };

    // if(!this.flags.json)
    // this.ux.logJson(retrieveRequest);


    conn.metadata.pollTimeout = 60;

    let retrievedId;

    await conn.metadata.retrieve(retrieveRequest, function (error, result: AsyncResult) {

      if (error) { return console.error(error); }
      retrievedId = result.id;
    });


    // if(!this.flags.json)
    // console.log(retrievedId);


    let metadata_result;
    let count = 0

    while (true) {

      count++;
      await conn.metadata.checkRetrieveStatus(retrievedId, function (error, result: RetrieveResult) {
        if (error) { return console.error(error); }
        metadata_result = result
      });


      if (metadata_result.status == 'Pending') {
      if(!this.flags.json)
        this.ux.log(`Polling for metadata`)
        await (this.delay(5000));
      }
      else {
        
       // this.ux.logJson(metadata_result);
        break;
      }
    }

    if (!metadata_result.zipFile)
      throw new SfdxError("Unable to find the requested connectedapp");


    var zipFileName = "temp_sfpowerkit/unpackaged.zip";


    fs.mkdirSync('temp_sfpowerkit');
    fs.writeFileSync(zipFileName, metadata_result.zipFile, { encoding: 'base64' });

    await extract('temp_sfpowerkit');

    let resultFile = `temp_sfpowerkit/connectedApps/${this.flags.name}.connectedApp`;
    // if(!this.flags.json)
    // this.ux.log(`Checking for file ${resultFile}`);

   // this.ux.log(path.resolve(resultFile));
    let retrieved_connectedapp;

    if (fs.existsSync(path.resolve(resultFile))) {
      const parser = new xml2js.Parser({ explicitArray: false });
      const parseString = util.promisify(parser.parseString);
     
      retrieved_connectedapp = await parseString(fs.readFileSync(path.resolve(resultFile)));
      // if(!this.flags.json)
      // this.ux.logJson(retrieved_connectedapp);
      this.ux.log(`Retrieved ConnectedApp Succesfully  with Consumer Key : ${retrieved_connectedapp.ConnectedApp.oauthConfig.consumerKey}`);
    }
    else {
      throw new SfdxError("Unable to process")

    }

    rimraf.sync('temp_sfpowerkit');

    return { 'connectedapp': retrieved_connectedapp.ConnectedApp };


  }



  public async  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }



}

const extract = (location: string) => {
  return new Promise((resolve, reject) => {
      fs.createReadStream(`./${location}/unpackaged.zip`)
          .pipe(unzipper.Extract({ path: `${location}` }))
          .on('close', () => {
              resolve();
          })
          .on('error', error => reject(error));
  });
};


