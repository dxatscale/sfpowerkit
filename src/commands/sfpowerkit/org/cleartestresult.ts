import { Connection, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import queryApi from '../../../utils/queryExecutor';
import { Sfpowerkit} from '../../../sfpowerkit';
import SfpowerkitCommand from '../../../sfpowerkitCommand';
import { chunkArray } from '../../../utils/chunkArray';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';

const CODECOVAGG_QUERY = `SELECT Id FROM ApexCodeCoverageAggregate`;
const APEXTESTRESULT_QUERY = `SELECT Id FROM ApexTestResult`;

export default class Cleartestresult extends SfpowerkitCommand {
    public static description = `This command helps to clear any test results and code coverage in the org to get fresh and enhanced coverage everytime`;

    public static examples = [`$ sfdx sfpowerkit:org:cleartestresult -u myOrg@example.com`];

    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    public async execute(): Promise<AnyJson> {
        Sfpowerkit.setLogLevel('Info', this.flags.json);
        await this.org.refreshAuth();

        const conn = this.org.getConnection();

        this.ux.startSpinner(`Clearing Test results`);

        let queryUtil = new queryApi(conn);
        let codeCovAgg = await queryUtil.executeQuery(CODECOVAGG_QUERY, true);
        await this.deleteRecords(conn, 'ApexCodeCoverageAggregate', codeCovAgg);

        let testResults = await queryUtil.executeQuery(APEXTESTRESULT_QUERY, true);
        await this.deleteRecords(conn, 'ApexTestResult', testResults);

        this.ux.stopSpinner();

        SFPLogger.log(`Test results cleared in ${this.org.getUsername()} successfully.`, LoggerLevel.INFO);

        return true;
    }
    private async deleteRecords(conn: Connection, objectType: string, records: any[]) {
        if (records && records.length > 0) {
            let idsList: string[] = records.map((elem) => elem.Id);
            let errors = [];
            for (let idsTodelete of chunkArray(2000, idsList)) {
                const deleteResults: any = await conn.tooling.destroy(objectType, idsTodelete);
                deleteResults.forEach((elem) => {
                    if (!elem.success) {
                        errors = errors.concat(elem.errors);
                    }
                });
            }

            if (errors.length > 0) {
                throw new SfdxError(JSON.stringify(errors));
            }
        }
    }
}
