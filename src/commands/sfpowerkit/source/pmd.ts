import { FlagsConfig, flags } from '@salesforce/command';
import { spawnSync } from 'child_process';
import FileUtils from '../../../utils/fileutils';
import { extract } from '../../../utils/extract';
import { SfdxError, Logger, SfdxProject, Messages } from '@salesforce/core';
import SFPowerkitCommand from '../../../sfpowerkitCommand';

const request = require('request');
const fs = require('fs');
const path = require('path');
const findJavaHome = require('find-java-home');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'source_pmd');

export default class Pmd extends SFPowerkitCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfdx sfpowerkit:source:pmd`];
    protected static flagsConfig: FlagsConfig = {
        directory: flags.directory({
            required: false,
            char: 'd',
            description: messages.getMessage('directoryFlagDescription'),
            exclusive: ['filelist'],
        }),

        ruleset: flags.string({
            required: false,
            char: 'r',
            description: messages.getMessage('rulesetFlagDescription'),
            exclusive: ['rulesets'],
        }),

        rulesets: flags.string({
            required: false,
            char: 'R',
            description: messages.getMessage('rulesetsFlagDescription'),
            exclusive: ['ruleset'],
        }),

        format: flags.string({
            required: false,
            char: 'f',
            default: 'text',
            description: messages.getMessage('formatFlagDescription'),
        }),

        filelist: flags.filepath({
            required: false,
            description: messages.getMessage('filelistFlagDescription'),
            exclusive: ['directory'],
        }),

        report: flags.filepath({
            required: false,
            description: messages.getMessage('reportFlagDescription'),
            exclusive: ['reportfile'],
        }),

        reportfile: flags.filepath({
            required: false,
            char: 'o',
            description: messages.getMessage('reportfileFlagDescription'),
            exclusive: ['report'],
        }),

        javahome: flags.string({
            required: false,
            description: messages.getMessage('javaHomeFlagDescription'),
        }),

        failonviolation: flags.boolean({
            required: false,
            description: messages.getMessage('failonviolationFlagDescription'),
            default: true,
            allowNo: true,
        }),

        minimumpriority: flags.integer({
            required: false,
            description: messages.getMessage('minimumpriorityFlagDescription'),
        }),

        shortnames: flags.boolean({
            required: false,
            description: messages.getMessage('shortnamesFlagDescription'),
            default: false,
            allowNo: true,
        }),

        showsuppressed: flags.boolean({
            required: false,
            description: messages.getMessage('showsuppressedFlagDescription'),
            default: false,
            allowNo: true,
        }),

        suppressmarker: flags.string({
            required: false,
            description: messages.getMessage('suppressmarkerFlagDescription'),
        }),

        version: flags.string({
            required: false,
            default: '6.39.0',
            description: messages.getMessage('versionFlagDescription'),
        }),
        loglevel: flags.enum({
            description: 'loglevel to execute the command',
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

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    // protected static requiresProject = true;

    protected initLoggerAndUx(): Promise<void> {
        this.logger = new Logger({
            name: this.statics.name,
            streams: [
                {
                    stream: process.stderr,
                    level: Logger.getRoot().getLevel(),
                },
            ],
        });
        return super.initLoggerAndUx();
    }

    public async execute(): Promise<any> {
        // setup result display
        this.result.display = function () {
            if (typeof this.data === 'string') {
                process.stdout.write(this.data);
            } else {
                process.stdout.write(JSON.stringify(this.data, null, 2));
            }
        };

        //Download PMD
        const cacheDirectory = FileUtils.getGlobalCacheDir();
        const pmdCacheDirectory = path.join(cacheDirectory, 'pmd');
        const pmdHome = path.join(pmdCacheDirectory, `pmd-bin-${this.flags.version}`);

        if (!fs.existsSync(pmdHome)) {
            this.logger.info(`Initiating Download of PMD version ${this.flags.version}`);
            if (!fs.existsSync(pmdCacheDirectory)) fs.mkdirSync(pmdCacheDirectory);
            await this.downloadPMD(this.flags.version, pmdCacheDirectory);
            this.logger.info(`Downloaded PMD ${this.flags.version}`);
            await extract(path.join(pmdCacheDirectory, 'pmd.zip'), pmdCacheDirectory);
            this.logger.info(`Extracted PMD ${this.flags.version}`);
        }

        this.logger.info(`Using PMD release ${this.flags.version}`);

        const javaHome = await this.getJavaHome();
        this.logger.info(`Java Home set to "${javaHome}"`);

        const pmdOptions = await this.commandOptions(pmdHome);
        this.logger.debug(`PMD command line: ${pmdOptions.join(' ')}`);

        const pmdCmd = spawnSync(path.join(javaHome, 'bin', 'java'), pmdOptions);

        if (pmdCmd.status === null) {
            if (pmdCmd.signal) {
                // PMD was interrupted by a signal
                const err = new SfdxError(`PMD was interrupted by signal "${pmdCmd.signal}"`);
                err.exitCode = 255;
                throw err;
            }

            const err = new SfdxError(`Could not run PMD: "${pmdCmd.error}"`);
            err.exitCode = 1;
            throw err;
        }

        if (pmdCmd.status === 1) {
            const err = new SfdxError(pmdCmd.stderr.toString());
            err.exitCode = 1;
            throw err;
        }

        process.exitCode = pmdCmd.status;

        if (this.flags.format === 'json' || this.flags.format === 'sarif') {
            try {
                // try to return an object instead of a plain string
                return JSON.parse(pmdCmd.stdout.toString());
            } catch (_) {
                return pmdCmd.stdout.toString();
            }
        }

        return pmdCmd.stdout.toString();
    }

    /**
     * Return the rulests to be used by PMD.
     * Substitute the "sfpowerkit" ruleset with the path
     * to the ruleset file. The other rulesets are unchanged.
     * If the given rulesets param is empty, return the sfpowerkit
     * ruleset path.
     *
     * Since rulesets can also be found in PMD's classpath,
     * we let PMD validate the ruleset.
     *
     * @param rulesets the selected rulesets
     * @return the updated ruleset string
     *
     */
    private rulesets(): string {
        // handle ruleset flag deprecation
        if (this.flags.ruleset && !this.flags.rulesets) {
            this.ux.warn(
                '--ruleset has been deprecated and will be removed in a future version. Use --rulesets instead.'
            );
            this.flags.rulesets = this.flags.ruleset;
        } // end: handle ruleset flag deprecation

        //Default Ruleset
        const sfpowerkitRuleSet = path.join(__dirname, '..', '..', '..', '..', 'resources', 'pmd-ruleset.xml');

        if (!this.flags.rulesets) {
            return sfpowerkitRuleSet;
        }

        const rules = this.flags.rulesets.split(',');
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (rule.toLowerCase() === 'sfpowerkit') {
                rules[i] = sfpowerkitRuleSet;
            }
        }
        return rules.join(',');
    }

    /**
     * Returns the java home path.
     * If the flag `--javahome` was provided,
     * its value is returned. Otherwise this method
     * call "findJavaHome"
     *
     * @return the Java home path
     */
    private getJavaHome(): Promise<string> {
        if (this.flags.javahome) {
            return Promise.resolve(this.flags.javahome);
        }

        return new Promise<string>((resolve, reject): void => {
            findJavaHome({ allowJre: true }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    private downloadPMD(pmdVersion: string, cacheDirectory: any): Promise<void> {
        let file = fs.createWriteStream(path.join(cacheDirectory, 'pmd.zip'));

        return new Promise((resolve, reject) => {
            request({
                uri: `https://github.com/pmd/pmd/releases/download/pmd_releases%2F${pmdVersion}/pmd-bin-${pmdVersion}.zip`,
            })
                .pipe(file)
                .on('finish', () => {
                    resolve();
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    /**
     * returns the full path of the default package.
     *
     * @returns the full path of the default package
     */
    private async getDefaultPackagePath(): Promise<string> {
        if (!this.project) {
            this.project = await SfdxProject.resolve();
        }
        return this.project.getDefaultPackage().fullPath;
    }

    /**
     * Returns the PMD command line options which matches this
     * command flags.
     *
     * @param pmdHome PMD install dir path
     * @return the PMD command line options
     */
    private async commandOptions(pmdHome: string): Promise<string[]> {
        const pmdClassPath = path.join(pmdHome, 'lib', '*');

        const pmdOptions = [
            '-classpath',
            pmdClassPath,
            'net.sourceforge.pmd.PMD',
            '-language',
            'apex',
            '-rulesets',
            this.rulesets(),
            '-format',
            this.flags.format,
            '-failOnViolation',
            this.flags.failonviolation ? 'true' : 'false',
        ];

        if (this.flags.reportfile) {
            pmdOptions.push('-reportfile');
            pmdOptions.push(this.flags.reportfile);
        } else if (this.flags.report) {
            this.ux.warn('--report is deprecated and will be removed in a future version. User --reportfile instead');
            pmdOptions.push('-reportfile');
            pmdOptions.push(this.flags.report);
        }

        if (!this.flags.filelist && !this.flags.directory) {
            // use default package dir
            pmdOptions.push('-dir');
            pmdOptions.push(await this.getDefaultPackagePath());
        } else if (this.flags.filelist) {
            pmdOptions.push('-filelist');
            pmdOptions.push(this.flags.filelist);
        } else if (this.flags.directory) {
            pmdOptions.push('-dir');
            pmdOptions.push(this.flags.directory);
        }

        if (this.flags.minimumpriority) {
            pmdOptions.push('-minimumpriority');
            pmdOptions.push(this.flags.minimumpriority);
        }

        if (this.flags.shortnames) {
            pmdOptions.push('-shortnames');
        }

        if (this.flags.showsuppressed) {
            pmdOptions.push('-showsuppressed');
        }

        if (this.flags.suppressmarker) {
            pmdOptions.push('-suppressmarker');
            pmdOptions.push(this.flags.suppressmarker);
        }

        return pmdOptions;
    }
}
