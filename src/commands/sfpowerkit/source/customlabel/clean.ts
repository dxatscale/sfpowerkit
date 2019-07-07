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
var path = require('path');

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfpowerkit', 'source_customlabel_clean');


export default class Clean extends SfdxCommand {

  public customlabel_path: string;
  public customlabel_cleanstatus: boolean = false;

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx  sfpowerkit:source:customlabel:clean -p path/to/customlabelfile.xml
    Cleaned The Custom Labels
`
  ];


  protected static flagsConfig = {

    path: flags.string({
      required: true,
      char: 'p',
      description: messages.getMessage('pathFlagDescription')
    })

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

    this.customlabel_path = this.flags.path;

    if (fs.existsSync(path.resolve(this.customlabel_path)) && path.extName(this.customlabel_path) == '.xml') {

      const parser = new xml2js.Parser({ explicitArray: false });
      const parseString = util.promisify(parser.parseString);

      let retrieved_customlabels = await parseString(fs.readFileSync(path.resolve(this.customlabel_path)));

      if (!Object.keys(retrieved_customlabels).includes('CustomLabels')) {

        this.ux.log(`Metadata Mismatch: Not A CustomLabels Metadata File`);

        rimraf.sync('temp_sfpowerkit');

        return {
          'customlabel.clean_status': this.customlabel_cleanstatus
        };

      }

      console.log(`Namespace ::: ${orgShortName}_`);

      if (this.isIterable(retrieved_customlabels.CustomLabels.labels)) {

        for (var label of retrieved_customlabels.CustomLabels.labels) {

          label.fullName = label.fullName.replace(`${orgShortName}_`,"");
  
        }

      } else {

        retrieved_customlabels.CustomLabels.labels.fullName = retrieved_customlabels.CustomLabels.labels.fullName.replace(`${orgShortName}_`,"");

      }

      var builder = new xml2js.Builder({xmldec:{'version': '1.0', 'encoding': 'UTF-8'}});
      var xml = builder.buildObject(retrieved_customlabels);

      await fs.writeFileSync(path.resolve(this.customlabel_path),xml);

      this.ux.log(`Cleaned The Custom Labels`);

      this.customlabel_cleanstatus = true;

    } else {

      this.ux.log(`File is either not found, or not an xml file.`);

    }

    rimraf.sync('temp_sfpowerkit');

    return {
      'customlabel.clean_status': this.customlabel_cleanstatus
    };
  }

  isIterable(obj) {
    if (obj == null) {
      return false;
    }
    return typeof obj[Symbol.iterator] === 'function';
  }

}
