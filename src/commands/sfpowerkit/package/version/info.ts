import { flags } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import { Sfpowerkit } from '../../../../sfpowerkit';
import PackageInfo from '../../../../impl/package/version/packageInfo';
import SFPowerkitCommand from '../../../../sfpowerkitCommand';
import { Messages } from '@salesforce/core';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'package_info');

export default class Info extends SFPowerkitCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfdx sfpowerkit:package:version:info -u myOrg@example.com `];

    protected static flagsConfig = {
        apiversion: flags.builtin({
            description: messages.getMessage('apiversion'),
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

    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
    public static readonly supportsDevhubUsername = true;
    public async execute(): Promise<AnyJson> {
        Sfpowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

        await this.org.refreshAuth();

        const conn = this.org.getConnection();

        this.flags.apiversion = this.flags.apiversion || (await conn.retrieveMaxApiVersion());

        let packageInfoImpl: PackageInfo = new PackageInfo(conn, this.flags.apiversion, this.flags.json);

        let result = (await packageInfoImpl.getPackages()) as any;

        result.sort((a, b) => (a.packageName > b.packageName ? 1 : -1));

        if (this.hubOrg) {
            result = (await packageInfoImpl.getPackagesDetailsfromDevHub(this.hubOrg.getConnection(), result)) as any;
        }

        this.ux.table(result, [
            'packageName',
            'type',
            'IsOrgDependent',
            'packageNamespacePrefix',
            'packageVersionNumber',
            'packageVersionId',
            'allowedLicenses',
            'usedLicenses',
            'expirationDate',
            'status',
            'CodeCoverage',
            'codeCoverageCheckPassed',
            'validationSkipped',
        ]);
        return result;
    }
}
