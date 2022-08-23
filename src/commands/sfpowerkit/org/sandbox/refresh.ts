import { flags } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
const request = require('request-promise-native');
import { Connection, Messages, SfdxError } from '@salesforce/core';
import { Sfpowerkit } from '../../../../sfpowerkit';
import SfpowerkitCommand from '../../../../sfpowerkitCommand';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'sandbox_refresh');

export default class Refresh extends SfpowerkitCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerkit:org:sandbox:refresh -n test2 -f sitSandbox -v myOrg@example.com`,
        `$ sfdx sfpowerkit:org:sandbox:refresh -n test2 -l DEVELOPER -v myOrg@example.com`,
    ];

    protected static flagsConfig = {
        name: flags.string({
            required: true,
            char: 'n',
            description: messages.getMessage('nameFlagDescription'),
        }),
        clonefrom: flags.string({
            required: false,
            char: 'f',
            default: '',
            description: messages.getMessage('cloneFromFlagDescripton'),
        }),
        licensetype: flags.string({
            required: false,
            char: 'l',
            options: ['DEVELOPER', 'DEVELOPER_PRO', 'PARTIAL', 'FULL'],
            description: messages.getMessage('licenseFlagDescription'),
        }),
    };

    // Comment this out if your command does not require a hub org username
    protected static requiresDevhubUsername = true;

    public async execute(): Promise<AnyJson> {
        Sfpowerkit.setLogLevel('INFO', false);

        await this.hubOrg.refreshAuth();

        const conn = this.hubOrg.getConnection();

        this.flags.apiversion = this.flags.apiversion || (await conn.retrieveMaxApiVersion());

        let result;

        const sandboxId = await this.getSandboxId(conn, this.flags.name);
        const uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/sobjects/SandboxInfo/${sandboxId}/`;

        if (this.flags.clonefrom) {
            const sourceSandboxId = await this.getSandboxId(conn, this.flags.clonefrom);

            result = await request({
                method: 'patch',
                url: uri,
                headers: {
                    Authorization: `Bearer ${conn.accessToken}`,
                },
                body: {
                    AutoActivate: 'true',
                    SourceId: `${sourceSandboxId}`,
                },
                json: true,
            });
        } else {
            if (!this.flags.licensetype) {
                throw new SfdxError(
                    'License type is required when clonefrom source org is not provided. you may need to provide -l | --licensetype'
                );
            }

            result = await request({
                method: 'patch',
                url: uri,
                headers: {
                    Authorization: `Bearer ${conn.accessToken}`,
                },
                body: {
                    AutoActivate: 'true',
                    LicenseType: `${this.flags.licensetype}`,
                },
                json: true,
            });
        }

        SFPLogger.log(`Successfully Enqueued Refresh of Sandbox`, LoggerLevel.INFO);

        return result;
    }

    public async getSandboxId(conn: Connection, name: string) {
        const query_uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/query?q=SELECT+Id,SandboxName+FROM+SandboxInfo+WHERE+SandboxName+in+('${name}')`;

        const sandbox_query_result = await request({
            method: 'get',
            url: query_uri,
            headers: {
                Authorization: `Bearer ${conn.accessToken}`,
            },
            json: true,
        });

        if (sandbox_query_result.records[0] == undefined)
            throw new SfdxError(`Unable to continue, Please check your sandbox name: ${name}`);

        this.ux.log();

        SFPLogger.log(
            `Fetched Sandbox Id for sandbox  ${name}  is ${sandbox_query_result.records[0].Id}`,
            LoggerLevel.INFO
        );

        return sandbox_query_result.records[0].Id;
    }
}
