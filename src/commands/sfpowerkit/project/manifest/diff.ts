import { flags } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import * as fs from 'fs-extra';
import * as path from 'path';
import xmlUtil from '../../../../utils/xmlUtil';
import getDefaults from '../../../../utils/getDefaults';
import SFPowerkitCommand from '../../../../sfpowerkitCommand';
import { Messages } from '@salesforce/core';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'project_manifest_diff');

export default class Diff extends SFPowerkitCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerkit:project:manifest:diff -s source/package.xml -t target/package.xml -d output`,
    ];

    protected static flagsConfig = {
        sourcepath: flags.string({
            required: true,
            char: 's',
            description: messages.getMessage('sourcepathFlagDescription'),
        }),
        targetpath: flags.string({
            required: true,
            char: 't',
            description: messages.getMessage('targetpathFlagDescription'),
        }),
        output: flags.string({
            required: true,
            char: 'd',
            description: messages.getMessage('outputFlagDescription'),
        }),
        apiversion: flags.builtin({
            description: messages.getMessage('apiversion'),
        }),
        format: flags.enum({
            required: false,
            char: 'f',
            description: messages.getMessage('formatFlagDescription'),
            options: ['json', 'csv', 'xml'],
            default: 'json',
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

    protected output: any[];
    public async execute(): Promise<AnyJson> {
        this.flags.apiversion = this.flags.apiversion || getDefaults.getApiVersion();

        if (this.flags.json) {
            this.flags.format = 'json';
        }

        let sourceXml = await this.processMainfest(this.flags.sourcepath);
        let targetXml = await this.processMainfest(this.flags.targetpath);

        let itemsAddedInTarget = this.compareXML(sourceXml, targetXml);
        let itemsRemovedInTarget = this.compareXML(targetXml, sourceXml);

        this.output = [];
        if (itemsAddedInTarget || itemsRemovedInTarget) {
            this.addItemsToOutput(itemsAddedInTarget, 'Added in Target');
            this.addItemsToOutput(itemsRemovedInTarget, 'Removed in Target');

            this.output.sort(function (a, b) {
                if (a.type < b.type) {
                    return -1;
                } else if (a.type > b.type) {
                    return 1;
                }

                // names must be equal
                return 0;
            });

            if (this.flags.format === 'xml') {
                this.createpackagexml(itemsAddedInTarget);
            } else if (this.flags.format === 'csv') {
                this.generateCSVOutput(this.output);
            } else {
                fs.writeFileSync(`${this.flags.output}/package.json`, JSON.stringify(this.output));
            }
        }

        return this.output;
    }

    public async processMainfest(pathToManifest: string) {
        let output = new Map<string, string[]>();
        if (fs.existsSync(path.resolve(pathToManifest)) && path.extname(pathToManifest) == '.xml') {
            let package_xml = await xmlUtil.xmlToJSON(pathToManifest);
            let metadataTypes = package_xml.Package.types;
            if (metadataTypes.constructor === Array) {
                metadataTypes.forEach((type) => {
                    if (type.members !== '*') {
                        output.set(type.name, type.members.constructor === Array ? type.members : [type.members]);
                    }
                });
            } else {
                if (metadataTypes.members !== '*') {
                    output.set(
                        metadataTypes.name,
                        metadataTypes.members.constructor === Array ? metadataTypes.members : [metadataTypes.members]
                    );
                }
            }
        } else {
            throw new Error(`Error : ${pathToManifest} is not valid package.xml`);
        }
        return output;
    }
    compareXML(sourceXml: Map<string, string[]>, targetXml: Map<string, string[]>) {
        let metadataTypes = [];
        if (sourceXml && targetXml) {
            for (let key of targetXml.keys()) {
                if (sourceXml.has(key)) {
                    const diffout = this.getdiffList(sourceXml.get(key), targetXml.get(key));
                    if (diffout) {
                        metadataTypes.push({ name: key, members: diffout });
                    }
                } else {
                    metadataTypes.push({ name: key, members: targetXml.get(key) });
                }
            }
        }
        return metadataTypes;
    }
    getdiffList(from: string[], to: string[]) {
        let output = [];
        to.forEach((item) => {
            if (!from.includes(item)) {
                output.push(item);
            }
        });

        return output;
    }
    addItemsToOutput(itemsToProcess: any[], status: string) {
        itemsToProcess.forEach((metadataType) => {
            for (let item of metadataType.members) {
                this.output.push({
                    status: status,
                    type: metadataType.name,
                    member: item,
                });
            }
        });
    }
    createpackagexml(manifest: any[]) {
        let package_xml = {
            Package: {
                $: { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
                types: manifest,
                version: this.flags.apiversion,
            },
        };
        fs.outputFileSync(`${this.flags.output}/package.xml`, xmlUtil.jSONToXML(package_xml));
    }
    generateCSVOutput(output: any[]) {
        let newLine = '\r\n';
        let result = 'status,type,member' + newLine;
        output.forEach((element) => {
            result = `${result}${element.status},${element.type},${element.member}${newLine}`;
        });
        fs.writeFileSync(`${this.flags.output}/package.csv`, result);
    }
}
