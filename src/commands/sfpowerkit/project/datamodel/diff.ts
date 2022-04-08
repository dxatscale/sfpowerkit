import { FlagsConfig, flags } from '@salesforce/command';
import { Sfpowerkit, LoggerLevel } from '../../../../sfpowerkit';
import SfpowerkitCommand from '../../../../sfpowerkitCommand';
import * as fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';
import { isNullOrUndefined } from 'util';
import DataModelSourceDiffImpl from '../../../../impl/project/metadata/DataModelSourceDiffImpl';
import * as path from 'path';
import FileUtils from '../../../../utils/fileutils';
import { AnyJson } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'project_datamodel_diff');

export default class Diff extends SfpowerkitCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerkit:project:datamodel:diff --revisionfrom revisionfrom --revisionto revisionto --csv`,
    ];

    protected static flagsConfig: FlagsConfig = {
        revisionfrom: flags.string({
            char: 'r',
            description: messages.getMessage('revisionFromDescription'),
            required: true,
        }),
        revisionto: flags.string({
            char: 't',
            description: messages.getMessage('revisionToDescription'),
            required: false,
            default: 'HEAD',
        }),
        packagedirectories: flags.string({
            required: false,
            char: 'p',
            description: messages.getMessage('packageDirectoriesDescription'),
        }),
        outputdir: flags.directory({
            required: false,
            char: 'd',
            description: messages.getMessage('outputDirDescription'),
        }),
        csv: flags.boolean({
            required: false,
            description: messages.getMessage('csvDescription'),
            default: false,
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

    protected static requiresUsername = false;
    protected static requiresProject = true;

    public async execute(): Promise<AnyJson> {
        let isOutputCSV = this.flags.csv;
        let outputDirectory = this.flags.outputdir ? this.flags.outputdir : process.cwd();

        let git: SimpleGit = simpleGit();

        const revisionFrom: string = await git.revparse(['--short', this.flags.revisionfrom]);
        const revisionTo: string = await git.revparse(['--short', this.flags.revisionto]);

        let packageDirectories: string[];

        if (!isNullOrUndefined(this.flags.packagedirectories)) {
            packageDirectories = this.flags.packagedirectories.split(',');
            packageDirectories = packageDirectories.map((dir) => {
                return dir.trim().toLocaleLowerCase();
            });

            let projectConfig = JSON.parse(fs.readFileSync('sfdx-project.json', 'utf8'));
            packageDirectories.forEach((dir) => {
                let isValidPackageDir: boolean;
                projectConfig['packageDirectories'].forEach((configPackageDir) => {
                    if (dir == configPackageDir['path'].toLocaleLowerCase()) isValidPackageDir = true;
                });
                if (!isValidPackageDir) throw new Error('Invalid package directory supplied');
            });
        }

        let dataModelSourceDiffImpl = new DataModelSourceDiffImpl(git, revisionFrom, revisionTo, packageDirectories);

        let sourceDiffResult = await dataModelSourceDiffImpl.exec();

        if (sourceDiffResult.length < 1) {
            Sfpowerkit.log(`No Datamodel change found between ${revisionFrom} and ${revisionTo}`, LoggerLevel.WARN);
            return sourceDiffResult;
        }

        Sfpowerkit.log(
            `Found ${sourceDiffResult.length} Datamodel change between ${revisionFrom} and ${revisionTo} \n`,
            LoggerLevel.INFO
        );

        let csvPath = `${outputDirectory}/datamodel-diff-output.json`;
        let dir = path.parse(csvPath).dir;
        if (!fs.existsSync(dir)) {
            FileUtils.mkDirByPathSync(dir);
        }
        fs.writeFileSync(csvPath, JSON.stringify(sourceDiffResult, null, 4));

        let rowsToDisplay = [];
        for (let file of sourceDiffResult) {
            for (let change of file['diff']) {
                rowsToDisplay.push({
                    object: file['object'],
                    api_name: file['api_name'],
                    type: file['type'],
                    operation: change['operation'],
                    coordinates: change['coordinates'],
                    from: change['before'],
                    to: change['after'],
                    filepath: file['filepath'],
                });
            }
        }

        if (isOutputCSV) {
            let csvOutput = `Object,API_Name,Type,Operation,Coordinates,Commit ID (${revisionFrom}),Commit ID (${revisionTo}),Filepath\n`;

            for (let row of rowsToDisplay) {
                let rowCells: string[] = Object.values(row);
                csvOutput = csvOutput + `${rowCells.toString()}\n`;
            }

            fs.writeFileSync(`${outputDirectory}/datamodel-diff-output.csv`, csvOutput);
        }

        this.ux.table(rowsToDisplay.slice(0, 50), [
            'object',
            'api_name',
            'type',
            'operation',
            'coordinates',
            'from',
            'to',
        ]);
        this.ux.log('\n');
        if (rowsToDisplay.length > 50) {
            Sfpowerkit.log('Displaying output limited to 50 rows', LoggerLevel.WARN);
        }

        Sfpowerkit.log(`JSON output written to ${outputDirectory}/datamodel-diff-output.json`, LoggerLevel.INFO);

        if (isOutputCSV) {
            Sfpowerkit.log(`CSV output written to ${outputDirectory}/datamodel-diff-output.csv`, LoggerLevel.INFO);
        }
        return sourceDiffResult;
    }
}
