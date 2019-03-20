import { core, flags, SfdxCommand, Result } from '@salesforce/command';
import { AnyJson, JsonArray } from '@salesforce/ts-types';
import fs = require('fs-extra');
import request = require('request-promise-native');
import rimraf = require('rimraf');
import { Connection, SfdxError, AuthInfo, Org, SfdxProject } from '@salesforce/core';



// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'source_profile_generate');

export default class Generate extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerkit:source:profile:generate -x package.xml
  Generated Admin Profile succesfully
  `
  ];


  protected static flagsConfig = {
    name: flags.filepath({ required: true, char: 'x', description: messages.getMessage('manifestFlagDescription')})
  };

  protected static requiresProject = true;

  public async run(): Promise<AnyJson> {

    rimraf.sync('temp_sfpowerkit');

    const project = await SfdxProject.resolve();

    const projectJson = await project.retrieveSfdxProjectJson();

    let packageToBeScanned = this.flags.package;
    this.ux.log("package:" + packageToBeScanned);


    const packageDirectories = projectJson.get('packageDirectories') as JsonArray || [];


    return {}
  }

  
}
