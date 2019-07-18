
import { AnyJson, JsonArray, asJsonArray } from '@salesforce/ts-types';
import fs from 'fs-extra';
import { core, flags, SfdxCommand } from '@salesforce/command';
import rimraf = require('rimraf');
import { SfdxError, SfdxProject } from '@salesforce/core';
import xml2js = require('xml2js');
import util = require('util');
import { getPackageInfo, getDefaultPackageInfo } from '../../../../shared/getPackageInfo';
import { searchFilesInDirectory } from '../../../../shared/searchFilesInDirectory';
import DiffUtil from "../../../../shared/diffutils";
import { zipDirectory } from "../../../../shared/zipDirectory"

var path = require('path');


// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'apextestsuite_convert');




export default class Generate extends SfdxCommand {

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx  sfpowerkit:source:picklist:generate -p Core 
     Scanning for fields with picklist fields
     Found 30 fields with picklist type
     Generatign static resource file core_picklist.zip
  `
  ];


  protected static flagsConfig = {
    package: flags.string({ required: false, char: 'p', description: messages.getMessage('packageFlagDescription') }),
  };




  public async run(): Promise<AnyJson> {

    rimraf.sync('temp_sfpowerkit');

    // Getting Project config
    const project = await SfdxProject.resolve();
    const projectJson = await project.retrieveSfdxProjectJson();

    //Retrieve the package
    let packageToBeUsed;
    if (this.flags.package)
      packageToBeUsed = getPackageInfo(projectJson, this.flags.package);
    else
      packageToBeUsed = getDefaultPackageInfo(projectJson);



    //Check for the apextestsuite in the path
    // let apextestsuite_file_path = packageToBeUsed.path + `/main/default/testsuites/${this.flags.name}.testSuite-meta.xml`;
    // if(this.flags.pathOverride)
    // apextestsuite_file_path = packageToBeUsed.path +  this.flags.pathOverride + `/testsuites/${this.flags.name}.testSuite-meta.xml`;


    let customFieldsWithPicklist: any[] = searchFilesInDirectory(packageToBeUsed.path + `/main/default/objects/`, '<type>Picklist</type>', '.xml');

    if (customFieldsWithPicklist.length > 0) {
      let diffUtils = new DiffUtil('0', '0');
      this.ux.logJson(customFieldsWithPicklist);

      fs.mkdirSync('temp_sfpowerkit');

      customFieldsWithPicklist.forEach(file => {
        diffUtils.copyFile(file, 'temp_sfpowerkit');
      });

    

      var zipFile = 'temp_sfpowerkit/'+`${this.flags.package}`+'_picklist.zip';
      await zipDirectory('temp_sfpowerkit', zipFile);
      fs.copyFileSync(zipFile, packageToBeUsed.path + `/main/default/staticresources/${this.flags.package}_picklist.zip`);


      var metadata:string = `<?xml version="1.0" encoding="UTF-8"?>
      <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
          <cacheControl>Public</cacheControl>
          <contentType>application/zip</contentType>
      </StaticResource>`


      let targetmetadatapath = packageToBeUsed.path + `/main/default/staticresources/${this.flags.package}_picklist.resource-meta.xml`;
      fs.outputFileSync(targetmetadatapath,metadata);

    }




    return 0;

  }





}



