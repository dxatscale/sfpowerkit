import { AnyJson } from '@salesforce/ts-types';
import * as fs from 'fs-extra';
import { flags } from '@salesforce/command';
import SFPowerkitCommand from '../../../../sfpowerkitCommand';
import * as rimraf from 'rimraf';
import { SfdxError, LoggerLevel, Messages } from '@salesforce/core';
import * as xml2js from 'xml2js';
import * as util from 'util';
const fg = require('fast-glob');
import { SFPowerkit } from '../../../../sfpowerkit';
const path = require('path');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'apextestsuite_convert');

export default class Convert extends SFPowerkitCommand {
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerkit:source:apextestsuite:convert -n MyApexTestSuite 
    "ABC2,ABC1Test"    
  `,
    ];

    protected static flagsConfig = {
        name: flags.string({
            required: true,
            char: 'n',
            description: messages.getMessage('nameFlagDescription'),
        }),
        loglevel: flags.enum({
            description: 'logging level for this command invocation',
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
        rimraf.sync('temp_sfpowerkit');

        const entries = fg.sync(`**${this.flags.name}.testSuite-meta.xml`, {
            onlyFiles: true,
            absolute: true,
            baseNameMatch: true,
        });

        if (!entries[0]) throw new SfdxError(`Apex Test Suite ${this.flags.name} not found`);

        SFPowerkit.log(`Apex Test Suite File Path ${entries[0]}`, LoggerLevel.DEBUG);

        if (fs.existsSync(path.resolve(entries[0]))) {
            const parser = new xml2js.Parser({ explicitArray: false });
            const parseString = util.promisify(parser.parseString);

            let apex_test_suite = await parseString(fs.readFileSync(path.resolve(entries[0])));

            let testclasses;
            const doublequote = '"';
            if (apex_test_suite.ApexTestSuite.testClassName.constructor === Array) {
                testclasses = doublequote + apex_test_suite.ApexTestSuite.testClassName.join() + doublequote;
            } else {
                testclasses = doublequote + apex_test_suite.ApexTestSuite.testClassName + doublequote;
            }

            this.ux.log(testclasses);

            return testclasses;
        } else {
            throw new SfdxError('Apex Test Suite not found');
        }
    }
}
