import { AnyJson } from '@salesforce/ts-types';
import fs from 'fs-extra';
import { flags } from '@salesforce/command';
import rimraf = require('rimraf');
import { AsyncResult, DeployResult } from 'jsforce';
import { Messages, SfdxError } from '@salesforce/core';
// tslint:disable-next-line:ordered-imports
const path = require('path');
import { checkRetrievalStatus } from '../../../utils/checkRetrievalStatus';
import { checkDeploymentStatus } from '../../../utils/checkDeploymentStatus';
import { extract } from '../../../utils/extract';
import { Sfpowerkit, LoggerLevel } from '../../../sfpowerkit';
import SfpowerkitCommand from '../../../sfpowerkitCommand';
import FileUtils from '../../../utils/fileutils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'package_applypatch');

export default class Applypatch extends SfpowerkitCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfdx sfpowerkit:package:applypatch -n customer_picklist -u sandbox`];

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
    private folderPath: string;
    public async execute(): Promise<AnyJson> {
        this.folderPath = `temp_sfpowerkit_${FileUtils.makefolderid(5)}`;

        //Connect to the org
        await this.org.refreshAuth();
        const conn = this.org.getConnection();
        const apiversion = await conn.retrieveMaxApiVersion();

        let retrieveRequest = {
            apiVersion: apiversion,
        };

        //Retrieve Static  Resource
        retrieveRequest['singlePackage'] = true;
        retrieveRequest['unpackaged'] = {
            types: { name: 'StaticResource', members: this.flags.name },
        };
        conn.metadata.pollTimeout = 60;
        let retrievedId;
        await conn.metadata.retrieve(retrieveRequest, function (error, result: AsyncResult) {
            if (error) {
                return console.error(error);
            }
            retrievedId = result.id;
        });

        //Retrieve Patch
        let metadata_retrieve_result = await checkRetrievalStatus(conn, retrievedId, !this.flags.json);
        if (!metadata_retrieve_result.zipFile) throw new SfdxError('Unable to find the requested Static Resource');

        let zipFileName = `${this.folderPath}/unpackaged.zip`;
        fs.mkdirSync(this.folderPath);
        fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, {
            encoding: 'base64',
        });

        if (fs.existsSync(path.resolve(zipFileName))) {
            await extract(`./${this.folderPath}/unpackaged.zip`, this.folderPath);
            fs.unlinkSync(zipFileName);

            let resultFile = `${this.folderPath}/staticresources/${this.flags.name}.resource`;

            if (fs.existsSync(path.resolve(resultFile))) {
                Sfpowerkit.log(`Preparing Patch ${this.flags.name}`, LoggerLevel.INFO);
                fs.copyFileSync(resultFile, `${this.folderPath}/unpackaged.zip`);

                //Deploy patch using mdapi
                conn.metadata.pollTimeout = 300;
                let deployId: AsyncResult;

                let zipStream = fs.createReadStream(zipFileName);
                await conn.metadata.deploy(
                    zipStream,
                    { rollbackOnError: true, singlePackage: true },
                    function (error, result: AsyncResult) {
                        if (error) {
                            return console.error(error);
                        }
                        deployId = result;
                    }
                );

                Sfpowerkit.log(
                    `Deploying Patch with ID  ${deployId.id} to ${this.org.getUsername()}`,
                    LoggerLevel.INFO
                );
                let metadata_deploy_result: DeployResult = await checkDeploymentStatus(conn, deployId.id);

                if (!metadata_deploy_result.success) {
                    let componentFailures = metadata_deploy_result.details['componentFailures'];
                    throw new SfdxError(`Unable to deploy the Patch : ${JSON.stringify(componentFailures)}`);
                }

                Sfpowerkit.log(`Patch ${this.flags.name} Deployed successfully.`, LoggerLevel.INFO);
                rimraf.sync(this.folderPath);
                return 1;
            } else {
                Sfpowerkit.log(`Patch ${this.flags.name} not found in the org`, LoggerLevel.INFO);
                rimraf.sync(this.folderPath);
            }
        } else {
            Sfpowerkit.log(`Patch ${this.flags.name} not found in the org`, LoggerLevel.INFO);
            rimraf.sync(this.folderPath);
        }
    }
}
