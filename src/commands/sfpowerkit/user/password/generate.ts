import { flags } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import { Sfpowerkit, LoggerLevel } from '../../../../sfpowerkit';
import Passwordgenerateimpl from '../../../../impl/user/passwordgenerateimpl';
import { SfdxError } from '@salesforce/core';
import SFPowerkitCommand from '../../../../sfpowerkitCommand';

export default class Generate extends SFPowerkitCommand {
    public static description = 'Generates password for a given user in a salesforce org.';

    public static examples = [`$ sfdx sfpowerkit:user:password:generate -u sandbox1`];

    protected static flagsConfig = {
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
    // Comment this out if your command does not require a hub org username
    protected static requiresUsername = true;

    public async execute(): Promise<AnyJson> {
        //Connect to the org
        await this.org.refreshAuth();
        const userName = this.org.getUsername();

        let result = await Passwordgenerateimpl.run(userName);

        if (!result.password) {
            throw new SfdxError(`Error occured unable to set password at the moment, please try later.`);
        }

        Sfpowerkit.log(`Password successfully set for ${result.username} : ${result.password}`, LoggerLevel.INFO);

        return result;
    }
}
