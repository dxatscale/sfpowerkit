import {
  core,
  flags,
  SfdxCommand
} from '@salesforce/command';
import {
  AnyJson
} from '@salesforce/ts-types';
import xml2js = require('xml2js');
import util = require('util');
import fs = require('fs-extra');
import rimraf = require('rimraf');

const spawn = require('child-process-promise').spawn;

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'source_customlabel_create');


export default class Create extends SfdxCommand {

  public customlabel_fullname: string;
  public customlabel_categories: string;
  public customlabel_language: string = 'en_US';
  public customlabel_protected: boolean = false;
  public customlabel_shortdescription: string;
  public customlabel_value: string;

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerkit:source:customlabel:create -u fancyScratchOrg1 -n FlashError -v "Memory leaks aren't for the faint hearted" -s "A flashing error"
  Created CustomLabel FlashError in Target Org
  `
  ];


  protected static flagsConfig = {

    fullname: flags.string({
      required: true,
      char: 'n',
      description: messages.getMessage('fullnameFlagDescription')
    }),
    value: flags.string({
      required: true,
      char: 'v',
      description: messages.getMessage('valueFlagDescription')
    }),
    categories: flags.string({
      required: false,
      char: 'c',
      description: messages.getMessage('categoriesFlagDescription')
    }),
    language: flags.string({
      required: false,
      char: 'l',
      description: messages.getMessage('languageFlagDescription')
    }),
    protected: flags.string({
      required: false,
      char: 'p',
      description: messages.getMessage('protectedFlagDescription')
    }),
    shortdescription: flags.string({
      required: true,
      char: 's',
      description: messages.getMessage('shortdescriptionFlagDescription')
    }),

    ignorenamespace: flags.boolean({
      char: 'i',
      default: false,
      description: messages.getMessage('ignorenamespaceFlagDescription')
    }),

  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = true;

  public async run(): Promise < AnyJson > {

    rimraf.sync('temp_sfpowerkit');

    await this.org.refreshAuth();

    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    const username = this.org.getUsername();

    // Gives first value in url after https protocol
    const orgShortName = this.org.getConnection().baseUrl()
                                      .replace("https://","")
                                      .split(/[\.]/)[0]
                                      .replace(/[^A-Za-z0-9]/g, '');

    this.customlabel_fullname = (this.flags.ignorenamespace) ? this.flags.fullname : `${orgShortName}_${this.flags.fullname}`;
    this.customlabel_value = this.flags.value;

    this.customlabel_categories = this.flags.categories || null;
    this.customlabel_language = this.flags.language || this.customlabel_language;
    this.customlabel_protected = this.flags.language || this.customlabel_protected;

    this.customlabel_shortdescription = this.flags.shortdescription;

    var customlabels_metadata: string = `<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
    <labels>
        <fullName>${this.customlabel_fullname}</fullName>${ (this.customlabel_categories != null) ? `\n<categories>${this.customlabel_categories}</categories>` : ''}
        <shortDescription>${this.customlabel_shortdescription}</shortDescription>
        <language>${this.customlabel_language}</language>
        <protected>${this.customlabel_protected.toString()}</protected>
        <value>${this.customlabel_value}</value>
    </labels>
</CustomLabels>`

    this.ux.log(customlabels_metadata);

    var package_xml: string = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>*</members>
        <name>CustomLabel</name>
    </types>
    <version>45.0</version>
</Package>`

    let targetmetadatapath = 'temp_sfpowerkit/mdapi/labels/CustomLabels.labels-meta.xml';
    fs.outputFileSync(targetmetadatapath, customlabels_metadata);
    let targetpackagepath = 'temp_sfpowerkit/mdapi/package.xml';
    fs.outputFileSync(targetpackagepath, package_xml);

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

    this.ux.log(`Deployed custom label: ${this.customlabel_fullname}`)

    await spawn('sfdx', args, {
      stdio: 'inherit'
    });

    rimraf.sync('temp_sfpowerkit');

    return {
      'customlabel.fullname': this.customlabel_fullname
    };
  }

}
