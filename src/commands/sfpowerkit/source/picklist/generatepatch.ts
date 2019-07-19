import {
  AnyJson,
  JsonArray,
  asJsonArray
} from '@salesforce/ts-types';
import fs from 'fs-extra';
import {
  core,
  flags,
  SfdxCommand
} from '@salesforce/command';
import rimraf = require('rimraf');
import {
  SfdxError,
  SfdxProject
} from '@salesforce/core';
import xml2js = require('xml2js');
import util = require('util');
import {
  getPackageInfo,
  getDefaultPackageInfo
} from '../../../../shared/getPackageInfo';
import {
  searchFilesInDirectory
} from '../../../../shared/searchFilesInDirectory';
import DiffUtil from "../../../../shared/diffutils";
import {
  zipDirectory
} from "../../../../shared/zipDirectory"

var path = require('path');
const spawn = require('child-process-promise').spawn;


// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'source_picklist_generatepatch');


export default class Generatepatch extends SfdxCommand {

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx  sfpowerkit:source:picklist:generate -p Core -d src/core/main/default/objects/
     Scanning for fields of type picklist
     Found 30 fields of type picklist
     Source was successfully converted to Metadata API format and written to the location: .../temp_sfpowerkit/mdapi
     Generatign static resource file : src/core/main/default/staticresources/Core_picklist.resource-meta.xml
  `
  ];

  protected static flagsConfig = {
    package: flags.string({required: false, char: 'p', description: messages.getMessage('packageFlagDescription') }),
    objectsdir: flags.string({required: false, char: 'd', description: messages.getMessage('objectDirFlagDescription') }),
  };

  public async run(): Promise<AnyJson> {

    //clean any existing temp sf powerkit source folder
    rimraf.sync('temp_sfpowerkit');

    // Getting Project config
    const project = await SfdxProject.resolve();
    const projectJson = await project.retrieveSfdxProjectJson();

    //Retrieve the package
    let packageToBeUsed;
    if (this.flags.package)
      packageToBeUsed = getPackageInfo(projectJson, this.flags.package);
    else {
      packageToBeUsed = getDefaultPackageInfo(projectJson);
    }

    //set objects directory
    let objectsDirPath;
    if (this.flags.objectsdir)
      objectsDirPath =  this.flags.objectsdir;
    else {
      objectsDirPath = packageToBeUsed.path + `/main/default/objects/`;
    }

    this.ux.log("Scanning for fields of type picklist");

    let customFieldsWithPicklist: any[] = searchFilesInDirectory(objectsDirPath, '<type>Picklist</type>', '.xml');

    if (customFieldsWithPicklist && customFieldsWithPicklist.length > 0) {

      this.ux.log("Found "+ `${customFieldsWithPicklist.length}` +" fields of type picklist");

      let diffUtils = new DiffUtil('0', '0');

      fs.mkdirSync('temp_sfpowerkit');

      customFieldsWithPicklist.forEach(file => {
        diffUtils.copyFile(file, 'temp_sfpowerkit');
      });

      var sfdx_project_json: string = `{
        "packageDirectories": [
          {
            "path": "${packageToBeUsed.path}",
            "default": true
          }
        ],
        "namespace": "",
        "sourceApiVersion": "46.0"
      }`

      fs.outputFileSync('temp_sfpowerkit/sfdx-project.json', sfdx_project_json);

      //Convert to mdapi
      const args = [];
      args.push('force:source:convert');
      args.push('-r');
      args.push(`${packageToBeUsed.path}`);
      args.push('-d');
      args.push(`mdapi`);
      await spawn('sfdx', args, {
        stdio: 'inherit',
        cwd: 'temp_sfpowerkit'
      });

      //Generate zip file
      var zipFile = 'temp_sfpowerkit/' + `${packageToBeUsed.package}` + '_picklist.zip';
      await zipDirectory('temp_sfpowerkit/mdapi', zipFile);

      //Create Static Resource Directory if not exist
      let dir = packageToBeUsed.path + `/main/default/staticresources/`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      fs.copyFileSync(zipFile, packageToBeUsed.path + `/main/default/staticresources/${packageToBeUsed.package}_picklist.zip`);

      //Store it to static resources
      var metadata: string = `<?xml version="1.0" encoding="UTF-8"?>
      <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
          <cacheControl>Public</cacheControl>
          <contentType>application/zip</contentType>
      </StaticResource>`
      let targetmetadatapath = packageToBeUsed.path + `/main/default/staticresources/${packageToBeUsed.package}_picklist.resource-meta.xml`;

      this.ux.log("Generatign static resource file : "+ `${targetmetadatapath}` );

      fs.outputFileSync(targetmetadatapath, metadata);

      //clean temp sf powerkit source folder
      rimraf.sync('temp_sfpowerkit');
    }
    else {
      this.ux.log("No fields with type picklist found");
    }

    return 0;
  }

}