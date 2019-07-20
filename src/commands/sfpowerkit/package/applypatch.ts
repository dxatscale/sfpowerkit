
import { AnyJson } from '@salesforce/ts-types';
import fs from 'fs-extra';
import { core, flags, SfdxCommand } from '@salesforce/command';
import rimraf = require('rimraf');
import { RetrieveResultLocator, AsyncResult, Callback, AsyncResultLocator, Connection, RetrieveResult, SaveResult, DeployResult } from 'jsforce';
import { AsyncResource } from 'async_hooks';
import { SfdxError } from '@salesforce/core';
import xml2js = require('xml2js');
import util = require('util');
// tslint:disable-next-line:ordered-imports
var jsforce = require('jsforce');
var path = require('path');
import { checkRetrievalStatus } from '../../../shared/checkRetrievalStatus';
import { checkDeploymentStatus } from '../../../shared/checkDeploymentStatus';
import { extract } from '../../../shared/extract';

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'package_applypatch');

export default class Applypatch extends SfdxCommand {

  public connectedapp_consumerKey: string;
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerkit:package:applypatch -n customer_picklist -u sandbox
    Preparing Patch
    Deploying Patch with ID  0Af4Y000003Q7GySAK
    Polling for Deployment Status
    Polling for Deployment Status
    Patch customer_picklist Deployed successfully.
  `
  ];

  protected static flagsConfig = {
    name: flags.string({ required: true, char: 'n', description: messages.getMessage('nameFlagDescription') }),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {

    rimraf.sync('temp_sfpowerkit');

    //Connect to the org
    await this.org.refreshAuth();
    const conn = this.org.getConnection();
    const apiversion = await conn.retrieveMaxApiVersion();

    let retrieveRequest = {
      apiVersion: apiversion
    };

    //Retrieve Duplicate Rule
    retrieveRequest['singlePackage'] = true;
    retrieveRequest['unpackaged'] = { types: { name: 'StaticResource', members: this.flags.name } };
    conn.metadata.pollTimeout = 60;
    let retrievedId;
    await conn.metadata.retrieve(retrieveRequest, function (error, result: AsyncResult) {
      if (error) { return console.error(error); }
      retrievedId = result.id;
    });

    let metadata_retrieve_result = await checkRetrievalStatus(conn, retrievedId);
    if (!metadata_retrieve_result.zipFile)
      throw new SfdxError("Unable to find the requested Static Resource");

    //Retrieve Patch
    this.ux.log(`Preparing Patch`);
    var zipFileName = "temp_sfpowerkit/unpackaged.zip";
    fs.mkdirSync('temp_sfpowerkit');
    fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, { encoding: 'base64' });

    if (fs.existsSync(path.resolve(zipFileName))) {

      await extract('temp_sfpowerkit');
      fs.unlinkSync(zipFileName);

      let resultFile = `temp_sfpowerkit/staticresources/${this.flags.name}.resource`;

      fs.copyFileSync(resultFile, `temp_sfpowerkit/unpackaged.zip`);

      //Deploy patch using mdapi
      conn.metadata.pollTimeout = 300;
      let deployId: AsyncResult;

      var zipStream = fs.createReadStream(zipFileName);
      await conn.metadata.deploy(zipStream, { rollbackOnError: true, singlePackage: true }, function (error, result: AsyncResult) {
        if (error) { return console.error(error); }
        deployId = result;
      });

      this.ux.log(`Deploying Patch with ID  ${deployId.id}`);
      let metadata_deploy_result: DeployResult = await checkDeploymentStatus(conn, deployId.id);

      if (!metadata_deploy_result.success)
        throw new SfdxError("Unable to deploy the Patch");

      this.ux.log(`Patch ${this.flags.name} Deployed successfully.`);
      rimraf.sync('temp_sfpowerkit');
      return { 'status': 1 };

    }
    else {
      this.ux.log(`Patch ${this.flags.name} not found in the org`);
    }

  }

}