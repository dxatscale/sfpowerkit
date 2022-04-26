import { AnyJson } from '@salesforce/ts-types';
import * as fs from 'fs-extra';
import { flags } from '@salesforce/command';
import SFPowerkitCommand from '../../../../sfpowerkitCommand';
import * as rimraf from 'rimraf';
import { AsyncResult, DeployResult, UpsertResult } from 'jsforce';
import { Messages, SfdxError } from '@salesforce/core';
import * as xml2js from 'xml2js';
import * as util from 'util';
// tslint:disable-next-line:ordered-imports
const path = require('path');
import { checkRetrievalStatus } from '../../../../utils/checkRetrievalStatus';
import { checkDeploymentStatus } from '../../../../utils/checkDeploymentStatus';
import { extract } from '../../../../utils/extract';
import { zipDirectory } from '../../../../utils/zipDirectory';
import { Sfpowerkit, LoggerLevel } from '../../../../sfpowerkit';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'duplicaterule_activate');

export default class Activate extends SFPowerkitCommand {
    public connectedapp_consumerKey: string;
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerkit:org:duplicaterule:Activate -n Account.CRM_Account_Rule_1 -u sandbox
    Polling for Retrieval Status
    Retrieved Duplicate Rule  with label : CRM Account Rule 2
    Preparing Activation
    Deploying Activated Rule with ID  0Af4Y000003OdTWSA0
    Polling for Deployment Status
    Polling for Deployment Status
    Duplicate Rule CRM Account Rule 2 Activated
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

    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    public async execute() {
        // rimraf.sync('temp_sfpowerkit');

        //Connect to the org
        await this.org.refreshAuth();
        const conn = this.org.getConnection();
        // const apiversion = await conn.retrieveMaxApiVersion();

        try {
            let duplicateRuleActivate = { fullName:'Account.Standard_Account_Duplicate_Rule' ,  isActive: true };
            let result: UpsertResult | UpsertResult[] = await conn.metadata.upsert('DuplicateRule', duplicateRuleActivate);
            console.log(result)
            if ((result as UpsertResult).success) {
                Sfpowerkit.log(`Duplicate Rule ${this.flags.name} Activated`, LoggerLevel.INFO);
            }
        } catch(error) {
            Sfpowerkit.log(`Duplicate Rule ${this.flags.name} not found in the Org`, LoggerLevel.INFO);
        }


        // let retrieveRequest = {
        //     apiVersion: apiversion,
        // };

        // //Retrieve Duplicate Rule
        // retrieveRequest['singlePackage'] = true;
        // retrieveRequest['unpackaged'] = {
        //     types: { name: 'DuplicateRule', members: this.flags.name },
        // };
        // conn.metadata.pollTimeout = 60;
        // let retrievedId;
        // await conn.metadata.retrieve(retrieveRequest, function (error, result: AsyncResult) {
        //     if (error) {
        //         return console.error(error);
        //     }
        //     retrievedId = result.id;
        // });

        // let metadata_retrieve_result = await checkRetrievalStatus(conn, retrievedId, !this.flags.json);
        // if (!metadata_retrieve_result.zipFile) throw new SfdxError('Unable to find the requested Duplicate Rule');

        // //Extract Duplicate Rule
        // const zipFileName = 'temp_sfpowerkit/unpackaged.zip';
        // fs.mkdirSync('temp_sfpowerkit');
        // fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, {
        //     encoding: 'base64',
        // });

        // await extract(`./temp_sfpowerkit/unpackaged.zip`, 'temp_sfpowerkit');
        // fs.unlinkSync(zipFileName);
        // let resultFile = `temp_sfpowerkit/duplicateRules/${this.flags.name}.duplicateRule`;

        // if (fs.existsSync(path.resolve(resultFile))) {
        //     const parser = new xml2js.Parser({ explicitArray: false });
        //     const parseString = util.promisify(parser.parseString);

        //     let retrieved_duplicaterule = await parseString(fs.readFileSync(path.resolve(resultFile)));

        //     this.ux.log(`Retrieved Duplicate Rule  with label : ${retrieved_duplicaterule.DuplicateRule.masterLabel}`);

        //     //Do Nothing if its already Active
        //     if (retrieved_duplicaterule.DuplicateRule.isActive === 'true') {
        //         this.ux.log('Already Active, exiting');
        //         return 1;
        //     }
        //     //Deactivate Rule
        //     this.ux.log(`Preparing Activation`);
        //     retrieved_duplicaterule.DuplicateRule.isActive = 'true';
        //     let builder = new xml2js.Builder();
        //     let xml = builder.buildObject(retrieved_duplicaterule);
        //     fs.writeFileSync(resultFile, xml);

        //     const zipFile = 'temp_sfpowerkit/package.zip';
        //     await zipDirectory('temp_sfpowerkit', zipFile);

        //     //Deploy Rule
        //     conn.metadata.pollTimeout = 300;
        //     let deployId: AsyncResult;

        //     const zipStream = fs.createReadStream(zipFile);
        //     await conn.metadata.deploy(
        //         zipStream,
        //         { rollbackOnError: true, singlePackage: true },
        //         function (error, result: AsyncResult) {
        //             if (error) {
        //                 return console.error(error);
        //             }
        //             deployId = result;
        //         }
        //     );

        //     this.ux.log(`Deploying Activated Rule with ID  ${deployId.id}  to ${this.org.getUsername()}`);
        //     let metadata_deploy_result: DeployResult = await checkDeploymentStatus(conn, deployId.id);

        //     if (!metadata_deploy_result.success)
        //         throw new SfdxError(
        //             `Unable to deploy the Activated rule : ${metadata_deploy_result.details['componentFailures']['problem']}`
        //         );

        //     this.ux.log(`Duplicate Rule ${retrieved_duplicaterule.DuplicateRule.masterLabel} Activated`);

        //     return 0;
        // } else {
        //     throw new SfdxError('Duplicate Rule not found in the org');
        // }
    }
}
