import { flags } from '@salesforce/command';
import SFPowerkitCommand from '../../../../sfpowerkitCommand';
import { AnyJson } from '@salesforce/ts-types';
import * as fs from 'fs-extra';
import * as rimraf from 'rimraf';
import { zipDirectory } from '../../../../utils/zipDirectory';
import { AsyncResult, DeployResult } from 'jsforce';
import { checkDeploymentStatus } from '../../../../utils/checkDeploymentStatus';
import { Messages, SfdxError } from '@salesforce/core';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'connectedapp_create');

export default class Create extends SFPowerkitCommand {
    public connectedapp_consumerKey: string;
    public connectedapp_certificate: string;
    public connectedapp_label: string;
    public connectedapp_email: string;

    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerkit:org:connectedapp:create -u myOrg@example.com -n AzurePipelines -c id_rsa -e azlam.salamm@invalid.com
  Created Connected App AzurePipelines in Target Org
  `,
    ];

    protected static flagsConfig = {
        name: flags.string({
            required: true,
            char: 'n',
            description: messages.getMessage('nameFlagDescription'),
        }),
        pathtocertificate: flags.filepath({
            required: true,
            char: 'c',
            description: messages.getMessage('certificateFlagDescription'),
        }),
        email: flags.email({
            required: true,
            char: 'e',
            description: messages.getMessage('emailFlagDescription'),
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

    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    // protected static supportsDevhubUsername = true;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    //protected static requiresProject = true;

    public async execute(): Promise<AnyJson> {
        rimraf.sync('temp_sfpowerkit');

        await this.org.refreshAuth();

        //Connect to the org
        const conn = this.org.getConnection();
        const apiversion = await conn.retrieveMaxApiVersion();

        // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
        const pathToCertificate = this.flags.pathtocertificate.valueOf();
        this.connectedapp_email = this.flags.email;
        this.connectedapp_label = this.flags.name;

        let certificate = fs.readFileSync(pathToCertificate).toString();
        let textblock = certificate.split('\n');
        textblock.splice(0, 1);
        textblock.splice(-2, 1);
        certificate = textblock.join('\n');
        certificate = certificate.replace(/(\r\n|\n|\r)/gm, '');
        this.connectedapp_certificate = certificate;

        this.connectedapp_consumerKey = this.createConsumerKey();

        let connectedApp_metadata = `<?xml version="1.0" encoding="UTF-8"?>
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
     </ConnectedApp>`;

        let package_xml = `<?xml version="1.0" encoding="UTF-8"?>
     <Package xmlns="http://soap.sforce.com/2006/04/metadata">
         <types>
             <members>*</members>
             <name>ConnectedApp</name>
         </types>
         <version>${apiversion}</version>
     </Package>`;

        let targetmetadatapath =
            'temp_sfpowerkit/mdapi/connectedApps/' + this.connectedapp_label + '.connectedApp-meta.xml';
        fs.outputFileSync(targetmetadatapath, connectedApp_metadata);
        let targetpackagepath = 'temp_sfpowerkit/mdapi/package.xml';
        fs.outputFileSync(targetpackagepath, package_xml);

        const zipFile = 'temp_sfpowerkit/package.zip';
        await zipDirectory('temp_sfpowerkit/mdapi', zipFile);

        //Deploy Rule
        conn.metadata.pollTimeout = 300;
        let deployId: AsyncResult;

        const zipStream = fs.createReadStream(zipFile);
        await conn.metadata.deploy(zipStream, { rollbackOnError: true, singlePackage: true }, function (
            error,
            result: AsyncResult
        ) {
            if (error) {
                return console.error(error);
            }
            deployId = result;
        });

        this.ux.log(`Deploying Connected App with ID  ${deployId.id}  to ${this.org.getUsername()}`);
        let metadata_deploy_result: DeployResult = await checkDeploymentStatus(conn, deployId.id);

        if (!metadata_deploy_result.success)
            throw new SfdxError(
                `Unable to deploy the Connected App : ${metadata_deploy_result.details['componentFailures']['problem']}`
            );

        this.ux.log(`Connected App Deployed`);

        rimraf.sync('temp_sfpowerkit');

        return { 'connectedapp.consumerkey': this.connectedapp_consumerKey };
    }

    public createConsumerKey() {
        let text = '';
        let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.';

        for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }
}
