import {core, flags, SfdxCommand} from '@salesforce/command';
import {AnyJson, toJsonMap} from '@salesforce/ts-types';
import {JsonArray,JsonMap} from '@salesforce/ts-types';
import { SfdxProject } from '@salesforce/core';
import xml2js = require('xml2js');
import util = require('util');
import fs = require('fs-extra');
import coverageJSON from '../../coverage.json';


const spawn = require('child-process-promise').spawn;


// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'valid');

export default class Valid extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx hello:org --targetusername myOrg@example.com --targetdevhubusername devhub@org.com
  Hello world! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  My hub org id is: 00Dxx000000001234
  `,
  `$ sfdx hello:org --name myname --targetusername myOrg@example.com
  Hello myname! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    package: flags.string({required:false, char: 'n', description: messages.getMessage('packageFlagDescription')}),
    
  };

  // Comment this out if your command does not require an org username
  //protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
 // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public async run(): Promise<AnyJson> {

    // Getting Project config
    const project = await SfdxProject.resolve();

    const projectJson = await project.retrieveSfdxProjectJson();
    
    let packageToBeScanned = this.flags.package;
    this.ux.log("package:"+packageToBeScanned);
  

    const packageDirectories = projectJson.get('packageDirectories') as JsonArray || [];
    this.ux.logJson(packageDirectories);


    for (const sf_package of (packageDirectories as JsonArray)) {
        
      if(packageToBeScanned!=undefined && packageToBeScanned === sf_package['package'])
      {
        this.ux.log("found");
        this.ux.logJson(sf_package.valueOf());
        await this.validate(sf_package);
        break;
      }
      
    }

    //Iterate through packages
    //Find the default package
    //Figure all the metadata and write it to a json
    //Compare json with metadata json
    //Output what is crap 
    

    
    return { };
  }

  public async  validate(packageToBeScanned:AnyJson)
  {
    this.ux.log("found2");
    this.ux.logJson(packageToBeScanned.valueOf());
   
    // Split arguments to use spawn
    const args = [];
    args.push('force:source:convert');

    // outputdir
    args.push('-d');
    args.push('mdapi');

    // package name
    args.push('-n');
    args.push(`${packageToBeScanned['package']}`);

    args.push('-r');
    args.push(`${packageToBeScanned['path']}`);


    // INSTALL PACKAGE
    this.ux.log(`Converting package ${packageToBeScanned['package']}`);
    
    
    var startTime = (new Date()).valueOf();
    await spawn('sfdx', args, { stdio: 'inherit' });

    let targetFilename = 'mdapi/package.xml';

    if (fs.existsSync(targetFilename)) {
      const parser = new xml2js.Parser({ explicitArray: false });
      const parseString = util.promisify(parser.parseString);
      const existing = await parseString(fs.readFileSync(targetFilename));     

      const badtypes =[];
   
      for (const types of (existing.Package.types as JsonArray)) {

        coverageJSON.forEach(element => {
          if(types['name']===element.Metadata)
          {
           if(element.isUnlockedPackagingSupported)
             this.ux.log(`${element.Metadata} is Supported`)
           else
            badtypes.push(element.Metadata);
          }
        });
        

      }

    if(badtypes.length>0)
    {
      this.ux.log("Elements not supported are ");
      this.ux.logJson(badtypes);
      throw new Error("Unsupported metadata found in packaging folder");
    }
  

    } else {
      throw new Error(`Not found: ${targetFilename}`);
    }
  

    return { message:'Success, All metadata are packageable!'};

  }

  


}
