import { flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { BuildConfig, Packagexml } from '../../../../impl/metadata/packageBuilder';
import { SFPowerkit, LoggerLevel } from '../../../../sfpowerkit';
import SFPowerkitCommand from '../../../../sfpowerkitCommand';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'package_build');

export default class Build extends SFPowerkitCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerkit:org:manifest:build --targetusername myOrg@example.com -o package.xml`,
        `$ sfdx sfpowerkit:org:manifest:build --targetusername myOrg@example.com -o package.xml -e 'ApexClass,CustomObject,Report'`,
        `$ sfdx sfpowerkit:org:manifest:build --targetusername myOrg@example.com -o package.xml -i 'ApexClass:sampleclass,CustomObject:Account'`,
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        quickfilter: flags.string({
            char: 'q',
            description: messages.getMessage('quickfilterFlagDescription'),
        }),
        excludefilter: flags.string({
            char: 'e',
            description: messages.getMessage('excludefilterFlagDescription'),
        }),
        includefilter: flags.string({
            char: 'i',
            description: messages.getMessage('includefilterFlagDescription'),
        }),
        excludemanaged: flags.boolean({
            char: 'x',
            description: messages.getMessage('excludeManagedFlagDescription'),
        }),
        includechilds: flags.boolean({
            char: 'c',
            description: messages.getMessage('includeChildsFlagDescription'),
        }),
        outputfile: flags.filepath({
            char: 'o',
            description: messages.getMessage('outputFileFlagDescription'),
        }),
    };

    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async execute(): Promise<AnyJson> {
        SFPowerkit.setLogLevel('Info', this.flags.json);

        if (this.flags.quickfilter) {
            SFPowerkit.log(
                `Flag -q| --quickfilter is deprecated, consider using -e| --excludefilter`,
                LoggerLevel.WARN
            );
        }

        if (this.flags.quickfilter && this.flags.excludefilter) {
            SFPowerkit.log(
                `Both -q| --quickfilter and -e| --excludefilter serves same purpose. since both flag is passed we will merge and consider for excluding filter`,
                LoggerLevel.WARN
            );
        }

        // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
        const apiversion = await this.org.getConnection().retrieveMaxApiVersion();
        const conn = this.org.getConnection();
        const configs: BuildConfig = new BuildConfig(this.flags, apiversion);
        const packageXML: Packagexml = new Packagexml(conn, configs);
        await packageXML.build();

        return { result: packageXML.result };
    }
}
