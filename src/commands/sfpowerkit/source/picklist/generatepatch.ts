import { AnyJson } from '@salesforce/ts-types';
import fs from 'fs-extra';
import { flags } from '@salesforce/command';
import rimraf = require('rimraf');
import { Messages, SfdxProject } from '@salesforce/core';
import xml2js = require('xml2js');
import util = require('util');
import { getPackageInfo, getDefaultPackageInfo } from '../../../../utils/getPackageInfo';
import { searchFilesInDirectory } from '../../../../utils/searchFilesInDirectory';

import { zipDirectory } from '../../../../utils/zipDirectory';
import MetadataFiles from '../../../../impl/metadata/metadataFiles';
import { Sfpowerkit, LoggerLevel } from '../../../../sfpowerkit';
import FileUtils from '../../../../utils/fileutils';
import SFPowerkitCommand from '../../../../sfpowerkitCommand';

const path = require('path');
const glob = require('glob');
const spawn = require('child-process-promise').spawn;

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'source_picklist_generatepatch');

export default class Generatepatch extends SFPowerkitCommand {
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;
    private folderPath: string;
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfdx sfpowerkit:source:picklist:generatepatch -p sfpowerkit_test`];

    protected static flagsConfig = {
        package: flags.string({
            required: false,
            char: 'p',
            description: messages.getMessage('packageFlagDescription'),
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
        //clean any existing temp sf powerkit source folder
        this.folderPath = `temp_sfpowerkit_${FileUtils.makefolderid(5)}`;

        // Getting Project config
        const project = await SfdxProject.resolve();
        const projectJson = await project.retrieveSfdxProjectJson();

        //Retrieve the package
        let packageToBeUsed;
        if (this.flags.package) packageToBeUsed = getPackageInfo(projectJson, this.flags.package);
        else {
            packageToBeUsed = getDefaultPackageInfo(projectJson);
        }

        this.flags.apiversion = this.flags.apiversion || projectJson.get('sourceApiVersion');

        //set objects directory
        let objectsDirPaths = glob.sync(packageToBeUsed.path + '/**/objects', {
            absolute: false,
        });

        let picklistFields = [];
        if (objectsDirPaths.length > 0) {
            for (let objectsDirPath of objectsDirPaths) {
                let fieldsInPath = await this.generatePatchForCustomPicklistField(objectsDirPath);
                if (fieldsInPath.length > 0) {
                    picklistFields = picklistFields.concat(fieldsInPath);
                    await this.generatePatchForRecordTypes(objectsDirPath);
                }
            }
        }

        if (picklistFields.length > 0) {
            await this.generateStaticResource(packageToBeUsed);
        }

        //clean temp sf powerkit source folder
        rimraf.sync(this.folderPath);
        return picklistFields;
    }

    private async generatePatchForCustomPicklistField(objectsDirPath: string) {
        let result = [];
        Sfpowerkit.log(`Scanning for picklist fields in ${objectsDirPath}`, LoggerLevel.INFO);

        //search picklist
        let customFieldsWithPicklist: any[] = searchFilesInDirectory(objectsDirPath, '<type>Picklist</type>', '.xml');

        //search MultiselectPicklist
        let customFieldsWithMultiPicklist: any[] = searchFilesInDirectory(
            objectsDirPath,
            '<type>MultiselectPicklist</type>',
            '.xml'
        );

        if (customFieldsWithMultiPicklist && customFieldsWithMultiPicklist.length > 0) {
            customFieldsWithPicklist = customFieldsWithPicklist.concat(customFieldsWithMultiPicklist);
        }

        if (customFieldsWithPicklist && customFieldsWithPicklist.length > 0) {
            Sfpowerkit.log(
                `Found ${customFieldsWithPicklist.length} picklist fields in ${objectsDirPath}`,
                LoggerLevel.INFO
            );

            Sfpowerkit.log(
                `Processing and adding the following fields to patch in ${objectsDirPath}`,
                LoggerLevel.DEBUG
            );

            for (const file of customFieldsWithPicklist) {
                const parser = new xml2js.Parser({
                    explicitArray: false,
                });
                const parseString = util.promisify(parser.parseString);
                let field_metadata;
                try {
                    field_metadata = await parseString(fs.readFileSync(path.resolve(file)));
                } catch (e) {
                    Sfpowerkit.log(`Unable to parse file ${file} due to ${e}`, LoggerLevel.FATAL);
                    return Promise.reject(e);
                }

                if (field_metadata.CustomField.valueSet && !field_metadata.CustomField.fieldManageability) {
                    result.push(file);
                    Sfpowerkit.log(`Copied Original to Patch: ${file}`, LoggerLevel.INFO);
                    MetadataFiles.copyFile(file, this.folderPath);
                }
            }
            Sfpowerkit.log(
                `Added ${result.length} picklist fields into patch from ${objectsDirPath}`,
                LoggerLevel.INFO
            );
        } else {
            Sfpowerkit.log(`No picklist fields found in ${objectsDirPath}`, LoggerLevel.INFO);
        }
        Sfpowerkit.log(
            '--------------------------------------------------------------------------------',
            LoggerLevel.INFO
        );
        return result;
    }
    private async generatePatchForRecordTypes(objectsDirPath: string): Promise<boolean> {
        Sfpowerkit.log(`Scanning for recordtypes in ${objectsDirPath}`, LoggerLevel.INFO);
        let recordTypes: any[] = searchFilesInDirectory(
            objectsDirPath,
            '<RecordType xmlns="http://soap.sforce.com/2006/04/metadata">',
            '.xml'
        );

        if (recordTypes && recordTypes.length > 0) {
            Sfpowerkit.log(`Found ${recordTypes.length} RecordTypes in ${objectsDirPath}`, LoggerLevel.INFO);

            Sfpowerkit.log(
                `Processing and adding the following recordtypes to patch in ${objectsDirPath}`,
                LoggerLevel.INFO
            );

            for (const file of recordTypes) {
                Sfpowerkit.log(`Copied Original to Patch: ${file}`, LoggerLevel.INFO);
                MetadataFiles.copyFile(file, this.folderPath);
            }
        }
        Sfpowerkit.log(
            '--------------------------------------------------------------------------------',
            LoggerLevel.INFO
        );
        return true;
    }

    private async generateStaticResource(packageToBeUsed: any) {
        // sfdx project json file running force source command
        let sfdx_project_json = `{	
      "packageDirectories": [	
        {	
          "path": "${packageToBeUsed.path}",	
          "default": true	
        }	
      ],	
      "namespace": "",	
      "sourceApiVersion": "${this.flags.apiversion}"	
    }`;

        fs.outputFileSync(`${this.folderPath}/sfdx-project.json`, sfdx_project_json);

        if (fs.existsSync(path.resolve(`${this.folderPath}/${packageToBeUsed.path}`))) {
            //Convert to mdapi
            const args = [];
            args.push('force:source:convert');
            args.push('-r');
            args.push(`${packageToBeUsed.path}`);
            args.push('-d');
            args.push(`mdapi`);

            await spawn('sfdx', args, {
                stdio: 'ignore',
                cwd: this.folderPath,
            });

            //Generate zip file
            let zipFile = `${this.folderPath}/${packageToBeUsed.package}_picklist.zip`;
            await zipDirectory(`${this.folderPath}/mdapi`, zipFile);

            //Create Static Resource Directory if not exist
            let dir = packageToBeUsed.path + `/main/default/staticresources/`;
            if (!fs.existsSync(dir)) {
                fs.mkdirpSync(dir);
            }
            fs.copyFileSync(zipFile, `${dir}${packageToBeUsed.package}_picklist.zip`);

            //Store it to static resources
            const metadata = `<?xml version="1.0" encoding="UTF-8"?>	
      <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">	
          <cacheControl>Public</cacheControl>	
          <contentType>application/zip</contentType>	
      </StaticResource>`;
            let targetmetadatapath = `${dir}${packageToBeUsed.package}_picklist.resource-meta.xml`;

            Sfpowerkit.log(`Generating static resource file : ${targetmetadatapath}`, LoggerLevel.INFO);

            fs.outputFileSync(targetmetadatapath, metadata);

            Sfpowerkit.log(`Patch ${packageToBeUsed.package}_picklist generated successfully.`, LoggerLevel.INFO);
        } else {
            Sfpowerkit.log(`No picklist fields found in package ${packageToBeUsed.package}`, LoggerLevel.WARN);
        }
    }
}
