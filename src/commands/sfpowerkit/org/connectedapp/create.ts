import { core, flags, SfdxCommand } from '@salesforce/command';
import { AnyJson, toJsonMap } from '@salesforce/ts-types';
import { JsonArray, JsonMap } from '@salesforce/ts-types';
import { SfdxProject, SfdxError } from '@salesforce/core';
import xml2js = require('xml2js');
import util = require('util');
import fs = require('fs-extra');
import rimraf = require('rimraf');
import { integer } from '@oclif/parser/lib/flags';
import { Analytics } from 'jsforce';
import { ClientRequest } from 'http';






const spawn = require('child-process-promise').spawn;


// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'connectedapp_create');


export default class Create extends SfdxCommand {




  
  public connectedapp_consumerKey:string;
  public connectedapp_certificate:string;
  public connectedapp_label:string;
  public connectedapp_email:string;





  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx  sfpowerkit:org:connectedapp:create -u myOrg@example.com -n AzurePipelines -c id_rsa -e azlam.abdulsalam@accentue.com
  Created Connected App AzurePipelines in Target Org
  `
  ];

 
  protected static flagsConfig = {
    name: flags.string({ required: true, char: 'n', description: messages.getMessage('nameFlagDescription') }),
    pathtocertificate: flags.filepath({ required: true, char: 'c', description: messages.getMessage('certificateFlagDescription')}),
    email: flags.email({ required: true, char: 'e', description: messages.getMessage('emailFlagDescription')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = true;

  public async run(): Promise<AnyJson> {

    rimraf.sync('temp_sfpowerkit');


     // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
     const username = this.org.getUsername();
     const pathToCertificate = this.flags.pathtocertificate.valueOf();
     this.connectedapp_email = this.flags.email;
     this.connectedapp_label = this.flags.name;
    
     var certificate = fs.readFileSync(pathToCertificate).toString();
     var textblock = certificate.split('\n');
     textblock.splice(0,1);
     textblock.splice(-2,1);
     certificate  = textblock.join('\n');
     certificate = certificate.replace(/(\r\n|\n|\r)/gm,"");
     this.connectedapp_certificate = certificate;
   


     this.connectedapp_consumerKey = this.createConsumerKey();


     var connectedApp_metadata:string = `<?xml version="1.0" encoding="UTF-8"?>
     <ConnectedApp xmlns="http://soap.sforce.com/2006/04/metadata">
         <contactEmail>${this.connectedapp_email}</contactEmail>
         <label>${this.connectedapp_label}</label>
         <oauthConfig>
             <callbackUrl>http://localhost:1717/OauthRedirect</callbackUrl>
             <certificate>${this.connectedapp_certificate}</certificate>
             <consumerKey>${this.connectedapp_consumerKey}</consumerKey>
             <scopes>Api</scopes>
             <scopes>Web</scopes>
             <scopes>RefreshToken</scopes>
         </oauthConfig>
     </ConnectedApp>`

    
     var package_xml:string = `<?xml version="1.0" encoding="UTF-8"?>
     <Package xmlns="http://soap.sforce.com/2006/04/metadata">
         <types>
             <members>*</members>
             <name>ConnectedApp</name>
         </types>
         <version>44.0</version>
     </Package>`

    
    let targetmetadatapath = 'temp_sfpowerkit/mdapi/connectedApps/'+this.connectedapp_label+'.connectedApp-meta.xml';
    fs.outputFileSync(targetmetadatapath,connectedApp_metadata);
    let targetpackagepath = 'temp_sfpowerkit/mdapi/package.xml';
    fs.outputFileSync(targetpackagepath,package_xml);
    
     // Split arguments to use spawn
     const args = [];
     args.push('force:mdapi:deploy');

     // USERNAME
     args.push('--targetusername');
     args.push(`${username}`);

     // MANIFEST
     args.push('--deploydir');
     args.push(`temp_sfpowerkit/mdapi`);

     args.push('--wait');
     args.push(`30`);
     
     this.ux.log(`Deploy connected app ${this.connectedapp_label}`)
     
     var startTime = (new Date()).valueOf();
    await spawn('sfdx', args, { stdio: 'inherit' });




   // rimraf.sync('temp_sfpowerkit');

    return {}
  }

  public createConsumerKey() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.";
  
    for (var i = 0; i < 32; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
  }
 
}
