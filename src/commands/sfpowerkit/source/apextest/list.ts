import { AnyJson } from '@salesforce/ts-types';
import { existsSync } from 'fs';
import { flags } from '@salesforce/command';
import { Sfpowerkit, LoggerLevel } from '../../../../sfpowerkit';
import SFPowerkitCommand from '../../../../sfpowerkitCommand';
import { Messages, SfdxError } from '@salesforce/core';
import ApexTypeFetcher, { ApexSortedByType } from '../../../../impl/parser/ApexTypeFetcher';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'source_apextest_list');

export default class List extends SFPowerkitCommand {
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfdx sfpowerkit:source:apextest:list -p force-app`];

    protected static flagsConfig = {
        path: flags.string({
            required: true,
            char: 'p',
            description: messages.getMessage('pathFlagDescription'),
        }),
        resultasstring: flags.boolean({
            description: messages.getMessage('resultasstringDescription'),
            required: false,
        }),
        loglevel: flags.enum({
            description: messages.getMessage('loglevel'),
            default: 'info',
            required: false,
            options: [
                'trace',
                'debug',
                'info',
                'warn',
                'error',
                'fatal',
                'TRACE',
                'DEBUG',
                'INFO',
                'WARN',
                'ERROR',
                'FATAL',
            ],
        }),
    };

    public async execute(): Promise<AnyJson> {
        //set apex class directory
        if (!existsSync(this.flags.path)) {
            throw new SfdxError(`path ${this.flags.path} does not exist. you must provide a valid path.`);
        }

        let apexTypeFetcher: ApexTypeFetcher = new ApexTypeFetcher();
        let apexSortedByType: ApexSortedByType = apexTypeFetcher.getApexTypeOfClsFiles(this.flags.path);

        let testClasses = apexSortedByType['testClass'];
        let testClassesList = testClasses.map((cls) => cls.name);

        if (testClasses.length > 0) {
            Sfpowerkit.log(`Found ${testClasses.length} apex test classes in ${this.flags.path}`, LoggerLevel.INFO);
            if (this.flags.resultasstring) {
                this.ux.log(testClassesList.join(','));
            } else {
                this.ux.table(testClasses, ['name', 'filepath']);
            }
        } else {
            Sfpowerkit.log(`No apex test classes found in ${this.flags.path}`, LoggerLevel.INFO);
        }

        return this.flags.resultasstring ? testClassesList.join(',') : testClassesList;
    }
}
