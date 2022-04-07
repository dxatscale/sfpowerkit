import { flags } from '@salesforce/command';
import SfpowerkitCommand from '../../../../sfpowerkitCommand';
import { SfdxError, Messages } from '@salesforce/core';
import DependencyImpl from '../../../../impl/dependency/dependencyImpl';
import MetadataSummaryInfoFetcher, {
    MetadataSummary,
} from '../../../../impl/metadata/retriever/metadataSummaryInfoFetcher';
import * as path from 'path';
import { Sfpowerkit, LoggerLevel } from '../../../../sfpowerkit';
import * as fs from 'fs-extra';
import FileUtils from '../../../../utils/fileutils';
import * as rimraf from 'rimraf';
import PackageInfo from '../../../../impl/package/version/packageInfo';
import GetDefaults from '../../../../utils/getDefaults';
import { ProgressBar } from '../../../../ui/progressBar';
import { PackageDetail } from '../../../../utils/packageUtils';
import { Connection } from 'jsforce';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfpowerkit', 'dependency_tree_package');

export default class Tree extends SfpowerkitCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        '$ sfdx sfpowerkit:dependency:tree:package -u MyScratchOrg -n 04txxxxxxxxxx -o outputdir -f json',
        '$ sfdx sfpowerkit:dependency:tree:package -u MyScratchOrg -n 04txxxxxxxxxx -o outputdir -f csv',
        '$ sfdx sfpowerkit:dependency:tree:package -u MyScratchOrg -n 04txxxxxxxxxx -o outputdir -f csv -p',
        '$ sfdx sfpowerkit:dependency:tree:package -u MyScratchOrg -n 04txxxxxxxxxx -o outputdir -f csv -s',
    ];

    protected static flagsConfig = {
        package: flags.string({
            char: 'n',
            required: true,
            description: messages.getMessage('packageDescription'),
        }),
        packagefilter: flags.boolean({
            description: messages.getMessage('packagefilterDescription'),
            char: 'p',
            required: false,
        }),
        showall: flags.boolean({
            char: 's',
            description: messages.getMessage('showallDescription'),
            required: false,
        }),
        format: flags.enum({
            required: false,
            char: 'f',
            description: messages.getMessage('formatDescription'),
            options: ['json', 'csv'],
            default: 'json',
        }),
        output: flags.string({
            char: 'o',
            description: messages.getMessage('outputDescription'),
            required: true,
        }),
        loglevel: flags.enum({
            description: messages.getMessage('loglevelDescription'),
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
    protected conn: Connection;
    protected installedPackagesMap: Map<string, PackageDetail>;
    protected dependencyMap: Map<string, string[]>;
    protected metadataMap: Map<string, MetadataSummary>;
    protected output: any[];

    public async execute(): Promise<any> {
        this.conn = this.org.getConnection();

        this.output = [];

        //Fetch Package Details from an Org
        try {
            let packageDetails: PackageDetail[] = await new PackageInfo(
                this.conn,
                GetDefaults.getApiVersion(),
                false
            ).getPackages();

            this.installedPackagesMap = new Map(packageDetails.map((obj) => [obj.subcriberPackageId, obj]));
        } catch (error) {
            throw new SfdxError('Unable to retrieve details about packages in the org');
        }

        //Find Requested Package
        let requestPackage: PackageDetail;
        for (let pkg of this.installedPackagesMap.values()) {
            if (
                pkg.subcriberPackageId === this.flags.package ||
                pkg.packageName === this.flags.package ||
                pkg.packageVersionId === this.flags.package
            ) {
                requestPackage = pkg;
                break;
            }
        }

        Sfpowerkit.log('Requested Package Info:' + JSON.stringify(requestPackage), LoggerLevel.TRACE);

        if (!requestPackage) {
            throw new SfdxError(`Unable to find the package ${this.flags.package} in ${this.org.getUsername()} org.`);
        }

        Sfpowerkit.log(
            `Fetching all components details of ${requestPackage.packageName} package from the org`,
            LoggerLevel.INFO
        );

        let packageMembers: string[] = await DependencyImpl.getMemberFromPackage(
            this.conn,
            requestPackage.subcriberPackageId
        );

        Sfpowerkit.log('Package Member Info:' + JSON.stringify(packageMembers), LoggerLevel.TRACE);

        Sfpowerkit.log(
            `Found ${packageMembers.length} components from ${requestPackage.packageName} package`,
            LoggerLevel.INFO
        );

        let dependencyResult = await DependencyImpl.getDependencyMapById(this.conn, packageMembers);

        this.dependencyMap = dependencyResult.dependencyMap;
        this.metadataMap = dependencyResult.dependencyDetailsMap;

        Sfpowerkit.log(`Found ${this.dependencyMap.size} components having dependency`, LoggerLevel.INFO);

        let result = await MetadataSummaryInfoFetcher.fetchMetadataSummaryFromAnOrg(this.conn);

        for (let metaObj of result.keys()) this.metadataMap.set(metaObj, result.get(metaObj));

        let membersWithoutDependency = packageMembers.filter((x) => !Array.from(this.dependencyMap.keys()).includes(x));
        await this.getDetailsFromId(this.flags.packagefilter, membersWithoutDependency);
        if (this.flags.format === 'json') {
            await this.generateJsonOutput(this.output, this.flags.output);
        } else {
            await this.generateCSVOutput(this.output, this.flags.output);
        }

        return this.output;
    }

    private async getDetailsFromId(packagefilter: boolean, membersWithoutDependency: string[]) {
        let pkgMemberMap: Map<string, string> = await DependencyImpl.getMemberVsPackageMap(this.conn);
        let result = [];

        let progressBar = new ProgressBar().create(`Computing the dependency tree`, ` items`, LoggerLevel.INFO);

        progressBar.start(
            this.flags.showall ? this.dependencyMap.size + membersWithoutDependency.length : this.dependencyMap.size
        );
        //items having dependency
        for (let member of this.dependencyMap.keys()) {
            let currentItem: any = JSON.parse(
                JSON.stringify(
                    this.metadataMap.has(member)
                        ? this.metadataMap.get(member)
                        : { id: member, fullName: 'unknown', type: 'unknown' }
                )
            );
            if (!packagefilter) {
                currentItem.dependentMetadata = [];
            } else {
                currentItem.dependentPackage = [];
            }

            for (let dependent of this.dependencyMap.get(member)) {
                let dependentItem: any = JSON.parse(
                    JSON.stringify(
                        this.metadataMap.has(dependent)
                            ? this.metadataMap.get(dependent)
                            : { id: dependent, fullName: 'unknown', type: 'unknown' }
                    )
                );

                dependentItem.package = pkgMemberMap.has(dependent)
                    ? this.installedPackagesMap.get(pkgMemberMap.get(dependent)).packageName
                    : 'Org';
                if (packagefilter && !currentItem.dependentPackage.includes(dependentItem.package)) {
                    currentItem.dependentPackage.push(dependentItem.package);
                }
                if (!packagefilter) {
                    currentItem.dependentMetadata.push(dependentItem);
                }
            }
            progressBar.increment(1);
            result.push(currentItem);
        }

        if (this.flags.showall) {
            //items with dependency
            membersWithoutDependency.forEach((member) => {
                let currentItem: any = JSON.parse(
                    JSON.stringify(
                        this.metadataMap.has(member)
                            ? this.metadataMap.get(member)
                            : { id: member, fullName: 'unknown', type: 'unknown' }
                    )
                );
                if (!packagefilter) {
                    currentItem.dependentMetadata = [];
                } else {
                    currentItem.dependentPackage = [];
                }
                progressBar.increment(1);
                result.push(currentItem);
            });
        }
        progressBar.stop();
        this.output = result;
    }

    private async generateJsonOutput(result: any[], outputDir: string) {
        let outputJsonPath = `${outputDir}/output.json`;
        rimraf.sync(outputJsonPath);
        let dir = path.parse(outputJsonPath).dir;
        if (!fs.existsSync(dir)) {
            FileUtils.mkDirByPathSync(dir);
        }
        fs.writeFileSync(outputJsonPath, JSON.stringify(result));
        Sfpowerkit.log(`Output ${outputDir}/output.json is generated successfully`, LoggerLevel.INFO);
    }
    public async generateCSVOutput(result: any[], outputDir: string) {
        let outputcsvPath = `${outputDir}/output.csv`;
        let dir = path.parse(outputcsvPath).dir;
        if (!fs.existsSync(dir)) {
            FileUtils.mkDirByPathSync(dir);
        }
        let newLine = '\r\n';
        let output =
            'ID,NAME,TYPE,' +
            (this.flags.packagefilter
                ? 'DEPENDENT PACKAGE'
                : 'DEPENDENT ID,DEPENDENT NAME,DEPENDENT TYPE,DEPENDENT PACKAGE') +
            newLine;
        result.forEach((element) => {
            if (element.dependentMetadata && element.dependentMetadata.length > 0) {
                for (let dependent of element.dependentMetadata) {
                    output = `${output}${element.id},${element.fullName},${element.type},${dependent.id},${dependent.fullName},${dependent.type},${dependent.package}${newLine}`;
                }
            } else if (element.dependentPackage && element.dependentPackage.length > 0) {
                for (let dependent of element.dependentPackage) {
                    output = `${output}${element.id},${element.fullName},${element.type},${dependent}${newLine}`;
                }
            } else {
                output = `${output}${element.id},${element.fullName},${element.type}${newLine}`;
            }
        });
        fs.writeFileSync(outputcsvPath, output);
        Sfpowerkit.log(`Output ${outputDir}/output.csv is generated successfully`, LoggerLevel.INFO);
    }
}
